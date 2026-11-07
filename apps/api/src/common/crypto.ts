import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

/** رمزنگاری AES-256-GCM برای توکن ربات و اسرار. کلید ۳۲ بایتی base64 از محیط می‌آید (هرگز در Git نیست). */
export class SecretBox {
  private readonly key: Buffer;
  constructor(base64Key: string, private readonly keyId = 'k1') {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) throw new Error('APP_ENCRYPTION_KEY باید ۳۲ بایت (base64) باشد');
  }
  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.key, iv);
    const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [this.keyId, iv.toString('base64'), c.getAuthTag().toString('base64'), ct.toString('base64')].join('.');
  }
  decrypt(blob: string): string {
    const [, iv, tag, ct] = blob.split('.');
    if (!iv || !tag || !ct) throw new Error('فرمت داده رمزشده نامعتبر است');
    const d = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  }
}

/** هش رمز عبور با scrypt (پارامترهای OWASP-سازگار) و مقایسه زمان‌ثابت. */
const N = 2 ** 15, r = 8, p = 1;
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await scrypt(password, salt, 64, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${dk.toString('base64')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, rr, pp, salt, hash] = stored.split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const nn = Number(n);
  const dk = await scrypt(password, Buffer.from(salt, 'base64'), 64, { N: nn, r: Number(rr), p: Number(pp), maxmem: 128 * nn * Number(rr) * 2 });
  const expected = Buffer.from(hash, 'base64');
  return dk.length === expected.length && timingSafeEqual(dk, expected);
}

export const sha256Hex = (s: string) => createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export function hmacHex(key: string | Buffer, data: string): string { return createHmac('sha256', key).update(data).digest('hex'); }
export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex'), y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
export function safeEqualStr(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
