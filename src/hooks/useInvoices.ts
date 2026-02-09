import { useMemo } from 'react';
import { getInvoice, getInvoicesByPatient, getInvoicesByQuote, listInvoices, saveInvoice } from '../modules/invoicing/storage';

export function useInvoices() {
  const invoices = useMemo(() => listInvoices(), []);

  return {
    invoices,
    getInvoice,
    getInvoicesByPatient,
    getInvoicesByQuote,
    saveInvoice,
  };
}
