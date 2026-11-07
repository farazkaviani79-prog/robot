import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /**
   * رزرو اتمیک: یک UPDATE شرطی (on_hand - reserved >= qty). دو درخواست هم‌زمان نمی‌توانند بیش از موجودی رزرو کنند
   * (برابر آزمون هم‌زمانی scripts/db-verify.sh). قید CHECK دیتابیس لایه دوم دفاع است.
   */
  async reserve(tx: Tx, tenantId: string, storeId: string, variantId: string, qty: number): Promise<string> {
    const balances = await tx.inventoryBalance.findMany({ where: { tenantId, variantId, location: { storeId } }, orderBy: [{ location: { isDefault: 'desc' } }, { onHand: 'desc' }] });
    for (const b of balances) {
      const rows = await tx.$queryRaw<{ id: string }[]>`UPDATE inventory_balances SET reserved = reserved + ${qty}, updated_at = now() WHERE id = ${b.id} AND tenant_id = ${tenantId} AND on_hand - reserved >= ${qty} RETURNING id`;
      if (rows.length) {
        await tx.inventoryMovement.create({ data: { tenantId, variantId, locationId: b.locationId, type: 'RESERVE', reservedDelta: qty } });
        return b.locationId;
      }
    }
    throw new ConflictException('موجودی کافی نیست');
  }
  async release(tx: Tx, tenantId: string, r: { variantId: string; locationId: string; quantity: number; orderId: string }) {
    const rows = await tx.$queryRaw<{ id: string }[]>`UPDATE inventory_balances SET reserved = reserved - ${r.quantity}, updated_at = now() WHERE tenant_id = ${tenantId} AND variant_id = ${r.variantId} AND location_id = ${r.locationId} AND reserved >= ${r.quantity} RETURNING id`;
    if (!rows.length) throw new ConflictException('ناسازگاری رزرو موجودی');
    await tx.inventoryMovement.create({ data: { tenantId, variantId: r.variantId, locationId: r.locationId, type: 'RELEASE', reservedDelta: -r.quantity, refType: 'order', refId: r.orderId } });
  }
  async commitSale(tx: Tx, tenantId: string, r: { variantId: string; locationId: string; quantity: number; orderId: string }) {
    const rows = await tx.$queryRaw<{ id: string }[]>`UPDATE inventory_balances SET on_hand = on_hand - ${r.quantity}, reserved = reserved - ${r.quantity}, updated_at = now() WHERE tenant_id = ${tenantId} AND variant_id = ${r.variantId} AND location_id = ${r.locationId} AND reserved >= ${r.quantity} AND on_hand >= ${r.quantity} RETURNING id`;
    if (!rows.length) throw new ConflictException('ناسازگاری موجودی هنگام قطعی‌سازی فروش');
    await tx.inventoryMovement.create({ data: { tenantId, variantId: r.variantId, locationId: r.locationId, type: 'SALE', onHandDelta: -r.quantity, reservedDelta: -r.quantity, refType: 'order', refId: r.orderId } });
  }

  async adjust(tenantId: string, actorUserId: string, input: { variantId: string; locationId: string; delta: number; reason: string; type: 'RECEIPT' | 'ADJUSTMENT' | 'RETURN' }) {
    if (!Number.isInteger(input.delta) || input.delta === 0) throw new ConflictException('مقدار تغییر نامعتبر است');
    return this.prisma.withTenant(tenantId, async (tx) => {
      // ردیف موجودی را در صورت نبود می‌سازد (فقط برای افزایش)
      if (input.delta > 0) await tx.$executeRaw`INSERT INTO inventory_balances (tenant_id, variant_id, location_id, on_hand, reserved) VALUES (${tenantId}, ${input.variantId}, ${input.locationId}, 0, 0) ON CONFLICT (tenant_id, variant_id, location_id) DO NOTHING`;
      const rows = await tx.$queryRaw<{ on_hand: number }[]>`UPDATE inventory_balances SET on_hand = on_hand + ${input.delta}, updated_at = now() WHERE tenant_id = ${tenantId} AND variant_id = ${input.variantId} AND location_id = ${input.locationId} AND on_hand + ${input.delta} >= reserved RETURNING on_hand`;
      if (!rows.length) throw new ConflictException('موجودی نمی‌تواند کمتر از مقدار رزروشده شود');
      await tx.inventoryMovement.create({ data: { tenantId, variantId: input.variantId, locationId: input.locationId, type: input.type, onHandDelta: input.delta, reason: input.reason, actorUserId } });
      await this.audit.logTx(tx, { tenantId, actorUserId, action: 'inventory.adjust', entityType: 'variant', entityId: input.variantId, metadata: { delta: input.delta, reason: input.reason, locationId: input.locationId } });
      return { onHand: rows[0].on_hand };
    });
  }

  list(tenantId: string, storeId: string, lowStockAt = 5) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const rows = await tx.inventoryBalance.findMany({ where: { tenantId, location: { storeId } }, include: { variant: { select: { sku: true, title: true, product: { select: { name: true } } } }, location: { select: { name: true } } }, orderBy: { onHand: 'asc' }, take: 500 });
      return rows.map((r) => ({ variantId: r.variantId, sku: r.variant.sku, product: r.variant.product.name, variant: r.variant.title, location: r.location.name, locationId: r.locationId, onHand: r.onHand, reserved: r.reserved, available: r.onHand - r.reserved, low: r.onHand - r.reserved <= lowStockAt }));
    });
  }
  movements(tenantId: string, variantId: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const v = await tx.productVariant.findFirst({ where: { id: variantId, tenantId } }); if (!v) throw new NotFoundException('تنوع یافت نشد');
      return tx.inventoryMovement.findMany({ where: { tenantId, variantId }, orderBy: { createdAt: 'desc' }, take: 200 });
    });
  }
}
