import { hmacHex, safeEqualHex } from '../../common/crypto';
import { createHmac } from 'node:crypto';

/**
 * اعتبارسنجی initData مینی‌اپ — فقط در سرور.
 *
 * ⚠️ الگوریتم زیر «سازگار با الگوی Telegram WebApp» است (HMAC-SHA256 با کلید مشتق از "WebAppData" و توکن ربات).
 * مستندات رسمی بله (https://docs.bale.ai/miniapp) از محیط توسعه قابل دسترسی نبود؛ تا زمانی که قالب دقیق
 * (نام فیلدها، الگوریتم، مدت اعتبار) با مستندات و ربات آزمایشی تأیید نشده، این مسیر را «تأییدنشده» در نظر بگیرید
 * و در محیط واقعی فعال نکنید (INITDATA_VERIFIED=true فقط پس از راستی‌آزمایی).
 */
export interface VerifiedInitData { userId: string; username?: string; firstName?: string; authDate: number; raw: Record<string, string>; }
export type InitDataResult = { ok: true; data: VerifiedInitData } | { ok: false; reason: 'missing_hash' | 'bad_signature' | 'expired' | 'malformed' | 'no_user' };

export function validateInitData(initData: string, botToken: string, opts: { maxAgeSeconds?: number; now?: number } = {}): InitDataResult {
  if (!initData || initData.length > 8192) return { ok: false, reason: 'malformed' };
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'missing_hash' };
  params.delete('hash');
  const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`);
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = hmacHex(secret, pairs.join('\n'));
  if (!safeEqualHex(expected, hash)) return { ok: false, reason: 'bad_signature' };
  const authDate = Number(params.get('auth_date'));
  if (!Number.isInteger(authDate)) return { ok: false, reason: 'malformed' };
  const now = Math.floor((opts.now ?? Date.now()) / 1000);
  if (now - authDate > (opts.maxAgeSeconds ?? 3600) || authDate - now > 60) return { ok: false, reason: 'expired' };
  let user: any;
  try { user = JSON.parse(params.get('user') ?? ''); } catch { return { ok: false, reason: 'no_user' }; }
  if (user?.id === undefined) return { ok: false, reason: 'no_user' };
  return { ok: true, data: { userId: String(user.id), username: user.username, firstName: user.first_name, authDate, raw: Object.fromEntries(params.entries()) } };
}

/** ابزار تست: ساخت initData امضاشده. */
export function signInitDataForTest(fields: Record<string, string>, botToken: string): string {
  const pairs = Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`);
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = hmacHex(secret, pairs.join('\n'));
  return new URLSearchParams({ ...fields, hash }).toString();
}
