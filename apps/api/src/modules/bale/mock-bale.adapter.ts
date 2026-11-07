import { InboundEvent, InvoiceRequest, MessengerAdapter, OutboundText } from './messenger.types';

/** Adapter آزمایشی؛ همه‌چیز در حافظه است و برای تست و توسعه بدون ربات واقعی استفاده می‌شود. */
export class MockBaleAdapter implements MessengerAdapter {
  readonly channel = 'BALE' as const;
  readonly paymentsVerified = true; // فقط در Mock
  sent: OutboundText[] = []; invoices: InvoiceRequest[] = []; precheckoutAnswers: { queryId: string; ok: boolean; error?: string }[] = [];
  webhookUrl: string | null = null; private seq = 0;
  failNextSend = false;
  async getMe() { return { id: 'mock-bot', username: 'mock_bot' }; }
  async setWebhook(url: string) { this.webhookUrl = url; }
  async deleteWebhook() { this.webhookUrl = null; }
  async sendText(m: OutboundText) {
    if (this.failNextSend) { this.failNextSend = false; throw new Error('mock send failure'); }
    this.sent.push(m); return { providerMessageId: `m${++this.seq}` };
  }
  async answerCallbackQuery() {}
  async sendInvoice(r: InvoiceRequest) { this.invoices.push(r); return { providerMessageId: `inv${++this.seq}` }; }
  async answerPreCheckout(queryId: string, ok: boolean, error?: string) { this.precheckoutAnswers.push({ queryId, ok, error }); }
  /** قالب Update آزمایشی (قالب داخلی Mock، نه قالب بله). */
  parseUpdate(raw: any): InboundEvent {
    const id = String(raw?.update_id ?? '');
    if (!id) return { kind: 'unknown', eventId: '' };
    if (raw.message) return { kind: 'message', eventId: id, chatId: String(raw.message.chat.id), userId: String(raw.message.from.id), username: raw.message.from.username, text: raw.message.text };
    if (raw.callback_query) return { kind: 'callback_query', eventId: id, callbackId: String(raw.callback_query.id), chatId: String(raw.callback_query.chat_id), userId: String(raw.callback_query.from.id), data: String(raw.callback_query.data) };
    if (raw.pre_checkout_query) { const q = raw.pre_checkout_query; return { kind: 'pre_checkout_query', eventId: id, queryId: String(q.id), userId: String(q.from.id), invoicePayload: String(q.invoice_payload), amountRial: BigInt(q.total_amount), currency: String(q.currency) }; }
    if (raw.successful_payment) { const s = raw.successful_payment; return { kind: 'successful_payment', eventId: id, chatId: String(s.chat_id), userId: String(s.from_id), invoicePayload: String(s.invoice_payload), amountRial: BigInt(s.total_amount), currency: String(s.currency), providerChargeId: String(s.provider_payment_charge_id) }; }
    return { kind: 'unknown', eventId: id };
  }
}
