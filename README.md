# BotShop — Starter

BotShop — پلتفرم SaaS فروشگاه‌ساز برای پیام‌رسان بله (چندمستاجری). **وضعیت دقیق: [STATUS.md](STATUS.md)** — معماری: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — بله/پرداخت: [docs/decisions/0001-bale-payments.md](docs/decisions/0001-bale-payments.md).

محصول هنوز کامل نیست.

## فناوری‌ها
- API: NestJS + TypeScript
- پنل: Next.js + React
- Database: PostgreSQL
- Queue: Redis (برای مراحل بعد)
- ORM: Prisma
- اجرای زیرساخت: Docker Compose

## پیش‌نیازها
- Windows 10/11 نسخه 64-bit
- Node.js 22 LTS
- Git for Windows
- Docker Desktop و WSL 2 (پس از بررسی نسخه دقیق ویندوز)

فعلاً Docker نصب نکنید تا نسخه Windows با `winver` بررسی شود.

## اجرای محلی پس از آماده‌سازی سیستم
1. از `.env.example` یک کپی با نام `.env` بسازید و مقادیر CHANGE_ME را با `openssl rand` پر کنید.
2. در PowerShell از ریشه پروژه اجرا کنید:
   `docker compose -f infra/docker-compose.yml up -d`
3. سپس:
   `npm install`
   `npm run db:migrate` و `npm run db:seed`
   `npm run dev`
4. پنل: http://localhost:3000
5. سلامت API: http://localhost:4000/health

## امنیت
- `.env` را هرگز در GitHub بارگذاری نکنید.
- توکن واقعی ربات و کلید پرداخت را در چت یا کد عمومی قرار ندهید.
- فعلاً پرداخت و اتصال واقعی بله فعال نیستند (BALE_MODE=mock).
- قبل از پیاده‌سازی اتصال بله، مستندات/قابلیت‌های واقعی API با یک ربات آزمایشی بررسی می‌شود.

## GitHub
مخزن را Private بسازید. سپس:
`git init`
`git add .`
`git commit -m "chore: initialize BotShop"`
`git branch -M main`
`git remote add origin YOUR_PRIVATE_REPOSITORY_URL`
`git push -u origin main`

## نکته
این پروژه به‌صورت Modular Monolith آغاز می‌شود و داده‌های تجاری از ابتدا tenant-scoped طراحی می‌شوند. واحد پولی (ریال/تومان) پیش از اتصال پرداخت باید قطعی شود.
