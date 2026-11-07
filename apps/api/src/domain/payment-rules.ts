import { Rial } from '../common/money';

/**
 * قوانین تأیید پرداخت (مستقل از درگاه).
 *  - PreCheckout فقط «اجازه ادامه» است و هرگز اثبات پرداخت نیست.
 *  - فقط SuccessfulPayment معتبر (یا استعلام معتبر تراکنش) می‌تواند پرداخت را PAID کند.
 *  - مبلغ، واحد و payload باید با Payment ذخیره‌شده دقیقاً برابر باشد.
 */
export type PaymentEventKind = 'PRECHECKOUT' | 'SUCCESSFUL_PAYMENT' | 'VERIFIED_INQUIRY' | 'FAILED' | 'CANCELLED';
export interface PaymentRecord { id: string; status: 'INITIATED' | 'PENDING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'; amount: Rial; currency: string; invoicePayload: string; }
export interface IncomingPaymentEvent { kind: PaymentEventKind; invoicePayload: string; amount?: Rial; currency?: string; providerRef?: string; }
export type Decision =
  | { action: 'ALLOW_PRECHECKOUT' } | { action: 'REJECT_PRECHECKOUT'; reason: string }
  | { action: 'MARK_PAID'; providerRef: string } | { action: 'MARK_FAILED'; reason: string }
  | { action: 'IGNORE_DUPLICATE' } | { action: 'REJECT'; reason: string };

export function decidePaymentEvent(p: PaymentRecord, e: IncomingPaymentEvent): Decision {
  if (e.invoicePayload !== p.invoicePayload) return { action: 'REJECT', reason: 'payload ناهمخوان' };
  const amountOk = e.amount === undefined ? false : e.amount === p.amount;
  const currencyOk = e.currency === undefined ? false : e.currency === p.currency;
  switch (e.kind) {
    case 'PRECHECKOUT':
      if (p.status !== 'INITIATED' && p.status !== 'PENDING') return { action: 'REJECT_PRECHECKOUT', reason: 'پرداخت در وضعیت قابل‌قبول نیست' };
      if (!amountOk || !currencyOk) return { action: 'REJECT_PRECHECKOUT', reason: 'مبلغ یا واحد پول ناهمخوان' };
      return { action: 'ALLOW_PRECHECKOUT' };
    case 'SUCCESSFUL_PAYMENT':
    case 'VERIFIED_INQUIRY':
      if (p.status === 'PAID') return { action: 'IGNORE_DUPLICATE' };
      if (p.status === 'FAILED' || p.status === 'CANCELLED') return { action: 'REJECT', reason: 'پرداخت پیش‌تر بسته شده است' };
      if (!amountOk || !currencyOk) return { action: 'REJECT', reason: 'مبلغ یا واحد پول ناهمخوان' };
      if (!e.providerRef) return { action: 'REJECT', reason: 'شناسه تراکنش درگاه موجود نیست' };
      return { action: 'MARK_PAID', providerRef: e.providerRef };
    case 'FAILED': case 'CANCELLED':
      return p.status === 'PAID' ? { action: 'REJECT', reason: 'پرداخت موفق را نمی‌توان ناموفق کرد' } : { action: 'MARK_FAILED', reason: e.kind };
  }
}
