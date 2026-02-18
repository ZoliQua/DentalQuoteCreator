export type InvoiceStatus = 'draft' | 'sent' | 'storno';
export type InvoiceType = 'normal' | 'advance' | 'final';

export interface InvoiceItemSnapshot {
  name: string;
  unit: string;
  qty: number;
  unitPriceNet: number;
  vatRate: number;
  net: number;
  vat: number;
  gross: number;
}

export interface InvoiceRecord {
  id: string;
  patientId: string;
  quoteId: string;
  quoteNumber?: string;
  quoteName?: string;
  patientName: string;
  szamlazzInvoiceNumber?: string;
  stornoInvoiceNumber?: string;
  status: InvoiceStatus;
  totalGross: number;
  currency: 'HUF' | 'EUR';
  createdAt: string;
  paymentMethod: string;
  fulfillmentDate: string;
  dueDate: string;
  buyer: {
    name: string;
    zip?: string;
    city?: string;
    address?: string;
    email?: string;
  };
  invoiceType?: InvoiceType;
  items: InvoiceItemSnapshot[];
  xmlPreview?: string;
  rawResponse?: string;
  pdfBase64?: string;
  stornoPdfBase64?: string;
}
