import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** همه گزارش‌ها فقط «سفارش‌های پرداخت‌شده» (PAID/PROCESSING/SHIPPED/COMPLETED) را فروش می‌شمارند. */
const SOLD = ['PAID', 'PROCESSING', 'SHIPPED', 'COMPLETED'] as const;
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}
  dashboard(tenantId: string, storeId?: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const sid = storeId ?? null;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const since30 = new Date(Date.now() - 30 * 86400_000);
      const [todayAgg, ordersToday, activeProducts, lowStock, daily, top, byStatus, customers] = await Promise.all([
        tx.order.aggregate({ where: { tenantId, ...(sid && { storeId: sid }), status: { in: [...SOLD] }, placedAt: { gte: today } }, _sum: { totalAmount: true } }),
        tx.order.count({ where: { tenantId, ...(sid && { storeId: sid }), placedAt: { gte: today } } }),
        tx.product.count({ where: { tenantId, ...(sid && { storeId: sid }), status: 'ACTIVE', deletedAt: null } }),
        tx.$queryRaw<{ n: bigint }[]>`SELECT count(*)::bigint AS n FROM inventory_balances b JOIN inventory_locations l ON l.id=b.location_id AND l.tenant_id=b.tenant_id WHERE b.tenant_id=${tenantId} AND (${sid}::text IS NULL OR l.store_id=${sid}) AND b.on_hand-b.reserved <= 5`,
        tx.$queryRaw<{ day: Date; total: bigint; orders: bigint }[]>`SELECT date_trunc('day', placed_at) AS day, COALESCE(sum(total_amount),0)::bigint AS total, count(*)::bigint AS orders FROM orders WHERE tenant_id=${tenantId} AND (${sid}::text IS NULL OR store_id=${sid}) AND status IN ('PAID','PROCESSING','SHIPPED','COMPLETED') AND placed_at >= ${since30} GROUP BY 1 ORDER BY 1`,
        tx.$queryRaw<{ name: string; qty: bigint; revenue: bigint }[]>`SELECT i.product_name AS name, sum(i.quantity)::bigint AS qty, sum(i.line_amount)::bigint AS revenue FROM order_items i JOIN orders o ON o.id=i.order_id AND o.tenant_id=i.tenant_id WHERE i.tenant_id=${tenantId} AND (${sid}::text IS NULL OR o.store_id=${sid}) AND o.status IN ('PAID','PROCESSING','SHIPPED','COMPLETED') AND o.placed_at >= ${since30} GROUP BY 1 ORDER BY revenue DESC LIMIT 5`,
        tx.order.groupBy({ by: ['status'], where: { tenantId, ...(sid && { storeId: sid }) }, _count: true }),
        tx.customer.count({ where: { tenantId } }),
      ]);
      return {
        todaySales: (todayAgg._sum.totalAmount ?? 0n).toString(), ordersToday, activeProducts, lowStock: Number(lowStock[0]?.n ?? 0), customers,
        daily: daily.map((d) => ({ day: d.day.toISOString().slice(0, 10), total: d.total.toString(), orders: Number(d.orders) })),
        topProducts: top.map((t) => ({ name: t.name, qty: Number(t.qty), revenue: t.revenue.toString() })),
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      };
    });
  }
  customers(tenantId: string, q?: string) {
    return this.prisma.withTenant(tenantId, (tx) => tx.customer.findMany({ where: { tenantId, ...(q && { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] }) }, include: { identities: { select: { channel: true, username: true } }, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }));
  }
}
