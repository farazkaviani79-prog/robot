# وضعیت واقعی پروژه (۱۵ آبان ۱۴۰۵)

## اجرا و تأییدشده ✅
| مورد | نتیجه |
|---|---|
| Migrationها (۳۱ جدول، ۲۸ Policy) روی PostgreSQL 16 | بدون خطا اجرا شد |
| `scripts/db-verify.sh` (RLS، FK مرکب، CHECKهای مالی، فقط‌افزودنی، ۲۵ رزرو هم‌زمان برای ۵ عدد، Idempotency پرداخت) | **۲۰ از ۲۰ موفق** |
| `npm run test` — ۱۶ تست واحد (ریال، محاسبه سفارش، ماشین وضعیت، قوانین پرداخت، AES-GCM، scrypt، JWT، initData، Adapter بله) | **۱۶ از ۱۶ موفق** |

## نوشته شده ولی «اجرا/کامپایل نشده» ⚠️
دسترسی به رجیستری npm در محیط ساخت مسدود بود، بنابراین `npm install` اجرا نشد و موارد زیر **هیچ‌وقت کامپایل یا اجرا نشده‌اند** (احتمال خطای نوع/Import وجود دارد):
- تمام لایه NestJS (`apps/api/src/**` به‌جز `common/`، `domain/`، `modules/bale/{init-data,*adapter,messenger.types}.ts`)
- `schema.prisma` (تولیدشده از مدل؛ `prisma validate` و `prisma migrate diff` اجرا نشده)
- پنل Next.js (`apps/web`)
- Docker Compose (Docker daemon در محیط ساخت نبود)
- تست‌های یکپارچگی HTTP و E2E: **نوشته نشده‌اند**

## انجام‌نشده
Mini App (UI مشتری)، صفحات مدیریت موجودی/مشتری/اشتراک/تنظیم اتصال بله در پنل، آپلود تصویر، Backup، مانیتورینگ، تخفیف/کوپن (فقط محاسبه در دامنه)، ارتباط واقعی با بله و پرداخت واقعی (نیازمند تأیید مستندات رسمی؛ `docs/decisions/0001-bale-payments.md`).

## گام بعد (روی سیستم دارای اینترنت/npm)
```
cp .env.example .env     # مقادیر CHANGE_ME را بسازید
docker compose -f infra/docker-compose.yml up -d
npm install
npx --workspace @botshop/api prisma validate
npm run db:migrate && npm run db:seed
npm run test && npm run test:db
npm run build            # خطاهای کامپایل را اینجا رفع می‌کنیم
```
