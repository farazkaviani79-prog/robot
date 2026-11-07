/** اعتبارسنجی متغیرهای محیطی در زمان بوت؛ اگر مقداری ناامن یا خالی باشد برنامه بالا نمی‌آید. */
export interface Env {
  nodeEnv: 'development' | 'test' | 'production';
  port: number; databaseUrl: string; systemDatabaseUrl: string; redisUrl: string;
  jwtSecret: string; encryptionKey: string; corsOrigins: string[];
  publicApiUrl: string; miniAppBaseUrl: string;
  baleMode: 'mock' | 'http'; baleApiBaseUrl: string; initDataVerified: boolean;
  reservationTtlMinutes: number;
}
export function loadEnv(src: NodeJS.ProcessEnv = process.env): Env {
  const need = (k: string) => { const v = src[k]; if (!v) throw new Error(`متغیر محیطی ${k} تنظیم نشده است`); return v; };
  const nodeEnv = (src.NODE_ENV as Env['nodeEnv']) ?? 'development';
  const jwtSecret = need('JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET باید حداقل ۳۲ کاراکتر باشد');
  if (nodeEnv === 'production' && /change[-_ ]?me|dev[-_ ]?only/i.test(jwtSecret + (src.APP_ENCRYPTION_KEY ?? ''))) throw new Error('مقادیر نمونه در محیط Production مجاز نیست');
  const baleMode = (src.BALE_MODE ?? 'mock') as Env['baleMode'];
  if (nodeEnv === 'production' && baleMode === 'mock') throw new Error('BALE_MODE=mock در Production مجاز نیست');
  return {
    nodeEnv, port: Number(src.API_PORT ?? 4000),
    databaseUrl: need('DATABASE_URL'), systemDatabaseUrl: need('SYSTEM_DATABASE_URL'), redisUrl: need('REDIS_URL'),
    jwtSecret, encryptionKey: need('APP_ENCRYPTION_KEY'),
    corsOrigins: (src.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()).filter(Boolean),
    publicApiUrl: need('PUBLIC_API_URL'), miniAppBaseUrl: src.MINIAPP_BASE_URL ?? 'http://localhost:3000/miniapp',
    baleMode, baleApiBaseUrl: src.BALE_API_BASE_URL ?? '', initDataVerified: src.INITDATA_VERIFIED === 'true',
    reservationTtlMinutes: Number(src.RESERVATION_TTL_MINUTES ?? 15),
  };
}
