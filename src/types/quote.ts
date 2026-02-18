export type QuoteStatus =
  | 'draft'
  | 'closed'
  | 'rejected'
  | 'started'
  | 'completed';

export type DiscountType = 'percent' | 'fixed';
export type ToothType = 'tooth' | 'quadrant' | 'jaw' | 'region';
export type Quadrant = '1' | '2' | '3' | '4';
export type Jaw = 'upper' | 'lower' | 'both';

export interface QuoteEvent {
  id: string;
  timestamp: string;
  type: 'created' | 'closed' | 'reopened' | 'accepted' | 'acceptance_revoked' | 'rejected' | 'rejection_revoked' | 'completed' | 'completion_revoked' | 'deleted' | 'invoice_created';
  doctorName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceAmount?: number;
  invoiceCurrency?: string;
  invoiceType?: import('./invoice').InvoiceType;
}

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
  treatedArea?: string;
  treatmentSession?: number;
  selectedSurfaces?: string[];
  selectedMaterial?: string;
  resolvedLayers?: string[];
}

export interface Quote {
  quoteId: string;
  quoteNumber: string; // New: ABCD-0001 format
  patientId: string;
  doctorId: string;
  quoteName: string;
  createdAt: string;
  lastStatusChangeAt: string; // New: replaces updatedAt for status changes
  validUntil: string;
  quoteStatus: QuoteStatus; // New: replaces status + acceptanceStatus
  currency: 'HUF' | 'EUR';
  items: QuoteItem[];
  globalDiscountType: DiscountType;
  globalDiscountValue: number;
  commentToPatient: string;
  internalNotes: string;
  expectedTreatments: number;
  events: QuoteEvent[]; // New: event log
  isDeleted?: boolean; // New: soft delete flag
  quoteType?: 'itemized' | 'visual';
  quoteLang?: 'hu' | 'en' | 'de';
}

export interface QuoteTotals {
  subtotal: number;
  lineDiscounts: number;
  globalDiscount: number;
  total: number;
}
