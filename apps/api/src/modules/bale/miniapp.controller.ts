import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Inject, NotFoundException, Param, Post, Put, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Public } from '../../auth/auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../../orders/orders.service';
import { PaymentsService } from '../../payments/payments.service';
import { SecretBox } from '../../common/crypto';
import { validateInitData } from './init-data';
import { APP_ENV, ChannelService, SECRET_BOX } from './channel.service';
import { BotFlowService } from './bot-flow.service';
import type { Env } from '../../config/env';

class CartItemDto { @IsString() variantId!: string; @IsInt() @Min(0) @Max(100) quantity!: number; }
class AddressDto { @IsString() @MinLength(2) @MaxLength(100) recipientName!: string; @Matches(/^09\d{9}$/, { message: 'شماره موبایل نامعتبر است' }) phone!: string; @IsString() @MaxLength(60) province!: string; @IsString() @MaxLength(60) city!: string; @IsString() @MinLength(8) @MaxLength(300) addressLine!: string; @IsOptional() @Matches(/^\d{10}$/, { message: 'کد پستی ۱۰ رقمی است' }) postalCode?: string; }
class CheckoutDto { @IsString() addressId!: string; @IsOptional() @IsString() @MaxLength(300) note?: string; @IsString() @MinLength(8) @MaxLength(80) idempotencyKey!: string; }

interface Ctx { tenantId: string; storeId: string; customerId: string; chatId: string; connectionId: string; }

/**
 * API مینی‌اپ مشتری. هویت فقط از initData «اعتبارسنجی‌شده در سرور» می‌آید؛ شناسه مشتری هرگز از Body نمی‌آید.
 * تا زمانی که قالب/الگوریتم initData بله تأیید نشده (INITDATA_VERIFIED=true)، در حالت واقعی غیرفعال است.
 */
@Controller('miniapp/:storeId')
export class MiniAppController {
  constructor(private readonly prisma: PrismaService, private readonly channels: ChannelService, private readonly flow: BotFlowService, private readonly orders: OrdersService, private readonly payments: PaymentsService, @Inject(SECRET_BOX) private readonly box: SecretBox, @Inject(APP_ENV) private readonly env: Env) {}

  private async ctx(storeId: string, initData?: string): Promise<Ctx> {
    if (this.env.baleMode !== 'mock' && !this.env.initDataVerified) throw new ServiceUnavailableException('اعتبارسنجی مینی‌اپ بله هنوز مطابق مستندات رسمی تأیید نشده است');
    if (!initData) throw new UnauthorizedException('initData ارسال نشده است');
    const conn = await this.prisma.system.channelConnection.findFirst({ where: { storeId, channel: 'BALE', status: 'ACTIVE', store: { isActive: true, tenant: { status: 'ACTIVE' } } } });
    if (!conn?.botTokenEnc) throw new NotFoundException('فروشگاه یافت نشد');
    const r = validateInitData(initData, this.box.decrypt(conn.botTokenEnc));
    if (!r.ok) throw new UnauthorizedException('اعتبار نشست مینی‌اپ تأیید نشد');
    const customer = await this.flow.upsertCustomer(conn.tenantId, r.data.userId, r.data.username, undefined, r.data.firstName);
    return { tenantId: conn.tenantId, storeId, customerId: customer.id, chatId: r.data.userId, connectionId: conn.id };
  }

