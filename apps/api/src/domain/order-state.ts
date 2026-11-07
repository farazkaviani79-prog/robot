export type OrderStatus = 'PENDING' | 'AWAITING_PAYMENT' | 'PAID' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';

const T: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'REFUNDED'],
  PROCESSING: ['SHIPPED', 'REFUNDED'],
  SHIPPED: ['COMPLETED', 'REFUNDED'],
  COMPLETED: ['REFUNDED'],
  CANCELLED: [],
  REFUNDED: [],
};
export const canTransition = (from: OrderStatus, to: OrderStatus) => T[from].includes(to);
export function assertTransition(from: OrderStatus, to: OrderStatus, opts: { viaVerifiedPayment?: boolean } = {}): void {
  if (!canTransition(from, to)) throw new Error(`تغییر وضعیت سفارش از ${from} به ${to} مجاز نیست`);
  // قاعده حیاتی: فقط مسیر تأیید معتبر پرداخت می‌تواند سفارش را PAID کند.
  if (to === 'PAID' && !opts.viaVerifiedPayment) throw new Error('سفارش فقط پس از تأیید معتبر پرداخت می‌تواند «پرداخت‌شده» شود');
}
export const faStatus: Record<OrderStatus, string> = {
  PENDING: 'در انتظار ثبت', AWAITING_PAYMENT: 'در انتظار پرداخت', PAID: 'پرداخت‌شده', PROCESSING: 'در حال پردازش',
  SHIPPED: 'ارسال‌شده', COMPLETED: 'تکمیل‌شده', CANCELLED: 'لغوشده', REFUNDED: 'بازپرداخت‌شده',
};
