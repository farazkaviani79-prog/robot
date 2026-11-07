# معماری BotShop

Modular Monolith (NestJS) + Next.js + PostgreSQL/Prisma + Redis/BullMQ.

```
apps/api/src
  config/        اعتبارسنجی env (بوت‌شدن با مقدار ناامن ممکن نیست)
  prisma/        دو Pool: app (RLS) و system (BYPASSRLS، فقط مسیرهای محدود)
  auth/          JWT کوتاه‌عمر + Refresh چرخشی، قفل حساب، AuthGuard سراسری (نقش از DB)
  audit/         AuditLog (فقط‌افزودنی)، حذف خودکار فیلدهای حساس
  catalog/ inventory/ orders/ payments/ subscriptions/ reports/ admin/
  domain/        منطق خالص و تست‌شده: محاسبه سفارش، ماشین وضعیت، قوانین پرداخت
  modules/bale/  MessengerAdapter، MockBaleAdapter، BaleHttpAdapter، initData، وب‌هوک، صف، مینی‌اپ
  queue/         Workerهای BullMQ (ورودی، خروجی، انقضای رزرو)
```

## چندمستاجری (۳ لایه)
1. سرویس: `tenantId` فقط از نشست احرازشده؛ هر Query فیلتر `tenantId` دارد.
2. دیتابیس: ستون `tenant_id` + **RLS با FORCE** (`app.tenant_id` برای هر تراکنش با `set_config(...,true)`).
3. کلید خارجی مرکب `(tenant_id, id)`: ارجاع بین‌مستاجری حتی با SQL مستقیم ممکن نیست.
نقش `botshop_app` نمی‌تواند RLS را دور بزند؛ مسیرهای محدود از `botshop_system` استفاده می‌کنند.

## موجودی و سفارش
`UPDATE ... WHERE on_hand - reserved >= qty` اتمیک + CHECK در DB. ثبت سفارش یک تراکنش: قیمت از DB → Snapshot → رزرو → تاریخچه. رزرو منقضی هر دقیقه آزاد می‌شود. قطعی‌سازی فروش فقط پس از پرداخت تأییدشده.

## پول
bigint ریال؛ JSON به‌صورت رشته؛ CHECK: `total = subtotal - discount + shipping`.

## امنیت
AES-256-GCM برای توکن ربات، scrypt برای رمز، Rate limit، helmet، ValidationPipe whitelist، توکن هرگز به مرورگر/لاگ نمی‌رود.
