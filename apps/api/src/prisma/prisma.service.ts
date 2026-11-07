import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

export type Tx = Prisma.TransactionClient;

/**
 * دو Connection Pool با دو نقش دیتابیس:
 *  - app    : نقش botshop_app — تابع RLS است؛ همه مسیرهای مستاجرمحور فقط از withTenant استفاده می‌کنند.
 *  - system : نقش botshop_system (BYPASSRLS) — فقط برای مسیرهای محدود: ورود، شناسایی وب‌هوک، پنل مدیر کل، کارهای زمان‌بندی‌شده.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly app = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  readonly system = new PrismaClient({ datasources: { db: { url: process.env.SYSTEM_DATABASE_URL } } });

  withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (!tenantId) throw new Error('tenantId الزامی است');
    return this.app.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
      return fn(tx);
    }, { timeout: 15_000, maxWait: 5_000 });
  }
  async onModuleDestroy() { await Promise.all([this.app.$disconnect(), this.system.$disconnect()]); }
}
