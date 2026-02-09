import type { InvoiceRecord } from '../../types/invoice';

const STORAGE_KEY = 'invoices';

const safeParse = (raw: string | null): InvoiceRecord[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as InvoiceRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const listInvoices = (): InvoiceRecord[] => {
  return safeParse(localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

export const saveInvoice = (record: InvoiceRecord): void => {
  const current = listInvoices();
  const next = [record, ...current.filter((item) => item.id !== record.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
  localStorage.removeItem(STORAGE_KEY);
};
