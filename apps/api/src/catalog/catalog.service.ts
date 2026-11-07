import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LimitsService } from '../subscriptions/limits.service';
import { PageQuery, pageResult, skipTake } from '../common/paging';
import { parseRial } from '../common/money';
import { CategoryDto, ProductDto, ProductUpdateDto, StoreDto, VariantPriceDto } from './catalog.dto';

const dup = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly limits: LimitsService) {}

  // ---------- فروشگاه‌ها ----------
  async createStore(tenantId: string, userId: string, d: StoreDto) {
    try {
      return await this.prisma.withTenant(tenantId, async (tx) => {
        await this.limits.assertCanCreate(tx, tenantId, 'maxStores');
        const store = await tx.store.create({ data: { tenantId, name: d.name, slug: d.slug, description: d.description } });
        await tx.inventoryLocation.create({ data: { tenantId, storeId: store.id, name: 'انبار اصلی', isDefault: true } });
        await this.audit.logTx(tx, { tenantId, actorUserId: userId, action: 'store.create', entityType: 'store', entityId: store.id });
        return store;
      });
    } catch (e) { if (dup(e)) throw new ConflictException('این شناسه فروشگاه قبلاً استفاده شده است'); throw e; }
  }
  listStores(tenantId: string) { return this.prisma.withTenant(tenantId, (tx) => tx.store.findMany({ where: { tenantId }, orderBy: { createdAt: 'asc' } })); }
  async updateStore(tenantId: string, userId: string, id: string, d: Partial<StoreDto> & { isActive?: boolean }) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const r = await tx.store.updateMany({ where: { id, tenantId }, data: { name: d.name, description: d.description, isActive: d.isActive } });
      if (!r.count) throw new NotFoundException('فروشگاه یافت نشد');
      await this.audit.logTx(tx, { tenantId, actorUserId: userId, action: 'store.update', entityType: 'store', entityId: id, metadata: d as object });
      return tx.store.findFirstOrThrow({ where: { id, tenantId } });
    });
  }

  // ---------- دسته‌بندی ----------
  async createCategory(tenantId: string, userId: string, d: CategoryDto) {
    try {
      return await this.prisma.withTenant(tenantId, async (tx) => {
        const c = await tx.category.create({ data: { tenantId, storeId: d.storeId, name: d.name, slug: d.slug, parentId: d.parentId } });
        await this.audit.logTx(tx, { tenantId, actorUserId: userId, action: 'category.create', entityType: 'category', entityId: c.id });
        return c;
      });
    } catch (e) { if (dup(e)) throw new ConflictException('این شناسه دسته‌بندی تکراری است'); throw e; }
  }
  listCategories(tenantId: string, storeId: string) { return this.prisma.withTenant(tenantId, (tx) => tx.category.findMany({ where: { tenantId, storeId }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })); }

  // ---------- کالا ----------
  async createProduct(tenantId: string, userId: string, d: ProductDto) {
    try {
      return await this.prisma.withTenant(tenantId, async (tx) => {
        await this.limits.assertCanCreate(tx, tenantId, 'maxProducts');
        const loc = await tx.inventoryLocation.findFirst({ where: { tenantId, storeId: d.storeId, isDefault: true } });
        if (!loc) throw new NotFoundException('فروشگاه یا انبار پیش‌فرض یافت نشد');
        const product = await tx.product.create({ data: { tenantId, storeId: d.storeId, categoryId: d.categoryId, name: d.name, description: d.description, status: d.status ?? 'DRAFT' } });
        for (const v of d.variants) {
          const variant = await tx.productVariant.create({ data: { tenantId, productId: product.id, sku: v.sku, title: v.title ?? 'پیش‌فرض', options: v.options ?? {}, priceAmount: parseRial(v.priceAmount), compareAtAmount: v.compareAtAmount ? parseRial(v.compareAtAmount) : null } });
          const stock = v.initialStock ?? 0;
          await tx.inventoryBalance.create({ data: { tenantId, variantId: variant.id, locationId: loc.id, onHand: stock } });
          if (stock > 0) await tx.inventoryMovement.create({ data: { tenantId, variantId: variant.id, locationId: loc.id, type: 'RECEIPT', onHandDelta: stock, reason: 'موجودی اولیه', actorUserId: userId } });
        }
        await this.audit.logTx(tx, { tenantId, actorUserId: userId, action: 'product.create', entityType: 'product', entityId: product.id });
        return tx.product.findFirstOrThrow({ where: { id: product.id, tenantId }, include: { variants: true } });
      });
    } catch (e) { if (dup(e)) throw new ConflictException('SKU تکراری است'); throw e; }
  }
  listProducts(tenantId: string, p: PageQuery & { storeId?: string; status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'; categoryId?: string; sort?: 'createdAt' | 'name' }) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const where: Prisma.ProductWhereInput = { tenantId, deletedAt: null, ...(p.storeId && { storeId: p.storeId }), ...(p.status && { status: p.status }), ...(p.categoryId && { categoryId: p.categoryId }), ...(p.q && { OR: [{ name: { contains: p.q, mode: 'insensitive' } }, { variants: { some: { sku: { contains: p.q, mode: 'insensitive' } } } }] }) };
      const [items, total] = await Promise.all([tx.product.findMany({ where, include: { variants: { include: { balances: { select: { onHand: true, reserved: true } } } }, media: { take: 1, orderBy: { sortOrder: 'asc' } } }, orderBy: { [p.sort ?? 'createdAt']: p.dir }, ...skipTake(p) }), tx.product.count({ where })]);
      return pageResult(items, total, p);
    });
  }
  async getProduct(tenantId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => { const x = await tx.product.findFirst({ where: { id, tenantId, deletedAt: null }, include: { variants: true, media: true, category: true } }); if (!x) throw new NotFoundException('کالا یافت نشد'); return x; });
  }
  async updateProduct(tenantId: string, userId: string, id: string, d: ProductUpdateDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const r = await tx.product.updateMany({ where: { id, tenantId, deletedAt: null }, data: d });
      if (!r.count) throw new NotFoundException('کالا یافت نشد');
      await this.audit.logTx(tx, { tenantId, actorUserId: userId, action: 'product.update', entityType: 'product', entityId: id, metadata: d as object });
      return tx.product.findFirstOrThrow({ where: { id, tenantId }, include: { variants: true } });
    });
  }
  async archiveProduct(tenantId: string, userId: string, id: string) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const r = await tx.product.updateMany({ where: { id, tenantId, deletedAt: null }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
      if (!r.count) throw new NotFoundException('کالا یافت نشد');
      await this.audit.logTx(tx, { tenantId, actorUserId: userId, action: 'product.archive', entityType: 'product', entityId: id });
    });
  }
  async updateVariant(tenantId: string, userId: string, variantId: string, d: VariantPriceDto) {
    return this.prisma.withTenant(tenantId, async (tx) => {
      const before = await tx.productVariant.findFirst({ where: { id: variantId, tenantId } });
      if (!before) throw new NotFoundException('تنوع یافت نشد');
      const price = parseRial(d.priceAmount);
      const v = await tx.productVariant.update({ where: { id: variantId }, data: { priceAmount: price, isActive: d.isActive } });
      await this.audit.logTx(tx, { tenantId, actorUserId: userId, action: 'variant.price_change', entityType: 'variant', entityId: variantId, metadata: { from: before.priceAmount.toString(), to: price.toString() } });
      return v;
    });
  }
}
