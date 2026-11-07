import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomInt } from 'node:crypto';
import { computeOrderTotals } from '../domain/order-pricing';
import { assertTransition, OrderStatus } from '../domain/order-state';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditService } from '../audit/audit.service';
import { LimitsService } from '../subscriptions/limits.service';
import { PageQuery, pageResult, skipTake } from '../common/paging';

export interface PlaceOrderInput { storeId: string; customerId: string; items: { variantId: string; quantity: number }[]; addressId?: string; note?: string; idempotencyKey?: string; actor: { type: 'USER' | 'CUSTOMER'; id?: string }; reservationTtlMinutes: number; }

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryService, private readonly audit: AuditService, private readonly limits: LimitsService) {}

  /** ثبت سفارش: همه‌چیز در یک تراکنش — قیمت از DB، Snapshot، رزرو اتمیک موجودی، تاریخچه وضعیت. */
  async place(tenantId: string, input: PlaceOrderInput) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await this.placeOnce(tenantId, input); }
      catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && String(e.meta?.target).includes('order_number')) continue; throw e; }
    }
    throw new ConflictException('ثبت سفارش ناموفق بود؛ دوباره تلاش کنید');
  }

  private async placeOnce(tenantId: string, input: PlaceOrderInput) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      if (input.idempotencyKey) {
        const existing = await tx.order.findFirst({ where: { tenantId, idempotencyKey: input.idempotencyKey }, include: { items: true } });
        if (existing) return existing;
      }
      await this.limits.assertCanCreate(tx, tenantId, 'maxOrdersPerMonth');
      const store = await tx.store.findFirst({ where: { id: input.storeId, tenantId, isActive: true } });
      if (!store) throw new NotFoundException('فروشگاه یافت نشد');
      const customer = await tx.customer.findFirst({ where: { id: input.customerId, tenantId } });
      if (!customer) throw new NotFoundException('مشتری یافت نشد');

      // ادغام اقلام تکراری
      const merged = new Map<string, number>();
      for (const i of input.items) merged.set(i.variantId, (merged.get(i.variantId) ?? 0) + i.quantity);
      const variantIds = [...merged.keys()].sort(); // ترتیب ثابت = جلوگیری از Deadlock
      const variants = await tx.productVariant.findMany({ where: { tenantId, id: { in: variantIds }, isActive: true, product: { storeId: store.id, status: 'ACTIVE', deletedAt: null } }, include: { product: true } });
      if (variants.length !== variantIds.length) throw new UnprocessableEntityException('یکی از کالاها موجود یا فعال نیست');

      const totals = computeOrderTotals(variants.map((v) => ({ variantId: v.id, productId: v.productId, productName: v.product.name, variantTitle: v.title, sku: v.sku, quantity: merged.get(v.id)!, unitAmount: v.priceAmount })));

      let address: Prisma.JsonObject | undefined;
      if (input.addressId) {
        const a = await tx.customerAddress.findFirst({ where: { id: input.addressId, tenantId, customerId: customer.id } });
        if (!a) throw new NotFoundException('نشانی یافت نشد');
        address = { recipientName: a.recipientName, phone: a.phone, province: a.province, city: a.city, addressLine: a.addressLine, postalCode: a.postalCode };
      }
      const order = await tx.order.create({ data: {
        tenantId, storeId: store.id, customerId: customer.id, orderNumber: this.newOrderNumber(), status: 'PENDING', currency: totals.currency,
        subtotalAmount: totals.subtotalAmount, discountAmount: totals.discountAmount, shippingAmount: totals.shippingAmount, totalAmount: totals.totalAmount,
        shippingAddress: address, customerSnapshot: { fullName: customer.fullName, phone: customer.phone }, note: input.note, idempotencyKey: input.idempotencyKey,
        items: { create: totals.lines.map((l) => ({ tenantId, variantId: l.variantId, productId: l.productId, productName: l.productName, variantTitle: l.variantTitle, sku: l.sku, quantity: l.quantity, unitAmount: l.unitAmount, lineAmount: l.lineAmount })) },
      }, include: { items: true } });

      const expiresAt = new Date(Date.now() + input.reservationTtlMinutes * 60_000);
      for (const v of variants) {
        if (!v.trackInventory) continue;
        const qty = merged.get(v.id)!;
        const locationId = await this.inventory.reserve(tx, tenantId, store.id, v.id, qty); // 409 اگر موجودی کافی نباشد → کل تراکنش برگردانده می‌شود
        await tx.stockReservation.create({ data: { tenantId, orderId: order.id, variantId: v.id, locationId, quantity: qty, expiresAt } });
      }
      await tx.orderStatusHistory.create({ data: { tenantId, orderId: order.id, toStatus: 'PENDING', actorType: input.actor.type, actorId: input.actor.id, note: 'ثبت سفارش' } });
      await this.audit.logTx(tx, { tenantId, actorUserId: input.actor.type === 'USER' ? input.actor.id : null, actorType: input.actor.type, action: 'order.place', entityType: 'order', entityId: order.id, metadata: { total: totals.totalAmount.toString(), items: totals.lines.length } });
      return order;
    });
  }

  async transition(tx: Tx, tenantId: string, orderId: string, to: OrderStatus, actor: { type: 'USER' | 'CUSTOMER' | 'SYSTEM'; id?: string }, opts: { viaVerifiedPayment?: boolean; note?: string } = {}) {
    // قفل ردیف سفارش برای جلوگیری از تغییر وضعیت هم‌زمان
    const rows = await tx.$queryRaw<{ status: OrderStatus }[]>`SELECT status FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('سفارش یافت نشد');
    const from = rows[0].status;
    try { assertTransition(from, to, opts); } catch (e) { throw new ConflictException((e as Error).message); }
    await tx.order.update({ where: { id: orderId }, data: { status: to } });
    await tx.orderStatusHistory.create({ data: { tenantId, orderId, fromStatus: from, toStatus: to, actorType: actor.type, actorId: actor.id, note: opts.note } });
    return { from, to };
  }

  /** تغییر وضعیت دستی توسط فروشنده (هرگز PAID نمی‌شود). لغو، رزروها را آزاد می‌کند. */
  async changeStatus(tenantId: string, orderId: string, to: OrderStatus, actorUserId: string, note?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const r = await this.transition(tx, tenantId, orderId, to, { type: 'USER', id: actorUserId }, { note });
      if (to === 'CANCELLED') await this.releaseReservations(tx, tenantId, orderId);
      await this.audit.logTx(tx, { tenantId, actorUserId, action: 'order.status_change', entityType: 'order', entityId: orderId, metadata: { ...r, note } });
      return r;
    });
  }

  async releaseReservations(tx: Tx, tenantId: string, orderId: string) {
    const active = await tx.stockReservation.findMany({ where: { tenantId, orderId, status: 'ACTIVE' } });
    for (const r of active) {
      await this.inventory.release(tx, tenantId, r);
      await tx.stockReservation.update({ where: { id: r.id }, data: { status: 'RELEASED' } });
    }
  }

  /** کار زمان‌بندی‌شده: سفارش‌های پرداخت‌نشده با رزرو منقضی لغو و موجودی آزاد می‌شود. */
  async expireStaleReservations(now = new Date()) {
    const stale = await this.prisma.system.stockReservation.findMany({ where: { status: 'ACTIVE', expiresAt: { lt: now }, order: { status: { in: ['PENDING', 'AWAITING_PAYMENT'] } } }, select: { tenantId: true, orderId: true }, distinct: ['orderId'], take: 200 });
    let n = 0;
    for (const s of stale) {
      await this.prisma.withTenant(s.tenantId, async (tx) => {
        const row = await tx.order.findFirst({ where: { id: s.orderId, tenantId: s.tenantId, status: { in: ['PENDING', 'AWAITING_PAYMENT'] } } });
        if (!row) return;
        await this.transition(tx, s.tenantId, s.orderId, 'CANCELLED', { type: 'SYSTEM' }, { note: 'انقضای مهلت پرداخت' });
        await this.releaseReservations(tx, s.tenantId, s.orderId);
        await this.audit.logTx(tx, { tenantId: s.tenantId, actorType: 'SYSTEM', action: 'order.expired', entityType: 'order', entityId: s.orderId });
        n++;
      });
    }
    return n;
  }

  list(tenantId: string, p: PageQuery & { storeId?: string; status?: OrderStatus; sort?: 'createdAt' | 'totalAmount' }) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.OrderWhereInput = { tenantId, ...(p.storeId && { storeId: p.storeId }), ...(p.status && { status: p.status }), ...(p.q && { OR: [{ orderNumber: { contains: p.q } }, { customer: { fullName: { contains: p.q, mode: 'insensitive' } } }] }) };
      const [items, total] = await Promise.all([
        tx.order.findMany({ where, orderBy: { [p.sort ?? 'createdAt']: p.dir }, ...skipTake(p), include: { customer: { select: { fullName: true, phone: true } } } }),
        tx.order.count({ where }),
      ]);
      return pageResult(items, total, p);
    });
  }
  get(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const o = await tx.order.findFirst({ where: { id, tenantId }, include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } }, payments: true, customer: true } });
      if (!o) throw new NotFoundException('سفارش یافت نشد'); return o;
    });
  }
  private newOrderNumber() { const d = new Date(); return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${randomInt(100000, 999999)}`; }
}
