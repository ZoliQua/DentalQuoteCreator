import type { InvoiceRecord } from '../../types/invoice';
import { requestJsonSync } from '../../utils/syncHttp';

const API_PREFIX = '/backend';

export const listInvoices = (): InvoiceRecord[] => {
  try {
    const records = requestJsonSync<InvoiceRecord[]>('GET', `${API_PREFIX}/invoices`);
    return (Array.isArray(records) ? records : []).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
};

export const saveInvoice = (record: InvoiceRecord): void => {
  requestJsonSync('PUT', `${API_PREFIX}/invoices/${record.id}`, record);
};

export const getInvoice = (invoiceId: string): InvoiceRecord | undefined => {
  return listInvoices().find((invoice) => invoice.id === invoiceId);
};

export const getInvoicesByPatient = (patientId: string): InvoiceRecord[] => {
  return listInvoices().filter((invoice) => invoice.patientId === patientId);
};

export const getInvoicesByQuote = (quoteId: string): InvoiceRecord[] => {
  return listInvoices().filter((invoice) => invoice.quoteId === quoteId);
};

export const clearAllInvoices = (): void => {
  requestJsonSync('DELETE', `${API_PREFIX}/invoices`);
};
