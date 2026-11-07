import test from 'node:test';
import assert from 'node:assert/strict';
import { signInitDataForTest, validateInitData } from '../src/modules/bale/init-data';
import { BaleHttpAdapter } from '../src/modules/bale/bale-http.adapter';
import { MockBaleAdapter } from '../src/modules/bale/mock-bale.adapter';
import { NotVerifiedError } from '../src/modules/bale/messenger.types';

const TOKEN = '12345:SECRET-BOT-TOKEN'; const NOW = 1_800_000_000_000;
const good = (over: Record<string, string> = {}) => signInitDataForTest({ auth_date: String(NOW / 1000 - 10), user: JSON.stringify({ id: 42, username: 'ali', first_name: 'علی' }), query_id: 'q1', ...over }, TOKEN);

test('initData: معتبر', () => {
  const r = validateInitData(good(), TOKEN, { now: NOW }); assert.ok(r.ok);
  if (r.ok) { assert.equal(r.data.userId, '42'); assert.equal(r.data.firstName, 'علی'); }
});
test('initData: امضای غلط/توکن دیگر/دستکاری فیلد/بدون hash رد می‌شود', () => {
  assert.deepEqual(validateInitData(good(), 'other:token', { now: NOW }), { ok: false, reason: 'bad_signature' });
  assert.deepEqual(validateInitData(good().replace('42', '43').replace('%2242%22', '%2243%22'), TOKEN, { now: NOW }), { ok: false, reason: 'bad_signature' });
  assert.deepEqual(validateInitData('auth_date=1&user=%7B%7D', TOKEN, { now: NOW }), { ok: false, reason: 'missing_hash' });
  assert.deepEqual(validateInitData('', TOKEN, { now: NOW }), { ok: false, reason: 'malformed' });
});
test('initData: منقضی‌شده و تاریخ آینده رد می‌شود', () => {
  assert.deepEqual(validateInitData(good({ auth_date: String(NOW / 1000 - 7200) }), TOKEN, { now: NOW }), { ok: false, reason: 'expired' });
  assert.deepEqual(validateInitData(good({ auth_date: String(NOW / 1000 + 3600) }), TOKEN, { now: NOW }), { ok: false, reason: 'expired' });
});

test('BaleHttpAdapter: توکن در URL است ولی هرگز در پیام خطا نمی‌آید', async () => {
  let calledUrl = '';
  const fake = (async (url: string) => { calledUrl = url; return new Response(JSON.stringify({ ok: false, description: 'Unauthorized' }), { status: 401 }); }) as unknown as typeof fetch;
  const a = new BaleHttpAdapter({ token: TOKEN, baseUrl: 'https://example.invalid', fetchImpl: fake });
  await assert.rejects(a.getMe(), (e: Error) => { assert.ok(!e.message.includes('SECRET-BOT-TOKEN')); return /401/.test(e.message); });
  assert.ok(calledUrl.endsWith(`/bot${TOKEN}/getMe`));
});
test('BaleHttpAdapter: پرداخت تا زمان تأیید رسمی غیرفعال است', async () => {
  const a = new BaleHttpAdapter({ token: TOKEN, baseUrl: 'https://example.invalid' });
  assert.equal(a.paymentsVerified, false);
  await assert.rejects(a.sendInvoice({ chatId: '1', title: 't', description: 'd', invoicePayload: 'p', amountRial: 1n, items: [] }), NotVerifiedError);
  await assert.rejects(a.answerPreCheckout(), NotVerifiedError);
});
test('BaleHttpAdapter/Mock: نرمال‌سازی Update', () => {
  const a = new BaleHttpAdapter({ token: TOKEN, baseUrl: 'https://example.invalid' });
  const e = a.parseUpdate({ update_id: 9, message: { chat: { id: 5 }, from: { id: 6, username: 'u' }, text: '/start' } });
  assert.deepEqual(e, { kind: 'message', eventId: '9', chatId: '5', userId: '6', username: 'u', text: '/start', contactPhone: undefined });
  assert.equal(a.parseUpdate({}).kind, 'unknown');
  const m = new MockBaleAdapter();
  const s = m.parseUpdate({ update_id: 1, successful_payment: { chat_id: 1, from_id: 2, invoice_payload: 'inv', total_amount: '1000', currency: 'IRR', provider_payment_charge_id: 'c1' } });
  assert.equal(s.kind, 'successful_payment'); if (s.kind === 'successful_payment') assert.equal(s.amountRial, 1000n);
});
