/** Seed توسعه: پلن‌ها + یک مدیر کل + یک فروشنده نمونه. رمزها از محیط خوانده می‌شوند (در Git نیستند). */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/crypto';
const db = new PrismaClient({ datasources: { db: { url: process.env.SYSTEM_DATABASE_URL } } });
async function main() {
  const plans = [
    { code: 'starter', name: 'شروع', priceAmount: 1_500_000n, limits: { maxStores: 1, maxProducts: 100, maxOrdersPerMonth: 300, maxStaff: 2 } },
    { code: 'pro', name: 'حرفه‌ای', priceAmount: 4_500_000n, limits: { maxStores: 3, maxProducts: 2000, maxOrdersPerMonth: 3000, maxStaff: 10 } },
    { code: 'business', name: 'کسب‌وکار', priceAmount: 12_000_000n, limits: { maxStores: 10, maxProducts: -1, maxOrdersPerMonth: -1, maxStaff: 50 } },
  ];
  for (const p of plans) await db.plan.upsert({ where: { code: p.code }, create: p, update: { name: p.name, priceAmount: p.priceAmount, limits: p.limits } });
  const adminEmail = process.env.SEED_ADMIN_EMAIL, adminPw = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPw) {
    await db.user.upsert({ where: { email: adminEmail }, create: { email: adminEmail, passwordHash: await hashPassword(adminPw), displayName: 'مدیر کل', isPlatformAdmin: true }, update: {} });
    console.log('مدیر کل ساخته/تأیید شد:', adminEmail);
  } else console.log('SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD تنظیم نشده؛ مدیر کل ساخته نشد.');
  console.log('پلن‌ها آماده شد.');
}
main().finally(() => db.$disconnect());