  @Public() @Get('catalog') async catalog(@Param('storeId') storeId: string, @Headers('x-init-data') init?: string) {
    const c = await this.ctx(storeId, init);
    return this.prisma.withTenant(c.tenantId, async (tx) => {
      const [store, categories, products] = await Promise.all([
        tx.store.findFirstOrThrow({ where: { id: storeId, tenantId: c.tenantId }, select: { name: true, description: true } }),
        tx.category.findMany({ where: { tenantId: c.tenantId, storeId }, orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } }),
        tx.product.findMany({ where: { tenantId: c.tenantId, storeId, status: 'ACTIVE', deletedAt: null }, take: 200, orderBy: { createdAt: 'desc' }, include: { media: { take: 1, orderBy: { sortOrder: 'asc' }, select: { url: true } }, variants: { where: { isActive: true }, include: { balances: { select: { onHand: true, reserved: true } } } } } }),
      ]);
      return { store, categories, products: products.map((p) => ({ id: p.id, name: p.name, description: p.description, categoryId: p.categoryId, image: p.media[0]?.url ?? null, variants: p.variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku, price: v.priceAmount.toString(), available: v.trackInventory ? v.balances.reduce((s, b) => s + b.onHand - b.reserved, 0) : null })) })) };
    });
  }

  @Public() @Get('cart') async cart(@Param('storeId') storeId: string, @Headers('x-init-data') init?: string) { const c = await this.ctx(storeId, init); return this.loadCart(c); }
  @Public() @Put('cart/items') async setItem(@Param('storeId') storeId: string, @Body() d: CartItemDto, @Headers('x-init-data') init?: string) {
    const c = await this.ctx(storeId, init);
    await this.prisma.withTenant(c.tenantId, async (tx) => {
      let cart = await tx.cart.findFirst({ where: { tenantId: c.tenantId, storeId, customerId: c.customerId, status: 'ACTIVE' } });
      cart ??= await tx.cart.create({ data: { tenantId: c.tenantId, storeId, customerId: c.customerId } });
      if (d.quantity === 0) { await tx.cartItem.deleteMany({ where: { tenantId: c.tenantId, cartId: cart.id, variantId: d.variantId } }); return; }
      const v = await tx.productVariant.findFirst({ where: { id: d.variantId, tenantId: c.tenantId, isActive: true, product: { storeId, status: 'ACTIVE', deletedAt: null } } });
      if (!v) throw new NotFoundException('کالا یافت نشد');
      await tx.cartItem.upsert({ where: { tenantId_cartId_variantId: { tenantId: c.tenantId, cartId: cart.id, variantId: d.variantId } }, create: { tenantId: c.tenantId, cartId: cart.id, variantId: d.variantId, quantity: d.quantity }, update: { quantity: d.quantity } });
    });
    return this.loadCart(c);
  }
  private loadCart(c: Ctx) {
    return this.prisma.withTenant(c.tenantId, async (tx) => {
      const cart = await tx.cart.findFirst({ where: { tenantId: c.tenantId, storeId: c.storeId, customerId: c.customerId, status: 'ACTIVE' }, include: { items: { include: { variant: { include: { product: { select: { name: true } } } } } } } });
      const items = (cart?.items ?? []).map((i) => ({ variantId: i.variantId, name: i.variant.product.name, variant: i.variant.title, quantity: i.quantity, unit: i.variant.priceAmount.toString(), line: (i.variant.priceAmount * BigInt(i.quantity)).toString() }));
      return { items, subtotal: items.reduce((s, i) => s + BigInt(i.line), 0n).toString(), currency: 'IRR' }; // مبلغ نمایشی؛ مبلغ قطعی هنگام ثبت سفارش از DB محاسبه می‌شود
    });
  }

  @Public() @Post('addresses') async addAddress(@Param('storeId') storeId: string, @Body() d: AddressDto, @Headers('x-init-data') init?: string) {
    const c = await this.ctx(storeId, init);
    return this.prisma.withTenant(c.tenantId, (tx) => tx.customerAddress.create({ data: { tenantId: c.tenantId, customerId: c.customerId, ...d } }));
  }
  @Public() @Get('addresses') async addresses(@Param('storeId') storeId: string, @Headers('x-init-data') init?: string) {
    const c = await this.ctx(storeId, init);
    return this.prisma.withTenant(c.tenantId, (tx) => tx.customerAddress.findMany({ where: { tenantId: c.tenantId, customerId: c.customerId } }));
  }

  @Public() @Post('checkout') async checkout(@Param('storeId') storeId: string, @Body() d: CheckoutDto, @Headers('x-init-data') init?: string) {
    const c = await this.ctx(storeId, init);
    const conn = await this.prisma.system.channelConnection.findUniqueOrThrow({ where: { id: c.connectionId } });
    const adapter = this.channels.forConnection(conn);
    // اگر درگاه قابل‌اعتماد فعال نیست، سفارشی ساخته نمی‌شود (جلوگیری از رزرو بی‌دلیل موجودی).
    if (!adapter.paymentsVerified) throw new ServiceUnavailableException('پرداخت آنلاین در حال حاضر فعال نیست');
    const items = await this.prisma.withTenant(c.tenantId, async (tx) => {
      const cart = await tx.cart.findFirst({ where: { tenantId: c.tenantId, storeId, customerId: c.customerId, status: 'ACTIVE' }, include: { items: true } });
      return cart?.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })) ?? [];
    });
    if (items.length === 0) throw new ForbiddenException('سبد خرید خالی است');
    const order = await this.orders.place(c.tenantId, { storeId, customerId: c.customerId, items, addressId: d.addressId, note: d.note, idempotencyKey: `${c.customerId}:${d.idempotencyKey}`, actor: { type: 'CUSTOMER', id: c.customerId }, reservationTtlMinutes: this.env.reservationTtlMinutes });
    const payment = await this.payments.initiate(c.tenantId, order.id, this.env.baleMode === 'mock' ? 'MOCK' : 'BALE', { type: 'CUSTOMER', id: c.customerId });
    await this.prisma.withTenant(c.tenantId, (tx) => tx.cart.updateMany({ where: { tenantId: c.tenantId, storeId, customerId: c.customerId, status: 'ACTIVE' }, data: { status: 'CONVERTED' } }));
    if (this.env.baleMode !== 'mock') await adapter.sendInvoice({ chatId: c.chatId, title: `سفارش ${order.orderNumber}`, description: `پرداخت سفارش ${order.orderNumber}`, invoicePayload: payment.invoicePayload, amountRial: payment.amount, items: order.items.map((i) => ({ label: i.productName, amountRial: i.lineAmount })) });
    return { orderId: order.id, orderNumber: order.orderNumber, total: order.totalAmount.toString(), currency: 'IRR', paymentStatus: payment.status, invoicePayload: this.env.baleMode === 'mock' ? payment.invoicePayload : undefined };
  }

  /** فقط حالت Mock: شبیه‌سازی SuccessfulPayment معتبر. در Production (BALE_MODE=http) هرگز در دسترس نیست. */
  @Public() @HttpCode(200) @Post('payments/:invoicePayload/mock-confirm') async mockConfirm(@Param('storeId') storeId: string, @Param('invoicePayload') invoicePayload: string, @Headers('x-init-data') init?: string) {
    if (this.env.baleMode !== 'mock' || this.env.nodeEnv === 'production') throw new NotFoundException();
    const c = await this.ctx(storeId, init);
    const p = await this.prisma.withTenant(c.tenantId, (tx) => tx.payment.findFirst({ where: { tenantId: c.tenantId, invoicePayload, order: { customerId: c.customerId } } }));
    if (!p) throw new NotFoundException();
    return this.payments.handleEvent(c.tenantId, { kind: 'SUCCESSFUL_PAYMENT', invoicePayload, amount: p.amount, currency: p.currency, providerRef: `mock-${invoicePayload}` }, `mock-sp:${invoicePayload}`, { mock: true });
  }

  @Public() @Get('orders') async myOrders(@Param('storeId') storeId: string, @Headers('x-init-data') init?: string) {
    const c = await this.ctx(storeId, init);
    return this.prisma.withTenant(c.tenantId, (tx) => tx.order.findMany({ where: { tenantId: c.tenantId, storeId, customerId: c.customerId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, orderNumber: true, status: true, totalAmount: true, createdAt: true } }));
  }
}
