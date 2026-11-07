import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../../payments/payments.service';
import { ChannelService, APP_ENV } from './channel.service';
import { OutboundService } from './outbound.service';
import { InboundEvent } from './messenger.types';
import type { Env } from '../../config/env';

@Injectable()
export class BotFlowService {
  private readonly log = new Logger(BotFlowService.name);
  constructor(private readonly prisma: PrismaService, private readonly channels: ChannelService, private readonly outbound: OutboundService, private readonly payments: PaymentsService, @Inject(APP_ENV) private readonly env: Env) {}

  /** پردازش یک WebhookEvent ذخیره‌شده. Idempotent: پردازش مجدد اثر تکراری ندارد (کلیدهای یکتا در DB). */
  async process(tenantId: string, webhookEventId: string) {
    const row = await this.prisma.withTenant(tenantId, (tx) => tx.webhookEvent.findFirst({ where: { id: webhookEventId, tenantId } }));
    if (!row || row.status === 'PROCESSED') return;
    const conn = await this.prisma.system.channelConnection.findUniqueOrThrow({ where: { id: row.connectionId } });
    const adapter = this.channels.forConnection(conn);
    try {
      await this.prisma.withTenant(tenantId, (tx) => tx.webhookEvent.update({ where: { id: row.id }, data: { status: 'PROCESSING', attempts: { increment: 1 } } }));
      await this.dispatch(tenantId, conn, adapter.parseUpdate(row.payload), adapter);
      await this.prisma.withTenant(tenantId, (tx) => tx.webhookEvent.update({ where: { id: row.id }, data: { status: 'PROCESSED', processedAt: new Date(), error: null } }));
    } catch (e) {
      this.log.error(`webhook ${row.id} failed: ${(e as Error).message}`);
      await this.prisma.withTenant(tenantId, (tx) => tx.webhookEvent.update({ where: { id: row.id }, data: { status: 'FAILED', error: String((e as Error).message).slice(0, 500) } }));
      throw e;
    }
  }

  private async dispatch(tenantId: string, conn: { id: string; storeId: string }, ev: InboundEvent, adapter: ReturnType<ChannelService['forConnection']>) {
    switch (ev.kind) {
      case 'message': {
        await this.upsertCustomer(tenantId, ev.userId, ev.username, ev.contactPhone);
        const store = await this.prisma.withTenant(tenantId, (tx) => tx.store.findFirst({ where: { id: conn.storeId, tenantId } }));
        const url = `${this.env.miniAppBaseUrl}/${conn.storeId}`;
        await this.outbound.enqueueText(tenantId, conn.id, ev.chatId, `به ${store?.name ?? 'فروشگاه'} خوش آمدید 👋\nبرای مشاهده محصولات و ثبت سفارش، فروشگاه را باز کنید.`, `welcome:${ev.eventId}`, [[{ text: '🛍 ورود به فروشگاه', webAppUrl: url }]]);
        return;
      }
      case 'callback_query': await adapter.answerCallbackQuery(ev.callbackId); return;
      case 'pre_checkout_query': {
        // پاسخ PreCheckout «اجازه ادامه» است نه اثبات پرداخت. مهلت پاسخ: مستندات رسمی (تأییدنشده).
        if (!adapter.paymentsVerified) { await adapter.answerPreCheckout(ev.queryId, false, 'پرداخت در حال حاضر فعال نیست').catch(() => undefined); return; }
        const d = await this.payments.handleEvent(tenantId, { kind: 'PRECHECKOUT', invoicePayload: ev.invoicePayload, amount: ev.amountRial, currency: ev.currency }, `pre:${ev.queryId}`, ev);
        await adapter.answerPreCheckout(ev.queryId, d.action === 'ALLOW_PRECHECKOUT' || d.action === 'IGNORE_DUPLICATE', d.action === 'REJECT_PRECHECKOUT' ? d.reason : undefined);
        return;
      }
      case 'successful_payment': {
        if (!adapter.paymentsVerified) { this.log.warn('successful_payment ignored: payments not verified'); return; }
        const d = await this.payments.handleEvent(tenantId, { kind: 'SUCCESSFUL_PAYMENT', invoicePayload: ev.invoicePayload, amount: ev.amountRial, currency: ev.currency, providerRef: ev.providerChargeId }, `sp:${ev.providerChargeId}`, ev);
        if (d.action === 'MARK_PAID') await this.outbound.enqueueText(tenantId, conn.id, ev.chatId, 'پرداخت شما با موفقیت تأیید شد ✅ سفارش در حال پردازش است.', `paid:${ev.providerChargeId}`);
        return;
      }
      default: return;
    }
  }

  async upsertCustomer(tenantId: string, externalId: string, username?: string, phone?: string, fullName?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const ident = await tx.customerIdentity.findFirst({ where: { tenantId, channel: 'BALE', externalId }, include: { customer: true } });
      if (ident) { if (phone && !ident.customer.phone) await tx.customer.update({ where: { id: ident.customerId }, data: { phone } }); return ident.customer; }
      const customer = await tx.customer.create({ data: { tenantId, fullName: fullName ?? username ?? null, phone: phone ?? null } });
      await tx.customerIdentity.create({ data: { tenantId, customerId: customer.id, channel: 'BALE', externalId, username } });
      return customer;
    });
  }
}
