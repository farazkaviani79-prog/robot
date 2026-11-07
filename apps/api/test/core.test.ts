import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRial, formatToman, parseRial } from '../src/common/money';
import { SecretBox, hashPassword, verifyPassword } from '../src/common/crypto';
import { signJwt, verifyJwt } from '../src/common/jwt';
import { computeOrderTotals } from '../src/domain/order-pricing';
import { assertTransition, canTransition } from '../src/domain/order-state';
import { decidePaymentEvent, PaymentRecord } from '../src/domain/payment-rules';

const line = (q: number, u: bigint, id = 'v1') => ({ variantId: id, productId: 'p', productName: 'کالا', variantTitle: 'پیش‌فرض', sku: id, quantity: q, unitAmount: u });

test('money: فقط عدد صحیح نامنفی', () => {
  assert.equal(parseRial('1500000'), 1500000n);
  assert.throws(() => parseRial(1.5)); assert.throws(() => parseRial(-1)); assert.throws(() => parseRial('12.5')); assert.throws(() => parseRial('1e6'));
  assert.equal(formatRial(1500000n), '۱٬۵۰۰٬۰۰۰ ریال');
  assert.equal(formatToman(1500000n), '۱۵۰٬۰۰۰ تومان');
});

test('pricing: مبلغ از اقلام محاسبه می‌شود و بزرگ‌ها سرریز نمی‌کنند', () => {
  const t = computeOrderTotals([line(2, 1_000_000n), line(1, 250_000n, 'v2')], { shippingAmount: 50_000n });
  assert.equal(t.subtotalAmount, 2_250_000n); assert.equal(t.totalAmount, 2_300_000n);
  const big = computeOrderTotals([line(9_999, 999_999_999_999n)]);
  assert.equal(big.totalAmount, 9_999n * 999_999_999_999n); // بدون خطای Number
});
test('pricing: تخفیف درصدی/ثابت سقف‌دار و ورودی بد رد می‌شود', () => {
  assert.equal(computeOrderTotals([line(1, 1000n)], { discount: { kind: 'PERCENT', value: 10 } }).discountAmount, 100n);
  assert.equal(computeOrderTotals([line(1, 1000n)], { discount: { kind: 'FIXED', value: 5000n } }).totalAmount, 0n);
  assert.throws(() => computeOrderTotals([])); assert.throws(() => computeOrderTotals([line(0, 1n)])); assert.throws(() => computeOrderTotals([line(1, -1n)]));
  assert.throws(() => computeOrderTotals([line(1, 1n)], { discount: { kind: 'PERCENT', value: 101 } }));
});

test('وضعیت سفارش: PAID فقط با پرداخت تأییدشده', () => {
  assert.ok(canTransition('PENDING', 'AWAITING_PAYMENT'));
  assert.throws(() => assertTransition('AWAITING_PAYMENT', 'PAID'));
  assert.doesNotThrow(() => assertTransition('AWAITING_PAYMENT', 'PAID', { viaVerifiedPayment: true }));
  assert.throws(() => assertTransition('PENDING', 'PAID', { viaVerifiedPayment: true }));
  assert.throws(() => assertTransition('CANCELLED', 'PAID', { viaVerifiedPayment: true }));
  assert.throws(() => assertTransition('SHIPPED', 'PENDING'));
});

