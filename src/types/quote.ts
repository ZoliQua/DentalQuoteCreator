export type QuoteStatus = 'draft' | 'final' | 'archived';
export type DiscountType = 'percent' | 'fixed';
export type ToothType = 'tooth' | 'quadrant' | 'jaw' | 'region';
export type Quadrant = '1' | '2' | '3' | '4';
export type Jaw = 'upper' | 'lower' | 'both';

export interface QuoteItem {
  lineId: string;
  catalogItemId: string;
  quoteName: string;
  quoteUnit: string;
  quoteUnitPriceGross: number;
  quoteUnitPriceCurrency: 'HUF' | 'EUR';
  quoteQty: number;
  quoteLineDiscountType: DiscountType;
  quoteLineDiscountValue: number;
  toothType?: ToothType;
  toothNum?: string;
  quadrant?: Quadrant;
  jaw?: Jaw;
  treatmentSession?: number;
}

export interface Quote {
  quoteId: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  validUntil: string;
  status: QuoteStatus;
  currency: 'HUF' | 'EUR';
  items: QuoteItem[];
  globalDiscountType: DiscountType;
  globalDiscountValue: number;
  commentToPatient: string;
  internalNotes: string;
  expectedTreatments: number;
}

export interface QuoteTotals {
  subtotal: number;
  lineDiscounts: number;
  globalDiscount: number;
  total: number;
}
