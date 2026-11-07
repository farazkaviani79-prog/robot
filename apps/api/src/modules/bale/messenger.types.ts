/** انواع مستقل از پیام‌رسان؛ هر Adapter (بله، تلگرام، ...) باید به این قالب نرمال‌سازی کند. */
export type Channel = 'BALE' | 'TELEGRAM';
export interface InlineButton { text: string; callbackData?: string; webAppUrl?: string; url?: string; }
export interface OutboundText { chatId: string; text: string; buttons?: InlineButton[][]; }
export interface InvoiceRequest {
  chatId: string; title: string; description: string;
  /** شناسه یکتای پرداخت داخلی؛ در رویدادهای بعدی برمی‌گردد. */
  invoicePayload: string;
  /** مبلغ کل به ریال (عدد صحیح). */
  amountRial: bigint;
  items: { label: string; amountRial: bigint }[];
}
export type InboundEvent =
  | { kind: 'message'; eventId: string; chatId: string; userId: string; username?: string; text?: string; contactPhone?: string }
  | { kind: 'callback_query'; eventId: string; callbackId: string; chatId: string; userId: string; data: string }
  | { kind: 'pre_checkout_query'; eventId: string; queryId: string; userId: string; invoicePayload: string; amountRial: bigint; currency: string }
  | { kind: 'successful_payment'; eventId: string; chatId: string; userId: string; invoicePayload: string; amountRial: bigint; currency: string; providerChargeId: string }
  | { kind: 'unknown'; eventId: string };

export interface MessengerAdapter {
  readonly channel: Channel;
  /** آیا این Adapter تأیید پرداخت را مطابق مستندات رسمی پیاده‌سازی و فعال کرده است؟ */
  readonly paymentsVerified: boolean;
  getMe(): Promise<{ id: string; username?: string }>;
  setWebhook(url: string): Promise<void>;
  deleteWebhook(): Promise<void>;
  sendText(msg: OutboundText): Promise<{ providerMessageId: string }>;
  answerCallbackQuery(callbackId: string, text?: string): Promise<void>;
  sendInvoice(req: InvoiceRequest): Promise<{ providerMessageId: string }>;
  /** پاسخ PreCheckout باید در مهلت اعلام‌شده‌ی بله ارسال شود (مقدار دقیق: مستندات رسمی — تأییدنشده). */
  answerPreCheckout(queryId: string, ok: boolean, errorMessage?: string): Promise<void>;
  parseUpdate(raw: unknown): InboundEvent;
}
export class NotVerifiedError extends Error {
  constructor(what: string) { super(`${what}: مطابق مستندات رسمی بله هنوز تأیید و فعال نشده است`); this.name = 'NotVerifiedError'; }
}
