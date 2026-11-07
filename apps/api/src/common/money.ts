/**
 * همه مبالغ در BotShop «ریال» و به‌صورت عدد صحیح (bigint) هستند.
 * در JSON، مبلغ به‌صورت رشته‌ی عددی ("1500000") منتقل می‌شود تا دقت از بین نرود.
 */
export type Rial = bigint;
export const CURRENCY = 'IRR' as const;

export function parseRial(input: unknown): Rial {
  if (typeof input === 'bigint') return assertNonNegative(input);
  if (typeof input === 'number') {
    if (!Number.isSafeInteger(input)) throw new RangeError('مبلغ باید عدد صحیح و ایمن باشد');
    return assertNonNegative(BigInt(input));
  }
  if (typeof input === 'string' && /^\d{1,18}$/.test(input)) return BigInt(input);
  throw new TypeError('مبلغ نامعتبر است');
}
function assertNonNegative(v: bigint): bigint {
  if (v < 0n) throw new RangeError('مبلغ نمی‌تواند منفی باشد');
  return v;
}
export const rialToJson = (v: Rial): string => v.toString();

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
export function toPersianDigits(s: string): string { return s.replace(/\d/g, (d) => FA_DIGITS[Number(d)]); }
export function formatRial(v: Rial): string {
  return toPersianDigits(v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')) + ' ریال';
}
export function formatToman(v: Rial): string {
  return toPersianDigits((v / 10n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '٬')) + ' تومان';
}
