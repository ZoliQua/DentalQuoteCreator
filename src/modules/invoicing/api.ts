export type InvoiceRequestItem = {
  name: string;
  unit: string;
  qty: number;
  unitPriceNet: number;
  vatRate: number;
  comment?: string;
};

export type InvoiceRequestPayload = {
  seller: {
    name: string;
    bank?: string;
    bankAccount?: string;
    email?: string;
  };
  buyer: {
    name: string;
    zip?: string;
    city?: string;
    address?: string;
    email?: string;
  };
  invoice: {
    paymentMethod: string;
    fulfillmentDate: string;
    dueDate: string;
    issueDate: string;
    currency: 'HUF' | 'EUR';
    comment?: string;
    eInvoice?: boolean;
  };
  items: InvoiceRequestItem[];
};

const postJson = async <T>(url: string, payload: InvoiceRequestPayload): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  const parsed = (data || {}) as { message?: string };
  if (!response.ok) {
    const fallback = `Szamlazz.hu hivas sikertelen (HTTP ${response.status})`;
    throw new Error(parsed.message || fallback);
  }
  return parsed as T;
};

export const previewInvoice = async (payload: InvoiceRequestPayload) => {
  return postJson<{
    mode: 'preview';
    success: boolean;
    xml: string;
    totals: { net: number; vat: number; gross: number };
  }>('/api/szamlazz/preview-invoice', payload);
};

export const createInvoice = async (payload: InvoiceRequestPayload) => {
  return postJson<{
    mode: 'preview' | 'live';
    success: boolean;
    message?: string;
    invoiceNumber?: string | null;
    pdfBase64?: string | null;
    rawResponse?: string | null;
    xml?: string;
    totals?: { net: number; vat: number; gross: number };
  }>('/api/szamlazz/create-invoice', payload);
};

export type StornoResponse = {
  mode: 'preview' | 'live';
  success: boolean;
  message?: string;
  invoiceNumber?: string | null;
  pdfBase64?: string | null;
  rawResponse?: string | null;
};

export const stornoInvoice = async (invoiceNumber: string): Promise<StornoResponse> => {
  const response = await fetch('/api/szamlazz/storno-invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoiceNumber }),
  });

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  const parsed = (data || {}) as StornoResponse;
  if (!response.ok) {
    throw new Error(parsed.message || `Sztornó hívás sikertelen (HTTP ${response.status})`);
  }
  return parsed;
};
