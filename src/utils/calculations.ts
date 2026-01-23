import { Quote, QuoteItem, QuoteTotals } from '../types';

/**
 * Calculate the total for a single line item
 * Formula: qty * unitPrice - lineDiscount
 */
export function calculateLineTotal(item: QuoteItem): number {
  const baseTotal = item.quoteQty * item.quoteUnitPriceGross;

  if (item.quoteLineDiscountValue <= 0) {
    return baseTotal;
  }

  if (item.quoteLineDiscountType === 'percent') {
    return baseTotal * (1 - item.quoteLineDiscountValue / 100);
  }

  // Fixed discount
  return Math.max(0, baseTotal - item.quoteLineDiscountValue);
}

/**
 * Calculate the line discount amount (for display)
 */
export function calculateLineDiscountAmount(item: QuoteItem): number {
  const baseTotal = item.quoteQty * item.quoteUnitPriceGross;

  if (item.quoteLineDiscountValue <= 0) {
    return 0;
  }

  if (item.quoteLineDiscountType === 'percent') {
    return baseTotal * (item.quoteLineDiscountValue / 100);
  }

  return Math.min(baseTotal, item.quoteLineDiscountValue);
}

/**
 * Calculate all totals for a quote
 */
export function calculateQuoteTotals(quote: Quote): QuoteTotals {
  // Calculate subtotal (sum of all line totals before global discount)
  const lineSubtotals = quote.items.map((item) => item.quoteQty * item.quoteUnitPriceGross);
  const grossSubtotal = lineSubtotals.reduce((sum, val) => sum + val, 0);

  // Calculate total line discounts
  const lineDiscounts = quote.items.reduce((sum, item) => sum + calculateLineDiscountAmount(item), 0);

  // Subtotal after line discounts
  const subtotal = grossSubtotal - lineDiscounts;

  // Calculate global discount
  let globalDiscount = 0;
  if (quote.globalDiscountValue > 0) {
    if (quote.globalDiscountType === 'percent') {
      globalDiscount = subtotal * (quote.globalDiscountValue / 100);
    } else {
      globalDiscount = Math.min(subtotal, quote.globalDiscountValue);
    }
  }

  // Final total (rounded to whole forints)
  const total = Math.round(subtotal - globalDiscount);

  return {
    subtotal: Math.round(grossSubtotal),
    lineDiscounts: Math.round(lineDiscounts),
    globalDiscount: Math.round(globalDiscount),
    total: Math.max(0, total),
  };
}

/**
 * Calculate total discount amount (line + global)
 */
export function calculateTotalDiscount(quote: Quote): number {
  const totals = calculateQuoteTotals(quote);
  return totals.lineDiscounts + totals.globalDiscount;
}
