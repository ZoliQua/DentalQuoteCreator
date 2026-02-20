import { useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { usePatients, useCatalog, useCatalogCodeFormatter, useQuotes } from '../hooks';
import { Card, Button, Input, Select, Modal, Badge, ConfirmModal } from '../components/common';
import { formatCurrency, formatDate, formatPatientName, formatBirthDateForDisplay, parseBirthDateFromDisplay, getDatePlaceholder, naturalCompare } from '../utils';
import { createInvoice, previewInvoice, stornoInvoice } from '../modules/invoicing/api';
import { listInvoices, saveInvoice } from '../modules/invoicing/storage';
import type { InvoiceRecord } from '../types/invoice';
import { getAuthHeaders } from '../utils/auth';

type SortKey = 'invoiceNumber' | 'patientName' | 'invoiceType' | 'issueDate' | 'dueDate' | 'paymentMethod' | 'amount' | 'status';
type SortDir = 'asc' | 'desc';

/** A display row — either a real invoice or a virtual storno row derived from a stornoed invoice */
interface DisplayRow {
  key: string;
  isStornoRow: boolean;
  invoice: InvoiceRecord;
  /** For storno rows, display the storno invoice number */
  displayNumber?: string;
}

export function InvoicesPage() {
  const { t, settings } = useSettings();
  const { hasPermission, user } = useAuth();
  const { patients } = usePatients();
  const { activeItems } = useCatalog();
  const { formatCode } = useCatalogCodeFormatter();
  const { addEventToQuote, getQuote, reopenTreatment } = useQuotes();
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(() => listInvoices());
  const [resendLoadingId, setResendLoadingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>('invoiceNumber');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [stornoConfirmInvoice, setStornoConfirmInvoice] = useState<InvoiceRecord | null>(null);
  const [stornoLoading, setStornoLoading] = useState(false);
  const [stornoError, setStornoError] = useState<string | null>(null);

  // New invoice modal state
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    patientId: '',
    buyerName: '',
    buyerZip: '',
    buyerCity: '',
    buyerAddress: '',
    buyerEmail: '',
    paymentMethod: 'bankkártya',
    fulfillmentDate: '',
    dueDate: '',
    issueDate: '',
    comment: '',
  });
  const [newInvoiceItems, setNewInvoiceItems] = useState<
    { name: string; unit: string; qty: number; unitPriceNet: number; vatRate: number | string }[]
  >([]);
  const [newInvoiceSubmitting, setNewInvoiceSubmitting] = useState(false);
  const [newInvoiceError, setNewInvoiceError] = useState<string | null>(null);
  const [issueDateText, setIssueDateText] = useState('');
  const [fulfillmentDateText, setFulfillmentDateText] = useState('');
  const [dueDateText, setDueDateText] = useState('');
  const [newInvoicePreviewXml, setNewInvoicePreviewXml] = useState('');
  const [newInvoicePreviewTotals, setNewInvoicePreviewTotals] = useState<{
    net: number;
    vat: number;
    gross: number;
  } | null>(null);

  // Catalog item picker
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  const refreshInvoices = () => setInvoices(listInvoices());

  /** Build display rows: one row per invoice + one extra row per storno */
  const displayRows = useMemo((): DisplayRow[] => {
    const rows: DisplayRow[] = [];
    for (const inv of invoices) {
      rows.push({ key: inv.id, isStornoRow: false, invoice: inv });
      if (inv.status === 'storno' && inv.stornoInvoiceNumber) {
        rows.push({
          key: `${inv.id}-storno`,
          isStornoRow: true,
          invoice: inv,
          displayNumber: inv.stornoInvoiceNumber,
        });
      }
    }
    return rows;
  }, [invoices]);

  const invoiceTypeLabel = useCallback((row: DisplayRow): string => {
    if (row.isStornoRow) return t.invoices.invoiceTypeStorno;
    const it = row.invoice.invoiceType;
    if (it === 'advance') return t.invoices.invoiceTypeAdvance;
    if (it === 'final') return t.invoices.invoiceTypeFinal;
    return t.invoices.invoiceTypeNormal;
  }, [t]);

  const getRowSortValue = useCallback((row: DisplayRow, key: SortKey): string | number => {
    const inv = row.invoice;
    switch (key) {
      case 'invoiceNumber': return (row.isStornoRow ? row.displayNumber : inv.szamlazzInvoiceNumber) || '';
      case 'patientName': return inv.patientName.toLowerCase();
      case 'invoiceType': return invoiceTypeLabel(row);
      case 'issueDate': return new Date(inv.createdAt).getTime();
      case 'dueDate': return new Date(inv.dueDate).getTime();
      case 'paymentMethod': return inv.paymentMethod;
      case 'amount': return row.isStornoRow ? -inv.totalGross : inv.totalGross;
      case 'status': {
        if (row.isStornoRow) return t.invoices.statusSent;
        if (inv.status === 'draft') return t.invoices.statusDraft;
        if (inv.status === 'sent') return t.invoices.statusSent;
        return t.invoices.statusStorno;
      }
      default: return '';
    }
  }, [invoiceTypeLabel, t]);

  const sortedRows = useMemo(() => {
    const rows = [...displayRows];
    rows.sort((a, b) => {
      const va = getRowSortValue(a, sortKey);
      const vb = getRowSortValue(b, sortKey);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = naturalCompare(String(va), String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [displayRows, sortKey, sortDir, getRowSortValue]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortHeader = ({ col, children, className }: { col: SortKey; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 ${className || 'text-left'}`}
      onClick={() => handleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === col ? (
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
            {sortDir === 'asc' ? <path d="M6 2l4 5H2z" /> : <path d="M6 10l4-5H2z" />}
          </svg>
        ) : (
          <svg className="w-3 h-3 opacity-30" viewBox="0 0 12 12" fill="currentColor">
            <path d="M6 2l3 4H3zM6 10l3-4H3z" />
          </svg>
        )}
      </span>
    </th>
  );

  const handleInlineStorno = async () => {
    const invoice = stornoConfirmInvoice;
    if (!invoice?.szamlazzInvoiceNumber) return;
    setStornoLoading(true);
    setStornoError(null);
    try {
      const response = await stornoInvoice(invoice.szamlazzInvoiceNumber);
      if (response.mode === 'live' && !response.success) {
        throw new Error(response.message || t.invoices.errorGeneric);
      }
      const updated: InvoiceRecord = {
        ...invoice,
        status: 'storno',
        stornoInvoiceNumber: response.invoiceNumber || undefined,
        stornoPdfBase64: response.pdfBase64 || undefined,
      };
      saveInvoice(updated);
      setStornoConfirmInvoice(null);
      // Add storno event to quote event log
      if (invoice.quoteId) {
        addEventToQuote(invoice.quoteId, {
          type: 'invoice_storno',
          doctorName: user?.fullName || '',
          invoiceId: invoice.id,
          invoiceAmount: invoice.totalGross || 0,
          invoiceCurrency: invoice.currency,
          stornoInvoiceNumber: response.invoiceNumber || undefined,
          originalInvoiceNumber: invoice.szamlazzInvoiceNumber || undefined,
        });
        const q = getQuote(invoice.quoteId);
        if (q?.quoteStatus === 'completed') {
          reopenTreatment(invoice.quoteId);
        }
      }
      refreshInvoices();
    } catch (error) {
      setStornoError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setStornoLoading(false);
    }
  };

  const handleResend = async (invoice: InvoiceRecord) => {
    setResendLoadingId(invoice.id);
    setErrorById((prev) => ({ ...prev, [invoice.id]: '' }));

    try {
      const response = await createInvoice({
        seller: { name: settings.clinic.name, email: settings.clinic.email },
        buyer: invoice.buyer,
        invoice: {
          paymentMethod: invoice.paymentMethod,
          fulfillmentDate: invoice.fulfillmentDate,
          dueDate: invoice.dueDate,
          issueDate: invoice.createdAt.slice(0, 10),
          currency: invoice.currency,
          comment: `${invoice.quoteNumber || ''} - ${invoice.quoteName || ''}`.trim(),
        },
        items: invoice.items.map((item) => ({
          name: item.name,
          unit: item.unit,
          qty: item.qty,
          unitPriceNet: item.unitPriceNet,
          vatRate: item.vatRate,
        })),
      });

      if (response.mode === 'live' && !response.success) {
        throw new Error(response.message || 'Szamlazz.hu hivas sikertelen');
      }

      const updated: InvoiceRecord = {
        ...invoice,
        status: response.mode === 'live' && response.success ? 'sent' : invoice.status,
        szamlazzInvoiceNumber: response.invoiceNumber || invoice.szamlazzInvoiceNumber,
        pdfBase64: response.pdfBase64 || invoice.pdfBase64,
        rawResponse: response.rawResponse || invoice.rawResponse,
      };

      saveInvoice(updated);
      refreshInvoices();
    } catch (error) {
      setErrorById((prev) => ({
        ...prev,
        [invoice.id]: error instanceof Error ? error.message : t.invoices.errorGeneric,
      }));
    } finally {
      setResendLoadingId(null);
    }
  };

  const openPdf = (invoice: InvoiceRecord) => {
    if (!invoice.pdfBase64) return;
    const bytes = atob(invoice.pdfBase64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  const statusLabel = (status: InvoiceRecord['status']) => {
    if (status === 'draft') return t.invoices.statusDraft;
    if (status === 'sent') return t.invoices.statusSent;
    if (status === 'storno') return t.invoices.statusStorno;
    return status;
  };

  const statusVariant = (status: InvoiceRecord['status']) => {
    if (status === 'draft') return 'warning' as const;
    if (status === 'sent') return 'success' as const;
    if (status === 'storno') return 'danger' as const;
    return 'default' as const;
  };

  const paymentLabel = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'atutalas' || m === 'átutalás') return t.invoices.paymentTransfer;
    if (m === 'keszpenz' || m === 'készpénz') return t.invoices.paymentCash;
    if (m === 'bankkartya' || m === 'bankkártya') return t.invoices.paymentCard;
    return method;
  };

  // --- New invoice dialog ---
  const handleOpenNewInvoice = () => {
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setNewInvoiceForm({
      patientId: '',
      buyerName: '',
      buyerZip: '',
      buyerCity: '',
      buyerAddress: '',
      buyerEmail: '',
      paymentMethod: settings.invoice?.defaultPaymentMethod || 'bankkártya',
      fulfillmentDate: today,
      dueDate,
      issueDate: today,
      comment: settings.invoice?.defaultComment || '',
    });
    setNewInvoiceItems([]);
    setNewInvoiceError(null);
    setNewInvoicePreviewXml('');
    setNewInvoicePreviewTotals(null);
    setIssueDateText(formatBirthDateForDisplay(today));
    setFulfillmentDateText(formatBirthDateForDisplay(today));
    setDueDateText(formatBirthDateForDisplay(dueDate));
    setNewInvoiceOpen(true);
  };

  const handlePatientSelect = (patientId: string) => {
    const patient = patients.find((p) => p.patientId === patientId);
    if (patient) {
      setNewInvoiceForm((prev) => ({
        ...prev,
        patientId,
        buyerName: formatPatientName(patient.lastName, patient.firstName, patient.title),
        buyerZip: patient.zipCode || '',
        buyerCity: patient.city || '',
        buyerAddress: patient.street || '',
        buyerEmail: patient.email || '',
      }));
    } else {
      setNewInvoiceForm((prev) => ({ ...prev, patientId }));
    }
  };

  const addCatalogItem = (item: { catalogName: string; catalogUnit: string; catalogPrice: number; catalogVatRate?: number }) => {
    const grossUnit = item.catalogPrice;
    const vatRate = settings.invoice?.defaultVatRate ?? 'TAM';
    const numericVat = typeof vatRate === 'number' ? vatRate : 0;
    const unitPriceNet = numericVat > 0 ? Number((grossUnit / (1 + numericVat / 100)).toFixed(2)) : grossUnit;
    setNewInvoiceItems((prev) => [
      ...prev,
      { name: item.catalogName, unit: item.catalogUnit, qty: 1, unitPriceNet, vatRate },
    ]);
    setShowCatalogPicker(false);
    setCatalogSearch('');
  };

  const removeNewItem = (index: number) => {
    setNewInvoiceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateNewItem = (index: number, field: string, value: number | string) => {
    setNewInvoiceItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const buildNewInvoicePayload = () => ({
    seller: { name: settings.clinic.name, email: settings.clinic.email },
    buyer: {
      name: newInvoiceForm.buyerName,
      zip: newInvoiceForm.buyerZip,
      city: newInvoiceForm.buyerCity,
      address: newInvoiceForm.buyerAddress,
      email: newInvoiceForm.buyerEmail,
    },
    invoice: {
      paymentMethod: newInvoiceForm.paymentMethod,
      fulfillmentDate: newInvoiceForm.fulfillmentDate,
      dueDate: newInvoiceForm.dueDate,
      issueDate: newInvoiceForm.issueDate,
      currency: 'HUF' as const,
      comment: newInvoiceForm.comment,
      eInvoice: settings.invoice?.invoiceType === 'electronic',
    },
    items: newInvoiceItems,
  });

  const handlePreviewNewInvoice = async () => {
    setNewInvoiceSubmitting(true);
    setNewInvoiceError(null);
    try {
      const response = await previewInvoice(buildNewInvoicePayload());
      setNewInvoicePreviewXml(response.xml);
      setNewInvoicePreviewTotals(response.totals);
    } catch (error) {
      setNewInvoiceError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setNewInvoiceSubmitting(false);
    }
  };

  const handleCreateNewInvoice = async () => {
    setNewInvoiceSubmitting(true);
    setNewInvoiceError(null);
    try {
      const payload = buildNewInvoicePayload();
      const response = await createInvoice(payload);
      if (response.mode === 'live' && !response.success) {
        throw new Error(response.message || t.invoices.errorGeneric);
      }
      const calculatedTotals = payload.items.reduce((acc, item) => {
        const net = item.qty * item.unitPriceNet;
        const vat = (net * (typeof item.vatRate === 'number' ? item.vatRate : 0)) / 100;
        return { net: acc.net + net, vat: acc.vat + vat, gross: acc.gross + net + vat };
      }, { net: 0, vat: 0, gross: 0 });
      const totalGross = Math.round((calculatedTotals.gross + Number.EPSILON) * 100) / 100;
      const isActuallySent = response.mode === 'live' && response.success;
      // Fetch next invoice ID from backend
      let invoiceId: string;
      const adHocPatientId = newInvoiceForm.patientId || 'ad-hoc';
      try {
        const idRes = await fetch(`/backend/invoices/next-id/${encodeURIComponent(adHocPatientId)}`, { headers: getAuthHeaders() });
        if (idRes.ok) {
          const idData = await idRes.json() as { id: string };
          invoiceId = idData.id;
        } else {
          invoiceId = nanoid();
        }
      } catch {
        invoiceId = nanoid();
      }
      saveInvoice({
        id: invoiceId,
        patientId: adHocPatientId,
        quoteId: '',
        patientName: newInvoiceForm.buyerName,
        szamlazzInvoiceNumber: response.invoiceNumber || undefined,
        status: isActuallySent ? 'sent' : 'draft',
        totalGross,
        currency: 'HUF',
        createdAt: new Date().toISOString(),
        paymentMethod: newInvoiceForm.paymentMethod,
        fulfillmentDate: newInvoiceForm.fulfillmentDate,
        dueDate: newInvoiceForm.dueDate,
        buyer: {
          name: newInvoiceForm.buyerName,
          zip: newInvoiceForm.buyerZip,
          city: newInvoiceForm.buyerCity,
          address: newInvoiceForm.buyerAddress,
          email: newInvoiceForm.buyerEmail,
        },
        items: payload.items.map((item) => {
          const net = Number((item.qty * item.unitPriceNet).toFixed(2));
          const numVat = typeof item.vatRate === 'number' ? item.vatRate : 0;
          const vat = Number(((net * numVat) / 100).toFixed(2));
          const gross = Number((net + vat).toFixed(2));
          return { name: item.name, unit: item.unit, qty: item.qty, unitPriceNet: item.unitPriceNet, vatRate: item.vatRate, net, vat, gross };
        }),
        xmlPreview: response.xml || newInvoicePreviewXml || undefined,
        rawResponse: response.rawResponse || undefined,
        pdfBase64: response.pdfBase64 || undefined,
      });
      setNewInvoiceOpen(false);
      // Auto-open PDF in new tab
      if (response.pdfBase64) {
        const bytes = atob(response.pdfBase64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      }
      refreshInvoices();
    } catch (error) {
      setNewInvoiceError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setNewInvoiceSubmitting(false);
    }
  };

  const filteredCatalog = useMemo(() => {
    if (!catalogSearch.trim()) return activeItems;
    const q = catalogSearch.toLowerCase();
    return activeItems.filter(
      (item) =>
        item.catalogName.toLowerCase().includes(q) || item.catalogCode.toLowerCase().includes(q)
    );
  }, [activeItems, catalogSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.invoices.title}</h1>
          <p className="text-gray-500 mt-1">{t.invoices.subtitle}</p>
        </div>
        {hasPermission('invoices.issue') && (<Button onClick={handleOpenNewInvoice}>{t.invoices.newInvoice}</Button>)}
      </div>

      {stornoError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {stornoError}
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          {sortedRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">{t.invoices.noInvoices}</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader col="invoiceNumber">{t.invoices.invoiceNumber}</SortHeader>
                  <SortHeader col="patientName">{t.invoices.patientName}</SortHeader>
                  <SortHeader col="invoiceType">{t.invoices.invoiceType}</SortHeader>
                  <SortHeader col="issueDate">{t.invoices.issueDate}</SortHeader>
                  <SortHeader col="dueDate">{t.invoices.dueDate}</SortHeader>
                  <SortHeader col="paymentMethod">{t.invoices.paymentMethod}</SortHeader>
                  <SortHeader col="amount" className="text-right">{t.invoices.amount}</SortHeader>
                  <SortHeader col="status" className="text-center">{t.invoices.status}</SortHeader>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t.common.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedRows.map((row) => {
                  const inv = row.invoice;
                  const isStornoed = !row.isStornoRow && inv.status === 'storno';

                  // Storno virtual row
                  if (row.isStornoRow) {
                    return (
                      <tr key={row.key} className="bg-red-50/60 hover:bg-red-50">
                        <td className="px-4 py-3 text-sm font-medium text-red-700">
                          <Link to={`/invoices/${inv.id}`} className="text-red-600 hover:text-red-700 hover:underline">
                            {row.displayNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {inv.patientId && inv.patientId !== 'ad-hoc' ? (
                            <Link to={`/patients/${inv.patientId}`} className="text-dental-600 hover:text-dental-700 hover:underline">
                              {inv.patientName}
                            </Link>
                          ) : inv.patientName}
                        </td>
                        <td className="px-4 py-3 text-sm text-red-600 font-medium">
                          {t.invoices.invoiceTypeStorno}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(inv.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {formatDate(inv.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {paymentLabel(inv.paymentMethod)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                          -{formatCurrency(inv.totalGross, inv.currency)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="success">{t.invoices.statusSent}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {inv.stornoPdfBase64 && (
                              <button
                                type="button"
                                title={t.invoices.pdf}
                                onClick={() => {
                                  const bytes = atob(inv.stornoPdfBase64!);
                                  const arr = new Uint8Array(bytes.length);
                                  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                                  const blob = new Blob([arr], { type: 'application/pdf' });
                                  window.open(URL.createObjectURL(blob), '_blank');
                                }}
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                            )}
                            <Link
                              to={`/invoices/${inv.id}`}
                              title={t.invoices.open}
                              className="rounded p-1.5 text-dental-600 hover:bg-dental-50 hover:text-dental-700"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  // Normal invoice row
                  return (
                    <tr key={row.key} className={isStornoed ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-gray-50'}>
                      <td className={`px-4 py-3 text-sm font-medium ${isStornoed ? 'text-red-700' : 'text-gray-900'}`}>
                        {inv.szamlazzInvoiceNumber ? (
                          <Link to={`/invoices/${inv.id}`} className={isStornoed ? 'text-red-600 hover:text-red-700 hover:underline' : 'text-dental-600 hover:text-dental-700 hover:underline'}>
                            {inv.szamlazzInvoiceNumber}
                          </Link>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {inv.patientId && inv.patientId !== 'ad-hoc' ? (
                          <Link to={`/patients/${inv.patientId}`} className="text-dental-600 hover:text-dental-700 hover:underline">
                            {inv.patientName}
                          </Link>
                        ) : inv.patientName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {invoiceTypeLabel(row)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(inv.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {paymentLabel(inv.paymentMethod)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold ${isStornoed ? 'text-red-600 line-through' : ''}`}>
                        {formatCurrency(inv.totalGross, inv.currency)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={statusVariant(inv.status)}>
                          {statusLabel(inv.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleResend(inv)}
                              disabled={resendLoadingId === inv.id}
                              className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                            >
                              {resendLoadingId === inv.id ? t.invoices.resending : t.invoices.resend}
                            </button>
                          )}
                          {inv.pdfBase64 && (
                            <button
                              type="button"
                              title={t.invoices.pdf}
                              onClick={() => openPdf(inv)}
                              className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                          )}
                          <Link
                            to={`/invoices/${inv.id}`}
                            title={t.invoices.open}
                            className="rounded p-1.5 text-dental-600 hover:bg-dental-50 hover:text-dental-700"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </Link>
                          {hasPermission('invoices.storno') && inv.status === 'sent' && inv.szamlazzInvoiceNumber && (
                            <button
                              type="button"
                              title={t.invoices.storno}
                              onClick={() => setStornoConfirmInvoice(inv)}
                              className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        {errorById[inv.id] && (
                          <p className="mt-1 text-xs text-red-600">{errorById[inv.id]}</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Storno Confirmation Modal */}
      <ConfirmModal
        isOpen={!!stornoConfirmInvoice}
        onClose={() => setStornoConfirmInvoice(null)}
        onConfirm={handleInlineStorno}
        title={t.invoices.storno}
        message={`${t.invoices.stornoConfirm}\n\n${t.invoices.stornoConfirmDetail}`}
        confirmText={stornoLoading ? t.invoices.stornoInProgress : t.invoices.storno}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* New Invoice Modal */}
      <Modal
        isOpen={newInvoiceOpen}
        onClose={() => setNewInvoiceOpen(false)}
        title={t.invoices.newInvoice}
        size="xl"
      >
        <div className="space-y-4">
          {/* Patient selector */}
          <Select
            label={t.invoices.patientName}
            value={newInvoiceForm.patientId}
            onChange={(e) => handlePatientSelect(e.target.value)}
            options={[
              { value: '', label: '-- ' + t.invoices.patientName + ' --' },
              ...patients.map((p) => ({
                value: p.patientId,
                label: formatPatientName(p.lastName, p.firstName, p.title),
              })),
            ]}
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label={t.invoices.buyerName}
              value={newInvoiceForm.buyerName}
              onChange={(e) =>
                setNewInvoiceForm((prev) => ({ ...prev, buyerName: e.target.value }))
              }
            />
            <Input
              label={t.invoices.buyerEmail}
              value={newInvoiceForm.buyerEmail}
              onChange={(e) =>
                setNewInvoiceForm((prev) => ({ ...prev, buyerEmail: e.target.value }))
              }
            />
            <Input
              label={t.invoices.buyerZip}
              value={newInvoiceForm.buyerZip}
              onChange={(e) =>
                setNewInvoiceForm((prev) => ({ ...prev, buyerZip: e.target.value }))
              }
            />
            <Input
              label={t.invoices.buyerCity}
              value={newInvoiceForm.buyerCity}
              onChange={(e) =>
                setNewInvoiceForm((prev) => ({ ...prev, buyerCity: e.target.value }))
              }
            />
            <Input
              label={t.invoices.buyerAddress}
              value={newInvoiceForm.buyerAddress}
              onChange={(e) =>
                setNewInvoiceForm((prev) => ({ ...prev, buyerAddress: e.target.value }))
              }
            />
            <Select
              label={t.invoices.paymentMethod}
              value={newInvoiceForm.paymentMethod}
              onChange={(e) =>
                setNewInvoiceForm((prev) => ({ ...prev, paymentMethod: e.target.value }))
              }
              options={[
                { value: 'átutalás', label: t.invoices.paymentTransfer },
                { value: 'készpénz', label: t.invoices.paymentCash },
                { value: 'bankkártya', label: t.invoices.paymentCard },
              ]}
            />
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.invoices.issueDate}</label>
              <div className="relative">
                <input
                  value={issueDateText}
                  onChange={(e) => {
                    setIssueDateText(e.target.value);
                    const parsed = parseBirthDateFromDisplay(e.target.value);
                    if (parsed) setNewInvoiceForm((prev) => ({ ...prev, issueDate: parsed }));
                    else if (!e.target.value) setNewInvoiceForm((prev) => ({ ...prev, issueDate: '' }));
                  }}
                  placeholder={getDatePlaceholder()}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
                />
                <input
                  type="date"
                  value={newInvoiceForm.issueDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setNewInvoiceForm((prev) => ({ ...prev, issueDate: e.target.value }));
                      setIssueDateText(formatBirthDateForDisplay(e.target.value));
                    }
                  }}
                  className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
                  tabIndex={-1}
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.invoices.fulfillmentDate}</label>
              <div className="relative">
                <input
                  value={fulfillmentDateText}
                  onChange={(e) => {
                    setFulfillmentDateText(e.target.value);
                    const parsed = parseBirthDateFromDisplay(e.target.value);
                    if (parsed) setNewInvoiceForm((prev) => ({ ...prev, fulfillmentDate: parsed }));
                    else if (!e.target.value) setNewInvoiceForm((prev) => ({ ...prev, fulfillmentDate: '' }));
                  }}
                  placeholder={getDatePlaceholder()}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
                />
                <input
                  type="date"
                  value={newInvoiceForm.fulfillmentDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setNewInvoiceForm((prev) => ({ ...prev, fulfillmentDate: e.target.value }));
                      setFulfillmentDateText(formatBirthDateForDisplay(e.target.value));
                    }
                  }}
                  className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
                  tabIndex={-1}
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.invoices.dueDate}</label>
              <div className="relative">
                <input
                  value={dueDateText}
                  onChange={(e) => {
                    setDueDateText(e.target.value);
                    const parsed = parseBirthDateFromDisplay(e.target.value);
                    if (parsed) setNewInvoiceForm((prev) => ({ ...prev, dueDate: parsed }));
                    else if (!e.target.value) setNewInvoiceForm((prev) => ({ ...prev, dueDate: '' }));
                  }}
                  placeholder={getDatePlaceholder()}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
                />
                <input
                  type="date"
                  value={newInvoiceForm.dueDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setNewInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }));
                      setDueDateText(formatBirthDateForDisplay(e.target.value));
                    }
                  }}
                  className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
                  tabIndex={-1}
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <Input
              label={t.invoices.comment}
              value={newInvoiceForm.comment}
              onChange={(e) =>
                setNewInvoiceForm((prev) => ({ ...prev, comment: e.target.value }))
              }
            />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">{t.invoices.items}</h3>
              <Button
                variant="secondary"
                onClick={() => setShowCatalogPicker(true)}
              >
                {t.invoices.addItem}
              </Button>
            </div>
            {newInvoiceItems.length === 0 ? (
              <p className="text-sm text-gray-400">{t.invoices.noInvoices}</p>
            ) : (
              <div className="space-y-2">
                {newInvoiceItems.map((item, idx) => {
                  const net = Number((item.qty * item.unitPriceNet).toFixed(2));
                  const numVat = typeof item.vatRate === 'number' ? item.vatRate : 0;
                  const vat = Number(((net * numVat) / 100).toFixed(2));
                  const gross = Number((net + vat).toFixed(2));
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded border border-gray-200 p-2 text-sm"
                    >
                      <span className="flex-1 font-medium">{item.name}</span>
                      <Input
                        type="number"
                        value={item.qty}
                        onChange={(e) => updateNewItem(idx, 'qty', Number(e.target.value) || 1)}
                        min={1}
                        className="w-16"
                      />
                      <span className="text-gray-500">{item.unit}</span>
                      <Input
                        type="number"
                        value={item.unitPriceNet}
                        onChange={(e) =>
                          updateNewItem(idx, 'unitPriceNet', Number(e.target.value) || 0)
                        }
                        className="w-24"
                      />
                      <span className="text-gray-500">{typeof item.vatRate === 'number' ? `${item.vatRate}%` : item.vatRate}</span>
                      <span className="w-24 text-right font-semibold">
                        {formatCurrency(gross)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeNewItem(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {newInvoicePreviewTotals && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p>
                {t.invoices.netTotal}: {formatCurrency(newInvoicePreviewTotals.net)}
              </p>
              <p>
                {t.invoices.vatTotal}: {formatCurrency(newInvoicePreviewTotals.vat)}
              </p>
              <p className="font-semibold">
                {t.invoices.grossTotal}: {formatCurrency(newInvoicePreviewTotals.gross)}
              </p>
            </div>
          )}

          {newInvoiceError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {newInvoiceError}
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              {t.invoices.xmlPreview}
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
              {newInvoicePreviewXml || t.invoices.xmlNotAvailable}
            </pre>
          </details>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNewInvoiceOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button
              variant="secondary"
              onClick={handlePreviewNewInvoice}
              disabled={newInvoiceSubmitting}
            >
              {t.invoices.preview}
            </Button>
            <Button onClick={handleCreateNewInvoice} disabled={newInvoiceSubmitting}>
              {t.invoices.createInvoice}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Catalog Picker Modal */}
      <Modal
        isOpen={showCatalogPicker}
        onClose={() => {
          setShowCatalogPicker(false);
          setCatalogSearch('');
        }}
        title={t.invoices.addItem}
        size="lg"
      >
        <div className="space-y-3">
          <Input
            placeholder={t.quotes.searchCatalog}
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {filteredCatalog.map((item) => (
              <div
                key={item.catalogItemId}
                className="flex items-center justify-between rounded border p-2 hover:bg-gray-50 cursor-pointer"
                onClick={() => addCatalogItem(item)}
              >
                <div>
                  <p className="text-sm font-medium">{item.catalogName}</p>
                  <p className="text-xs text-gray-500">
                    {formatCode(item)} | {item.catalogUnit}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(item.catalogPrice)}</p>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
