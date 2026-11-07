import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomToken } from '../common/crypto';
import { decidePaymentEvent, Decision, IncomingPaymentEvent } from '../domain/payment-rules';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrdersService } from '../orders/orders.service';
import { InventoryService } from '../inventory/inventory.service';

export type ProviderKind = 'MOCK' | 'BALE';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly orders: OrdersService, private readonly inventory: InventoryService) {}

  /** ایجاد (یا استفاده مجدد از) پرداخت باز برای سفارش. مبلغ همیشه از سفارش Snapshot‌شده خوانده می‌شود. */
  async initiate(tenantId: string, orderId: string, provider: ProviderKind, actor: { type: 'USER' | 'CUSTOMER'; id?: string }) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const rows = await tx.$queryRaw<{ status: string; total_amount: bigint; currency: string }[]>`SELECT status, total_amount, currency FROM orders WHERE id = ${orderId} AND tenant_id = ${tenantId} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('سفارش یافت نشد');
      const o = rows[0];
      if (o.status !== 'PENDING' && o.status !== 'AWAITING_PAYMENT') throw new ConflictException('این سفارش قابل پرداخت نیست');
      const open = await tx.payment.findFirst({ where: { tenantId, orderId, provider, status: { in: ['INITIATED', 'PENDING'] } } });
      if (open) return open;
      const payment = await tx.payment.create({ data: { tenantId, orderId, provider, status: 'PENDING', amount: o.total_amount, currency: o.currency, invoicePayload: 'pay_' + randomToken(18) } });
      if (o.status === 'PENDING') await this.orders.transition(tx, tenantId, orderId, 'AWAITING_PAYMENT', { type: actor.type, id: actor.id }, { note: 'آغاز پرداخت' });
      await this.audit.logTx(tx, { tenantId, actorType: actor.type, actorUserId: actor.type === 'USER' ? actor.id : null, action: 'payment.initiate', entityType: 'payment', entityId: payment.id, metadata: { provider, amount: o.total_amount.toString() } });
      return payment;
    });
  }

  /**
   * ورودی واحد همه رویدادهای پرداخت (وب‌هوک/استعلام). Idempotent: dedupeKey یکتا در payment_events.
   * فقط SUCCESSFUL_PAYMENT / VERIFIED_INQUIRY معتبر می‌تواند پرداخت را PAID کند.
   */
  async handleEvent(tenantId: string, event: IncomingPaymentEvent, dedupeKey: string, raw: unknown): Promise<Decision> {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const pay = await tx.$queryRaw<{ id: string; status: any; amount: bigint; currency: string; invoice_payload: string; order_id: string }[]>`SELECT id, status, amount, currency, invoice_payload, order_id FROM payments WHERE tenant_id = ${tenantId} AND invoice_payload = ${event.invoicePayload} FOR UPDATE`;
      if (!pay.length) return { action: 'REJECT', reason: 'پرداخت یافت نشد' } as Decision;
      const p = pay[0];
      // درج رویداد با ON CONFLICT تا خطای SQL تراکنش را خراب نکند
      const ins = await tx.$queryRaw<{ id: string }[]>`INSERT INTO payment_events (tenant_id, payment_id, type, dedupe_key, payload) VALUES (${tenantId}, ${p.id}, ${event.kind}, ${dedupeKey}, ${JSON.stringify(raw, (_, v) => (typeof v === 'bigint' ? v.toString() : v))}::jsonb) ON CONFLICT (tenant_id, dedupe_key) DO NOTHING RETURNING id`;
      if (!ins.length) return { action: 'IGNORE_DUPLICATE' } as Decision;

      const decision = decidePaymentEvent({ id: p.id, status: p.status, amount: p.amount, currency: p.currency, invoicePayload: p.invoice_payload }, event);
      if (decision.action === 'MARK_PAID') await this.markPaid(tx, tenantId, p.id, p.order_id, decision.providerRef);
      else if (decision.action === 'MARK_FAILED') await tx.payment.update({ where: { id: p.id }, data: { status: 'FAILED', failureReason: decision.reason } });
      else if (decision.action === 'REJECT') await this.audit.logTx(tx, { tenantId, actorType: 'SYSTEM', action: 'payment.event_rejected', entityType: 'payment', entityId: p.id, metadata: { kind: event.kind, reason: decision.reason } });
      return decision;
    });
  }

  private async markPaid(tx: Tx, tenantId: string, paymentId: string, orderId: string, providerRef: string) {
    await tx.payment.update({ where: { id: paymentId }, data: { status: 'PAID', providerRef, verifiedAt: new Date() } });
    const order = await tx.order.findFirstOrThrow({ where: { id: orderId, tenantId } });
    if (order.status !== 'AWAITING_PAYMENT') {
      // پرداخت دیرهنگام برای سفارش لغو/منقضی‌شده: وجه دریافت شده؛ بازپرداخت درخواست می‌شود، سفارش «پرداخت‌شده» نمی‌شود.
      await tx.refund.create({ data: { tenantId, paymentId, orderId, amount: (await tx.payment.findFirstOrThrow({ where: { id: paymentId } })).amount, reason: 'پرداخت پس از لغو/انقضای سفارش', status: 'REQUESTED' } });
      await this.audit.logTx(tx, { tenantId, actorType: 'SYSTEM', action: 'payment.late_after_cancel', entityType: 'order', entityId: orderId });
      return;
    }
    await this.orders.transition(tx, tenantId, orderId, 'PAID', { type: 'SYSTEM' }, { viaVerifiedPayment: true, note: 'پرداخت تأیید شد' });
    const reservations = await tx.stockReservation.findMany({ where: { tenantId, orderId, status: 'ACTIVE' } });
    for (const r of reservations) { await this.inventory.commitSale(tx, tenantId, r); await tx.stockReservation.update({ where: { id: r.id }, data: { status: 'COMMITTED' } }); }
    await this.audit.logTx(tx, { tenantId, actorType: 'SYSTEM', action: 'payment.paid', entityType: 'payment', entityId: paymentId, metadata: { orderId, providerRef } });
  }

  async requestRefund(tenantId: string, actorUserId: string, input: { paymentId: string; amount: bigint; reason: string }) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const rows = await tx.$queryRaw<{ id: string; order_id: string; amount: bigint; status: string; provider: string }[]>`SELECT id, order_id, amount, status, provider FROM payments WHERE id = ${input.paymentId} AND tenant_id = ${tenantId} FOR UPDATE`;
      if (!rows.length) throw new NotFoundException('پرداخت یافت نشد');
      const p = rows[0];
      if (p.status !== 'PAID' && p.status !== 'PARTIALLY_REFUNDED') throw new ConflictException('فقط پرداخت موفق قابل بازپرداخت است');
      const agg = await tx.refund.aggregate({ where: { tenantId, paymentId: p.id, status: { in: ['REQUESTED', 'PROCESSING', 'SUCCEEDED'] } }, _sum: { amount: true } });
      const already = agg._sum.amount ?? 0n;
      if (input.amount <= 0n || input.amount + already > p.amount) throw new ConflictException('مبلغ بازپرداخت از مبلغ قابل بازپرداخت بیشتر است');
      // Mock فوراً موفق می‌شود؛ بازپرداخت درگاه واقعی تا تأیید مستندات رسمی «درخواست‌شده» می‌ماند و دستی پیگیری می‌شود.
      const status = p.provider === 'MOCK' ? 'SUCCEEDED' : 'REQUESTED';
      const refund = await tx.refund.create({ data: { tenantId, paymentId: p.id, orderId: p.order_id, amount: input.amount, reason: input.reason, status, createdBy: actorUserId } });
      if (status === 'SUCCEEDED') {
        const full = already + input.amount === p.amount;
        await tx.payment.update({ where: { id: p.id }, data: { status: full ? 'REFUNDED' : 'PARTIALLY_REFUNDED' } });
        if (full) await this.orders.transition(tx, tenantId, p.order_id, 'REFUNDED', { type: 'USER', id: actorUserId }, { note: input.reason });
      }
      await this.audit.logTx(tx, { tenantId, actorUserId, action: 'refund.request', entityType: 'refund', entityId: refund.id, metadata: { amount: input.amount.toString(), status } });
      return refund;
    });
  }

  /** تطبیق مالی ساده: جمع پرداخت‌های تأییدشده، بازپرداخت‌ها و پرداخت‌های بدون سفارش PAID. */
  reconciliation(tenantId: string, from: Date, to: Date) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const paid = await tx.payment.aggregate({ where: { tenantId, status: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] }, verifiedAt: { gte: from, lt: to } }, _sum: { amount: true }, _count: true });
      const refunds = await tx.refund.aggregate({ where: { tenantId, status: 'SUCCEEDED', createdAt: { gte: from, lt: to } }, _sum: { amount: true }, _count: true });
      const mismatches = await tx.$queryRaw<{ payment_id: string; order_id: string; order_status: string }[]>`SELECT p.id AS payment_id, o.id AS order_id, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id AND o.tenant_id = p.tenant_id WHERE p.tenant_id = ${tenantId} AND p.status = 'PAID' AND o.status IN ('PENDING','AWAITING_PAYMENT','CANCELLED') AND p.verified_at >= ${from} AND p.verified_at < ${to}`;
      const gross = paid._sum.amount ?? 0n; const ref = refunds._sum.amount ?? 0n;
      return { gross: gross.toString(), refunded: ref.toString(), net: (gross - ref).toString(), paymentCount: paid._count, refundCount: refunds._count, mismatches };
    });
  }
}
