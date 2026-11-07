import { CURRENCY, Rial } from '../common/money';

export interface PricedLine { variantId: string; productId: string; productName: string; variantTitle: string; sku: string; quantity: number; unitAmount: Rial; }
export interface OrderTotals {
  currency: typeof CURRENCY;
  lines: (PricedLine & { lineAmount: Rial })[];
  subtotalAmount: Rial; discountAmount: Rial; shippingAmount: Rial; totalAmount: Rial;
}
export interface Discount { kind: 'PERCENT' | 'FIXED'; value: number | Rial; }

/**
 * مبلغ سفارش همیشه از اقلام محاسبه می‌شود (هرگز از مقدار ارسالی کلاینت).
 * قیمت واحد باید از دیتابیس خوانده و در همین لحظه Snapshot شود.
 */
export function computeOrderTotals(lines: PricedLine[], opts: { discount?: Discount; shippingAmount?: Rial } = {}): OrderTotals {
  if (lines.length === 0) throw new RangeError('سفارش باید حداقل یک قلم داشته باشد');
  const priced = lines.map((l) => {
    if (!Number.isInteger(l.quantity) || l.quantity <= 0 || l.quantity > 10_000) throw new RangeError('تعداد نامعتبر است');
    if (l.unitAmount < 0n) throw new RangeError('قیمت نامعتبر است');
    return { ...l, lineAmount: l.unitAmount * BigInt(l.quantity) };
  });
  const subtotal = priced.reduce((s, l) => s + l.lineAmount, 0n);
  let discount = 0n;
  if (opts.discount) {
    if (opts.discount.kind === 'PERCENT') {
      const pct = Number(opts.discount.value);
      if (!Number.isInteger(pct) || pct < 0 || pct > 100) throw new RangeError('درصد تخفیف نامعتبر است');
      discount = (subtotal * BigInt(pct)) / 100n; // گرد کردن به پایین؛ به نفع مشتری نیست، به نفع قطعیت محاسبه
    } else {
      discount = BigInt(opts.discount.value);
    }
    if (discount < 0n) throw new RangeError('تخفیف نامعتبر است');
    if (discount > subtotal) discount = subtotal;
  }
  const shipping = opts.shippingAmount ?? 0n;
  if (shipping < 0n) throw new RangeError('هزینه ارسال نامعتبر است');
  return { currency: CURRENCY, lines: priced, subtotalAmount: subtotal, discountAmount: discount, shippingAmount: shipping, totalAmount: subtotal - discount + shipping };
}