const pay = (over: Partial<PaymentRecord> = {}): PaymentRecord => ({ id: 'p1', status: 'PENDING', amount: 1000n, currency: 'IRR', invoicePayload: 'inv-1', ...over });
test('پرداخت: PreCheckout هرگز پرداخت را PAID نمی‌کند', () => {
  const d = decidePaymentEvent(pay(), { kind: 'PRECHECKOUT', invoicePayload: 'inv-1', amount: 1000n, currency: 'IRR' });
  assert.deepEqual(d, { action: 'ALLOW_PRECHECKOUT' });
});
test('پرداخت: مبلغ/واحد/payload ناهمخوان رد می‌شود', () => {
  assert.equal(decidePaymentEvent(pay(), { kind: 'PRECHECKOUT', invoicePayload: 'inv-1', amount: 999n, currency: 'IRR' }).action, 'REJECT_PRECHECKOUT');
  assert.equal(decidePaymentEvent(pay(), { kind: 'SUCCESSFUL_PAYMENT', invoicePayload: 'inv-1', amount: 1000n, currency: 'IRT', providerRef: 'x' }).action, 'REJECT');
  assert.equal(decidePaymentEvent(pay(), { kind: 'SUCCESSFUL_PAYMENT', invoicePayload: 'other', amount: 1000n, currency: 'IRR', providerRef: 'x' }).action, 'REJECT');
  assert.equal(decidePaymentEvent(pay(), { kind: 'SUCCESSFUL_PAYMENT', invoicePayload: 'inv-1', amount: 1000n, currency: 'IRR' }).action, 'REJECT'); // بدون شناسه تراکنش
});
test('پرداخت: SuccessfulPayment معتبر → PAID؛ تکرار → نادیده', () => {
  const e = { kind: 'SUCCESSFUL_PAYMENT' as const, invoicePayload: 'inv-1', amount: 1000n, currency: 'IRR', providerRef: 'chg-1' };
  assert.deepEqual(decidePaymentEvent(pay(), e), { action: 'MARK_PAID', providerRef: 'chg-1' });
  assert.equal(decidePaymentEvent(pay({ status: 'PAID' }), e).action, 'IGNORE_DUPLICATE');
  assert.equal(decidePaymentEvent(pay({ status: 'PAID' }), { kind: 'FAILED', invoicePayload: 'inv-1' }).action, 'REJECT');
  assert.equal(decidePaymentEvent(pay({ status: 'CANCELLED' }), e).action, 'REJECT');
});

test('SecretBox: رمزنگاری رفت‌وبرگشتی و تشخیص دستکاری', () => {
  const key = Buffer.alloc(32, 7).toString('base64'); const box = new SecretBox(key);
  const enc = box.encrypt('123456:BOT-TOKEN'); assert.ok(!enc.includes('BOT-TOKEN')); assert.equal(box.decrypt(enc), '123456:BOT-TOKEN');
  assert.notEqual(box.encrypt('x'), box.encrypt('x')); // IV تصادفی
  const parts = enc.split('.'); parts[3] = Buffer.from('tampered!!!!!!!!!!!!').toString('base64');
  assert.throws(() => box.decrypt(parts.join('.')));
  assert.throws(() => new SecretBox(Buffer.alloc(16).toString('base64')));
});
test('رمز عبور: scrypt با Salt و مقایسه صحیح', async () => {
  const h = await hashPassword('رمز-قوی-۱۲۳'); assert.ok(h.startsWith('scrypt$'));
  assert.equal(await verifyPassword('رمز-قوی-۱۲۳', h), true); assert.equal(await verifyPassword('غلط', h), false);
  assert.notEqual(h, await hashPassword('رمز-قوی-۱۲۳'));
});
test('JWT: امضا، انقضا، alg=none و دستکاری', () => {
  const s = 'secret-secret-secret-secret-secret!'; const t = signJwt({ sub: 'u1', tid: 't1', role: 'OWNER' }, s, 60, 1_000_000);
  assert.equal(verifyJwt(t, s, 1_000_000 + 30_000)?.sub, 'u1');
  assert.equal(verifyJwt(t, s, 1_000_000 + 61_000), null);
  assert.equal(verifyJwt(t, 'other-secret', 1_000_000), null);
  const [h, b] = t.split('.'); const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  assert.equal(verifyJwt(`${none}.${b}.`, s, 1_000_000), null);
  const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9e9 })).toString('base64url');
  assert.equal(verifyJwt(`${h}.${forged}.${t.split('.')[2]}`, s, 1_000_000), null);
});
