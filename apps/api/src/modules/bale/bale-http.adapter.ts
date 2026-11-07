import { InboundEvent, InvoiceRequest, MessengerAdapter, NotVerifiedError, OutboundText } from './messenger.types';

/**
 * ⚠️ وضعیت: «تأییدنشده با مستندات رسمی».
 * مستندات رسمی https://docs.bale.ai/ هنگام ساخت این کد از محیط توسعه قابل دسترسی نبود.
 * بنابراین فرض‌های زیر باید پیش از فعال‌سازی با مستندات و یک ربات آزمایشی راستی‌آزمایی شوند:
 *   - قالب URL:  {baseUrl}/bot{token}/{method}  (فرض مبتنی بر سازگاری با Bot API؛ تأییدنشده)
 *   - نام متدهای getMe / setWebhook / deleteWebhook / sendMessage / answerCallbackQuery
 *   - قالب JSON در Update ها (message, callback_query, ...) در parseUpdate
 * پرداخت (sendInvoice / PreCheckout / SuccessfulPayment / استعلام) عمداً غیرفعال است تا زمان تأیید رسمی.
 */
export interface BaleHttpOptions { token: string; baseUrl: string; fetchImpl?: typeof fetch; timeoutMs?: number; enablePayments?: boolean; }

export class BaleHttpAdapter implements MessengerAdapter {
  readonly channel = 'BALE' as const;
  get paymentsVerified() { return false; }
  private readonly f: typeof fetch;
  constructor(private readonly o: BaleHttpOptions) { this.f = o.fetchImpl ?? fetch; }

  private async call<T>(method: string, body?: object): Promise<T> {
    const res = await this.f(`${this.o.baseUrl.replace(/\/$/, '')}/bot${this.o.token}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(this.o.timeoutMs ?? 10_000),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string; error_code?: number };
    if (!res.ok || json.ok === false) {
      // توکن هرگز در پیام خطا یا لاگ نمی‌آید.
      throw new Error(`Bale API ${method} failed: HTTP ${res.status} ${json.description ?? ''}`.trim());
    }
    return json.result as T;
  }
  async getMe() { const r = await this.call<{ id: number | string; username?: string }>('getMe'); return { id: String(r.id), username: r.username }; }
  async setWebhook(url: string) { await this.call('setWebhook', { url }); }
  async deleteWebhook() { await this.call('deleteWebhook'); }
  async sendText(m: OutboundText) {
    const reply_markup = m.buttons ? { inline_keyboard: m.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.callbackData, url: b.url, web_app: b.webAppUrl ? { url: b.webAppUrl } : undefined }))) } : undefined;
    const r = await this.call<{ message_id: number | string }>('sendMessage', { chat_id: m.chatId, text: m.text, reply_markup });
    return { providerMessageId: String(r.message_id) };
  }
  async answerCallbackQuery(callbackId: string, text?: string) { await this.call('answerCallbackQuery', { callback_query_id: callbackId, text }); }
  async sendInvoice(_r: InvoiceRequest): Promise<{ providerMessageId: string }> { throw new NotVerifiedError('sendInvoice'); }
  async answerPreCheckout(): Promise<void> { throw new NotVerifiedError('answerPreCheckoutQuery'); }
  parseUpdate(raw: any): InboundEvent {
    const id = raw?.update_id !== undefined ? String(raw.update_id) : '';
    if (!id) return { kind: 'unknown', eventId: '' };
    if (raw.message?.chat && raw.message?.from)
      return { kind: 'message', eventId: id, chatId: String(raw.message.chat.id), userId: String(raw.message.from.id), username: raw.message.from.username, text: raw.message.text, contactPhone: raw.message.contact?.phone_number };
    if (raw.callback_query?.from)
      return { kind: 'callback_query', eventId: id, callbackId: String(raw.callback_query.id), chatId: String(raw.callback_query.message?.chat?.id ?? raw.callback_query.from.id), userId: String(raw.callback_query.from.id), data: String(raw.callback_query.data ?? '') };
    // pre_checkout_query / successful_payment: عمداً نرمال‌سازی نمی‌شوند تا مستندات رسمی بررسی شود.
    return { kind: 'unknown', eventId: id };
  }
}
