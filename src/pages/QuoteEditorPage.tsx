import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { usePatients, useQuotes, useCatalog, useCatalogCodeFormatter, usePriceListCategories } from '../hooks';
import { QuoteItem, CatalogItem, CatalogCategory, DiscountType } from '../types';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardFooter,
  Input,
  TextArea,
  Select,
  Modal,
  Badge,
  EmptyState,
  EmptyCatalogIcon,
  ConfirmModal,
  QuoteProgressBar,
} from '../components/common';
import {
  formatCurrency,
  formatPatientName,
  formatDate,
  formatDateTime,
  calculateQuoteTotals,
  calculateLineTotal,
  calculateLineDiscountAmount,
  formatBirthDateForDisplay,
  parseBirthDateFromDisplay,
  getDatePlaceholder,
} from '../utils';
import { generateQuotePdf } from '../components/pdf/QuotePdfGenerator';
import { OdontogramHost } from '../modules/odontogram/OdontogramHost';
import { loadCurrent } from '../modules/odontogram/odontogramStorage';
import type { OdontogramState } from '../modules/odontogram/types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { previewInvoice, createInvoice } from '../modules/invoicing/api';
import { saveInvoice, getInvoicesByQuote } from '../modules/invoicing/storage';
import type { InvoiceRecord, InvoiceType } from '../types/invoice';
import { getCatalogDisplayName } from '../utils/catalogLocale';

// Per-line discount preset type
type LineDiscountPreset = 'none' | '10' | '20' | '30' | '40' | '50' | 'custom';

export function QuoteEditorPage() {
  const { patientId, quoteId } = useParams<{ patientId: string; quoteId: string }>();
  const navigate = useNavigate();
  const { t, settings, appLanguage } = useSettings();
  const { getPatient } = usePatients();
  const {
    getQuote,
    createQuote,
    addItemToQuote,
    updateQuoteItem,
    removeItemFromQuote,
    reorderQuoteItems,
    editQuote,
    addEventToQuote,
    deleteQuote,
    closeQuote,
    reopenQuote,
    acceptQuote,
    rejectQuote,
    revokeAcceptance,
    revokeRejection,
    completeTreatment,
    reopenTreatment,
  } = useQuotes();
  const { activeItems, itemsByCategory } = useCatalog();
  const { formatCode } = useCatalogCodeFormatter();
  const { getCategoryName } = usePriceListCategories();
  const { hasPermission } = useAuth();
  const { restoreQuote } = useApp();

  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lineDiscountPreset, setLineDiscountPreset] = useState<LineDiscountPreset>('none');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [initialOdontogramState, setInitialOdontogramState] = useState<OdontogramState | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDisabledModalOpen, setInvoiceDisabledModalOpen] = useState(false);
  const [invoicePreviewXml, setInvoicePreviewXml] = useState('');
  const [invoicePreviewTotals, setInvoicePreviewTotals] = useState<{ net: number; vat: number; gross: number } | null>(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [invoiceForm, setInvoiceForm] = useState({
    buyerName: '',
    buyerZip: '',
    buyerCity: '',
    buyerAddress: '',
    buyerEmail: '',
    paymentMethod: 'atutalas',
    fulfillmentDate: '',
    dueDate: '',
    issueDate: '',
  });
  const [invoiceItems, setInvoiceItems] = useState<
    { name: string; unit: string; qty: number; unitPriceNet: number; vatRate: number }[]
  >([]);
  const [invoiceComment, setInvoiceComment] = useState('');
  const [issueDateText, setIssueDateText] = useState('');
  const [fulfillmentDateText, setFulfillmentDateText] = useState('');
  const [dueDateText, setDueDateText] = useState('');
  const [validUntilModalOpen, setValidUntilModalOpen] = useState(false);
  const [validUntilText, setValidUntilText] = useState('');
  const [quoteInvoices, setQuoteInvoices] = useState<InvoiceRecord[]>([]);
  const [invoiceDraggedIndex, setInvoiceDraggedIndex] = useState<number | null>(null);
  const [invoiceDragOverIndex, setInvoiceDragOverIndex] = useState<number | null>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('normal');
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const patient = patientId ? getPatient(patientId) : undefined;

  // Create quote if it doesn't exist
  useEffect(() => {
    if (patientId && !quoteId && patient) {
      const patientName = formatPatientName(patient.lastName, patient.firstName, patient.title);
      const newQuote = createQuote(patientId, patientName);
      navigate(`/patients/${patientId}/quotes/${newQuote.quoteId}`, { replace: true });
    }
  }, [patientId, quoteId, patient, createQuote, navigate]);

  const quote = quoteId ? getQuote(quoteId) : undefined;
  const effectiveQuoteLang: 'hu' | 'en' | 'de' = quote?.quoteLang ?? settings.quote.quoteLang ?? 'hu';

  useEffect(() => {
    if (!patientId) return;
    const stored = loadCurrent(patientId);
    setInitialOdontogramState(stored?.state ?? null);
  }, [patientId]);

  // Load invoices for this quote
  const refreshQuoteInvoices = () => {
    if (quoteId) setQuoteInvoices(getInvoicesByQuote(quoteId));
  };
  useEffect(() => {
    refreshQuoteInvoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  // Keep per-line discounts in sync with the selected preset (also applies to newly added items)
  useEffect(() => {
    if (!quote) return;

    // Determine desired discount for current preset
    let desiredValue = 0;
    const desiredType: DiscountType = 'percent';

    if (lineDiscountPreset === 'none') {
      desiredValue = 0;
    } else if (lineDiscountPreset === 'custom') {
      // In custom mode we don't force a value (leave whatever user set), but we normalize type to percent if missing
      quote.items.forEach((it) => {
        if (it.quoteLineDiscountType !== 'percent' && it.quoteLineDiscountValue === 0) {
          updateQuoteItem(quote.quoteId, it.lineId, { quoteLineDiscountType: 'percent' });
        }
      });
      return;
    } else {
      desiredValue = parseInt(lineDiscountPreset, 10) || 0;
    }

    // Apply only when needed to avoid loops
    quote.items.forEach((it) => {
      const needsUpdate =
        (it.quoteLineDiscountType !== desiredType) || (it.quoteLineDiscountValue !== desiredValue);

      if (needsUpdate) {
        updateQuoteItem(quote.quoteId, it.lineId, {
          quoteLineDiscountValue: desiredValue,
          quoteLineDiscountType: desiredType,
        });
      }
    });
  }, [quote, lineDiscountPreset, updateQuoteItem]);

  const totals = useMemo(() => {
    if (!quote) return { subtotal: 0, lineDiscounts: 0, globalDiscount: 0, total: 0 };
    return calculateQuoteTotals(quote);
  }, [quote]);

  // Invoicing amounts
  const invoicedAmount = useMemo(() => {
    return quoteInvoices
      .filter((inv) => inv.status !== 'storno')
      .reduce((sum, inv) => sum + (inv.totalGross || 0), 0);
  }, [quoteInvoices]);
  const remainingAmount = Math.max(0, totals.total - invoicedAmount);

  const hasActiveAdvanceInvoice = useMemo(() => {
    return quoteInvoices.some((inv) => inv.status !== 'storno' && inv.invoiceType === 'advance');
  }, [quoteInvoices]);

  const canInvoice = quote?.quoteStatus === 'started' && (remainingAmount > 0 || hasActiveAdvanceInvoice);

  const invoiceDisabledReason = (() => {
    if (!quote) return '';
    if (quote.quoteStatus === 'completed') return t.invoices.quoteSettled;
    if (quote.quoteStatus !== 'started') return t.invoices.quoteNotAccepted;
    if (remainingAmount <= 0 && !hasActiveAdvanceInvoice) return t.invoices.quoteFullyInvoiced;
    return '';
  })();

  const filteredCatalogItems = useMemo(() => {
    let items = activeItems;

    if (selectedCategory !== 'all') {
      items = items.filter((item) => item.catalogCategory === selectedCategory);
    }

    if (itemSearchQuery.trim()) {
      const query = itemSearchQuery.toLowerCase().replace(/-/g, '');
      items = items.filter(
        (item) =>
          item.catalogName.toLowerCase().includes(query) ||
          item.catalogCode.toLowerCase().replace(/-/g, '').includes(query) ||
          formatCode(item).toLowerCase().replace(/-/g, '').includes(query)
      );
    }

    // Sort by category name, then catalogCode
    items = [...items].sort((a, b) => {
      const catCmp = a.catalogCategory.localeCompare(b.catalogCategory);
      if (catCmp !== 0) return catCmp;
      return a.catalogCode.localeCompare(b.catalogCode);
    });

    return items;
  }, [activeItems, selectedCategory, itemSearchQuery, formatCode]);

  if (!patient || !quote) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">{t.quotes.notFound}</h2>
        <Link to="/patients" className="text-dental-600 hover:text-dental-700 mt-4 inline-block">
          {t.quotes.backToPatients}
        </Link>
      </div>
    );
  }

  const handleAddItem = (catalogItem: CatalogItem) => {
    const result = addItemToQuote(quote.quoteId, catalogItem);
    if (result) {
      const lastItem = result.items[result.items.length - 1];
      const localizedName = getCatalogDisplayName(catalogItem, effectiveQuoteLang);
      if (localizedName !== lastItem.quoteName) {
        updateQuoteItem(quote.quoteId, lastItem.lineId, { quoteName: localizedName });
      }
    }
  };

  const handleUpdateItem = (lineId: string, data: Partial<QuoteItem>) => {
    updateQuoteItem(quote.quoteId, lineId, data);
  };

  const handleRemoveItem = (lineId: string) => {
    removeItemFromQuote(quote.quoteId, lineId);
  };

  const handleGlobalDiscountChange = (type: DiscountType, value: number) => {
    editQuote(quote.quoteId, {
      globalDiscountType: type,
      globalDiscountValue: value,
    });
  };

  const handleCommentChange = (commentToPatient: string) => {
    editQuote(quote.quoteId, { commentToPatient });
  };

  const handleInternalNotesChange = (internalNotes: string) => {
    editQuote(quote.quoteId, { internalNotes });
  };

  const handleExpectedTreatmentsChange = (expectedTreatments: number) => {
    editQuote(quote.quoteId, { expectedTreatments });
  };

  // Handler to apply per-line discount preset to all items
  const handleLineDiscountPresetChange = (preset: LineDiscountPreset) => {
    setLineDiscountPreset(preset);

    // Apply to all items in the current quote
    if (!quote) return;

    if (preset === 'none') {
      quote.items.forEach((it) => {
        updateQuoteItem(quote.quoteId, it.lineId, {
          quoteLineDiscountValue: 0,
          quoteLineDiscountType: 'percent',
        });
      });
      return;
    }

    if (preset === 'custom') {
      // Show per-line discount editors, start from empty (stored as 0, UI already renders '' for 0)
      quote.items.forEach((it) => {
        updateQuoteItem(quote.quoteId, it.lineId, {
          quoteLineDiscountValue: 0,
          quoteLineDiscountType: 'percent',
        });
      });
      return;
    }

    // Preset percentage (10..50): set for every line (editor remains visible for fine-tuning)
    const pct = parseInt(preset, 10) || 0;
    quote.items.forEach((it) => {
      updateQuoteItem(quote.quoteId, it.lineId, {
        quoteLineDiscountValue: pct,
        quoteLineDiscountType: 'percent',
      });
    });
  };

  const handleDoctorChange = (doctorId: string) => {
    editQuote(quote.quoteId, { doctorId });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      reorderQuoteItems(quote.quoteId, draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleClose = () => {
    closeQuote(quote.quoteId);
  };

  const handleDelete = () => {
    if (deleteQuote(quote.quoteId)) {
      navigate(`/patients/${patient.patientId}`);
    }
    setDeleteConfirm(false);
  };

  const selectedDoctor = settings.doctors.find((doc) => doc.id === quote.doctorId);
  const doctorName = selectedDoctor?.name || (settings.doctors.length > 0 ? settings.doctors[0].name : '');

  const handleDownloadPdf = () => {
    generateQuotePdf(quote, patient, settings, doctorName);
  };

  const categories = Object.keys(itemsByCategory) as CatalogCategory[];

  const buildInvoicePayload = () => {
    const vatRate = settings.invoice?.defaultVatRate ?? 0;
    let payloadItems = [...invoiceItems];

    if (invoiceType === 'advance') {
      // For advance invoices, send only the advance item
      const unitPriceNet = vatRate > 0 ? Number((advanceAmount / (1 + vatRate / 100)).toFixed(2)) : advanceAmount;
      payloadItems = [{
        name: t.invoices.advanceItemName,
        unit: 'db',
        qty: 1,
        unitPriceNet,
        vatRate,
      }];
    } else if (invoiceType === 'final' && hasActiveAdvanceInvoice) {
      // For final invoices, add a negative deduction for previous advances
      const advanceTotal = quoteInvoices
        .filter((inv) => inv.status !== 'storno' && inv.invoiceType === 'advance')
        .reduce((sum, inv) => sum + (inv.totalGross || 0), 0);
      const deductionNet = vatRate > 0 ? Number((advanceTotal / (1 + vatRate / 100)).toFixed(2)) : advanceTotal;
      payloadItems.push({
        name: t.invoices.advanceItemName,
        unit: 'db',
        qty: 1,
        unitPriceNet: -deductionNet,
        vatRate,
      });
    }

    return {
      seller: {
        name: settings.clinic.name,
        email: settings.clinic.email,
      },
      buyer: {
        name: invoiceForm.buyerName,
        zip: invoiceForm.buyerZip,
        city: invoiceForm.buyerCity,
        address: invoiceForm.buyerAddress,
        email: invoiceForm.buyerEmail,
      },
      invoice: {
        paymentMethod: invoiceForm.paymentMethod,
        fulfillmentDate: invoiceForm.fulfillmentDate,
        dueDate: invoiceForm.dueDate,
        issueDate: invoiceForm.issueDate,
        currency: quote.currency,
        comment: invoiceComment,
        eInvoice: settings.invoice?.invoiceType === 'electronic',
        elolegszamla: invoiceType === 'advance',
        vegszamla: invoiceType === 'final',
        rendelesSzam: invoiceType === 'final' ? '' : quote.quoteNumber,
        elolegSzamlaszam: invoiceType === 'final'
          ? (quoteInvoices.find((inv) => inv.status !== 'storno' && inv.invoiceType === 'advance')?.szamlazzInvoiceNumber || '')
          : '',
      },
      items: payloadItems,
    };
  };

  const handleOpenInvoiceModal = () => {
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setInvoiceForm({
      buyerName: formatPatientName(patient.lastName, patient.firstName, patient.title),
      buyerZip: patient.zipCode || '',
      buyerCity: patient.city || '',
      buyerAddress: patient.street || '',
      buyerEmail: patient.email || '',
      paymentMethod: 'atutalas',
      fulfillmentDate: today,
      dueDate,
      issueDate: today,
    });
    // Initialize invoice items from quote items using settings VAT rate
    const vatRate = settings.invoice?.defaultVatRate ?? 0;
    setInvoiceItems(
      quote.items.map((item) => {
        const grossUnit = Number(item.quoteUnitPriceGross || 0);
        const unitPriceNet = vatRate > 0 ? Number((grossUnit / (1 + vatRate / 100)).toFixed(2)) : grossUnit;
        return {
          name: item.quoteName,
          unit: item.quoteUnit,
          qty: Number(item.quoteQty || 1),
          unitPriceNet,
          vatRate,
        };
      })
    );
    // Pre-fill comment from settings + quote number
    const defaultComment = settings.invoice?.defaultComment || '';
    setInvoiceComment(
      defaultComment
        ? `${defaultComment} - ${quote.quoteNumber} - ${quote.quoteName}`
        : `${quote.quoteNumber} - ${quote.quoteName}`
    );
    // Determine default invoice type
    if (hasActiveAdvanceInvoice) {
      setInvoiceType('final');
    } else {
      setInvoiceType('normal');
    }
    setAdvanceAmount(0);
    setIssueDateText(formatBirthDateForDisplay(today));
    setFulfillmentDateText(formatBirthDateForDisplay(today));
    setDueDateText(formatBirthDateForDisplay(dueDate));
    setInvoicePreviewXml('');
    setInvoicePreviewTotals(null);
    setInvoiceError(null);
    setInvoiceModalOpen(true);
  };

  const handlePreviewInvoice = async () => {
    setInvoiceSubmitting(true);
    setInvoiceError(null);
    try {
      const response = await previewInvoice(buildInvoicePayload());
      setInvoicePreviewXml(response.xml);
      setInvoicePreviewTotals(response.totals);
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const handleCreateInvoice = async () => {
    setInvoiceSubmitting(true);
    setInvoiceError(null);
    try {
      const payload = buildInvoicePayload();
      const response = await createInvoice(payload);
      if (response.mode === 'live' && !response.success) {
        throw new Error(response.message || t.invoices.errorGeneric);
      }
      // Always calculate totals from items
      const calculatedTotals = payload.items.reduce((acc, item) => {
        const net = item.qty * item.unitPriceNet;
        const vat = (net * item.vatRate) / 100;
        return { net: acc.net + net, vat: acc.vat + vat, gross: acc.gross + net + vat };
      }, { net: 0, vat: 0, gross: 0 });
      const totalGross = Math.round((calculatedTotals.gross + Number.EPSILON) * 100) / 100;
      const isActuallySent = response.mode === 'live' && response.success;
      const invoiceId = nanoid();
      const invoiceNumber = response.invoiceNumber || undefined;
      saveInvoice({
        id: invoiceId,
        patientId: patient.patientId,
        quoteId: quote.quoteId,
        quoteNumber: quote.quoteNumber,
        quoteName: quote.quoteName,
        patientName: formatPatientName(patient.lastName, patient.firstName, patient.title),
        szamlazzInvoiceNumber: invoiceNumber,
        status: isActuallySent ? 'sent' : 'draft',
        totalGross,
        currency: quote.currency,
        createdAt: new Date().toISOString(),
        paymentMethod: invoiceForm.paymentMethod,
        fulfillmentDate: invoiceForm.fulfillmentDate,
        dueDate: invoiceForm.dueDate,
        buyer: {
          name: invoiceForm.buyerName,
          zip: invoiceForm.buyerZip,
          city: invoiceForm.buyerCity,
          address: invoiceForm.buyerAddress,
          email: invoiceForm.buyerEmail,
        },
        invoiceType,
        items: payload.items.map((item) => {
          const net = Number((item.qty * item.unitPriceNet).toFixed(2));
          const vat = Number((net * (item.vatRate / 100)).toFixed(2));
          const gross = Number((net + vat).toFixed(2));
          return {
            name: item.name,
            unit: item.unit,
            qty: item.qty,
            unitPriceNet: item.unitPriceNet,
            vatRate: item.vatRate,
            net,
            vat,
            gross,
          };
        }),
        xmlPreview: response.xml || invoicePreviewXml || undefined,
        rawResponse: response.rawResponse || undefined,
        pdfBase64: response.pdfBase64 || undefined,
      });
      // Add invoice event to quote event log
      addEventToQuote(quote.quoteId, {
        type: 'invoice_created',
        doctorName: doctorName,
        invoiceId,
        invoiceNumber: invoiceNumber || invoiceId.slice(0, 8),
        invoiceAmount: totalGross,
        invoiceCurrency: quote.currency,
        invoiceType,
      });
      setInvoiceModalOpen(false);
      // Auto-open PDF in new tab
      if (response.pdfBase64) {
        const bytes = atob(response.pdfBase64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      }
      refreshQuoteInvoices();
      // Auto-complete when fully invoiced
      const updatedInvoices = getInvoicesByQuote(quote.quoteId);
      const newInvoicedAmount = updatedInvoices
        .filter((inv) => inv.status !== 'storno')
        .reduce((sum, inv) => sum + (inv.totalGross || 0), 0);
      if (newInvoicedAmount >= totals.total && quote.quoteStatus === 'started' && invoiceType !== 'advance') {
        completeTreatment(quote.quoteId);
      }
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/patients" className="hover:text-dental-600">
              {t.patients.title}
            </Link>
            <span>/</span>
            <Link to={`/patients/${patient.patientId}`} className="hover:text-dental-600">
              {formatPatientName(patient.lastName, patient.firstName, patient.title)}
            </Link>
            <span>/</span>
            <span>{quote.quoteNumber}</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              {quote.quoteStatus === 'draft' ? (
                <input
                  value={quote.quoteName}
                  onChange={(e) => editQuote(quote.quoteId, { quoteName: e.target.value })}
                  className="text-2xl font-bold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-dental-500 focus:outline-none w-64"
                  placeholder={t.quotes.quoteName}
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">{quote.quoteName}</h1>
              )}
            </div>
            <Badge
              variant={
                quote.isDeleted
                  ? 'danger'
                  : quote.quoteStatus === 'draft'
                  ? 'warning'
                  : quote.quoteStatus === 'completed'
                  ? 'default'
                  : quote.quoteStatus === 'rejected'
                  ? 'danger'
                  : 'success'
              }
            >
              {quote.isDeleted ? t.quotes.statusDeleted :
               quote.quoteStatus === 'draft' ? t.quotes.statusDraft :
               quote.quoteStatus === 'closed' ? t.quotes.statusClosed :
               quote.quoteStatus === 'rejected' ? t.quotes.statusRejected :
               quote.quoteStatus === 'started' ? t.quotes.statusStarted :
               t.quotes.statusCompleted}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Invoicing button */}
          {!quote.isDeleted && hasPermission('invoices.issue') && (canInvoice ? (
            <Button onClick={handleOpenInvoiceModal}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.invoices.invoicing}
            </Button>
          ) : invoiceDisabledReason ? (
            <Button
              variant="secondary"
              onClick={() => setInvoiceDisabledModalOpen(true)}
              className="opacity-50"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.invoices.invoicing}
            </Button>
          ) : null)}

          {/* PDF Download button */}
          <Button onClick={handleDownloadPdf}>
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          <OdontogramHost
            patientId={patient.patientId}
            mode="view"
            initialState={initialOdontogramState}
            onChange={() => {}}
            hidePanel
          />

          {/* Doctor and Expected Treatments Section */}
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center gap-6">
                {/* Doctor Selector */}
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium text-gray-700">
                    {t.quotes.doctor}:
                  </label>
                  <Select
                    value={quote.doctorId || (settings.doctors.length > 0 ? settings.doctors[0].id : '')}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    options={settings.doctors.map((doc) => ({
                      value: doc.id,
                      label: doc.name || t.patients.unknownDoctor,
                    }))}
                    className="w-56"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                </div>

                {/* Expected Treatments, Language and Discount Preset */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    {t.quotes.expectedTreatments}
                  </label>
                  <Select
                    value={String(quote.expectedTreatments || 1)}
                    onChange={(e) => handleExpectedTreatmentsChange(parseInt(e.target.value))}
                    options={[
                      ...Array.from({ length: 9 }, (_, i) => ({
                        value: String(i + 1),
                        label: `${i + 1} ${t.quotes.treatmentSession}`,
                      })),
                    ]}
                    className="w-40"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                  <label className="text-sm font-medium text-gray-700">{t.quotes.quoteLang}</label>
                  <Select
                    value={effectiveQuoteLang}
                    onChange={(e) => editQuote(quote.quoteId, { quoteLang: e.target.value as 'hu' | 'en' | 'de' })}
                    options={[
                      { value: 'hu', label: 'Magyar' },
                      { value: 'en', label: 'English' },
                      { value: 'de', label: 'Deutsch' },
                    ]}
                    className="w-40"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      {t.quotes.generalDiscount}
                    </label>
                    <Select
                      value={lineDiscountPreset}
                      onChange={(e) => handleLineDiscountPresetChange(e.target.value as LineDiscountPreset)}
                      options={[
                        { value: 'none', label: t.common.none },
                        { value: '10', label: '10%' },
                        { value: '20', label: '20%' },
                        { value: '30', label: '30%' },
                        { value: '40', label: '40%' },
                        { value: '50', label: '50%' },
                        { value: 'custom', label: t.common.custom },
                      ]}
                      className="w-28"
                      disabled={quote.quoteStatus !== 'draft'}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t.quotes.items}</h2>
              {quote.quoteStatus === 'draft' && (
                <Button onClick={() => setIsItemSelectorOpen(true)}>
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  {t.quotes.addItem}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {quote.items.length === 0 ? (
                <EmptyState
                  icon={<EmptyCatalogIcon />}
                  title={t.quotes.noItems}
                  description={t.quotes.addItemsHint}
                  actionLabel={t.quotes.addItem}
                  onAction={() => setIsItemSelectorOpen(true)}
                />
              ) : (
                <div className="space-y-3">
                  {quote.items.map((item, index) => {
                    // Determine if item has been invoiced (non-storno invoice exists)
                    const matchingInvoice = ['started', 'completed'].includes(quote.quoteStatus)
                      ? quoteInvoices.find((inv) => inv.status !== 'storno' && inv.items.some((ii) => ii.name === item.quoteName))
                      : undefined;
                    return (
                    <QuoteItemRow
                      key={item.lineId}
                      item={item}
                      index={index}
                      expectedTreatments={quote.expectedTreatments || 1}
                      lineDiscountPreset={lineDiscountPreset}
                      onUpdate={(data) => handleUpdateItem(item.lineId, data)}
                      onRemove={() => handleRemoveItem(item.lineId)}
                      isEditable={quote.quoteStatus === 'draft'}
                      isDragging={draggedIndex === index}
                      isDragOver={dragOverIndex === index}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      invoicedInvoiceNumber={matchingInvoice?.szamlazzInvoiceNumber || (matchingInvoice ? matchingInvoice.id.slice(0, 8) : undefined)}
                    />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardContent className="space-y-4">
              <TextArea
                label={t.quotes.commentToPatient}
                value={quote.commentToPatient}
                onChange={(e) => handleCommentChange(e.target.value)}
                placeholder={t.quotes.commentPlaceholder}
                rows={3}
                disabled={quote.quoteStatus !== 'draft'}
              />
              <TextArea
                label={t.quotes.internalNotes}
                value={quote.internalNotes}
                onChange={(e) => handleInternalNotesChange(e.target.value)}
                placeholder={t.quotes.internalNotesPlaceholder}
                rows={2}
                disabled={quote.quoteStatus !== 'draft'}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          {/* Valid Until */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{t.quotes.quoteValidity}</h3>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-900">
                  {formatDate(quote.validUntil)}
                </span>
                {(() => {
                  const valid = new Date(quote.validUntil.slice(0, 10) + 'T00:00:00');
                  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');
                  const diff = Math.round((valid.getTime() - today.getTime()) / 86400000);
                  return diff > 0
                    ? <span className="text-sm text-gray-500 ml-1">({diff} {t.quotes.quoteValidityDays})</span>
                    : <span className="text-sm text-red-500 font-medium ml-1">({t.quotes.quoteValidityExpired})</span>;
                })()}
                <button
                  onClick={() => {
                    setValidUntilText(formatBirthDateForDisplay(quote.validUntil.slice(0, 10)));
                    setValidUntilModalOpen(true);
                  }}
                  className="p-1 text-gray-400 hover:text-dental-600 transition-colors"
                  title={t.common.edit}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Acceptance Card */}
          <Card>
            <CardHeader className="flex items-center justify-between">
              <h3 className="font-semibold">{t.quotes.acceptanceCardTitle}</h3>
              <QuoteProgressBar status={quote.quoteStatus} isDeleted={quote.isDeleted} />
            </CardHeader>
            <CardContent>
              {quote.isDeleted ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t.quotes.acceptanceDeleted}</span>
                  <button
                    type="button"
                    onClick={() => restoreQuote(quote.quoteId)}
                    className="rounded-md border border-gray-200 p-1.5 text-green-600 hover:bg-green-50 transition-colors"
                    title={t.quotes.restoreQuote}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 4 1 10 7 10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                  </button>
                </div>
              ) : quote.quoteStatus === 'draft' ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">{t.quotes.acceptanceDraft}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleClose}>
                      <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                      {t.quotes.close}
                    </Button>
                    {hasPermission('quotes.delete') && (
                      <Button size="sm" variant="danger" onClick={() => setDeleteConfirm(true)}>
                        <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        {t.common.delete}
                      </Button>
                    )}
                  </div>
                </div>
              ) : quote.quoteStatus === 'closed' ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">{t.quotes.acceptanceClosed}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => reopenQuote(quote.quoteId)}
                        className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                        title={t.quotes.reopen}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                      </button>
                      {hasPermission('quotes.delete') && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(true)}
                          className="rounded-md border border-gray-200 p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                          title={t.common.delete}
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="success" onClick={() => acceptQuote(quote.quoteId)}>
                      <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t.quotes.accept}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => rejectQuote(quote.quoteId)}>
                      <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      {t.quotes.reject}
                    </Button>
                  </div>
                </div>
              ) : quote.quoteStatus === 'started' ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">{t.quotes.acceptanceStarted}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => revokeAcceptance(quote.quoteId)}
                        className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                        title={t.quotes.revokeAcceptance}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="success" onClick={() => completeTreatment(quote.quoteId)}>
                      <svg className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {t.quotes.completeTreatment}
                    </Button>
                  </div>
                </div>
              ) : quote.quoteStatus === 'rejected' ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{t.quotes.acceptanceRejected}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => revokeRejection(quote.quoteId)}
                      className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                      title={t.quotes.revokeRejection}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    </button>
                    {hasPermission('quotes.delete') && (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(true)}
                        className="rounded-md border border-gray-200 p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                        title={t.common.delete}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ) : quote.quoteStatus === 'completed' ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {remainingAmount <= 0 ? t.invoices.completedAndFullyInvoiced : t.quotes.acceptanceCompleted}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => reopenTreatment(quote.quoteId)}
                      className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                      title={t.quotes.reopenTreatment}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Patient Info */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{t.quotes.patientCard}</h3>
            </CardHeader>
            <CardContent>
              <p className="font-medium">{formatPatientName(patient.lastName, patient.firstName, patient.title)}</p>
              <p className="text-sm text-gray-500">{formatDate(patient.birthDate, 'long')}</p>
              {patient.phone && <p className="text-sm text-gray-500">{patient.phone}</p>}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">{t.quotes.summary}</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t.quotes.subtotal}</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>

              {totals.lineDiscounts > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.quotes.lineDiscounts}</span>
                  <span className="text-red-600">-{formatCurrency(totals.lineDiscounts)}</span>
                </div>
              )}

              {/* Global Discount - hidden in non-draft states when value is 0 */}
              {!(quote.globalDiscountValue === 0 && ['closed', 'started', 'completed'].includes(quote.quoteStatus)) && (
              <div className="pt-3 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.quotes.globalDiscount}
                </label>
                <div className="flex gap-2">
                  <Select
                    value={quote.globalDiscountType}
                    onChange={(e) =>
                      handleGlobalDiscountChange(
                        e.target.value as DiscountType,
                        quote.globalDiscountValue
                      )
                    }
                    options={[
                      { value: 'percent', label: '%' },
                      { value: 'fixed', label: 'Ft' },
                    ]}
                    className="w-20"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                  <Input
                    type="number"
                    value={quote.globalDiscountValue || ''}
                    onChange={(e) => {
                      const inputValue = parseFloat(e.target.value) || 0;
                      const subtotalAfterLineDiscounts = totals.subtotal - totals.lineDiscounts;
                      const maxValue = quote.globalDiscountType === 'percent' ? 100 : subtotalAfterLineDiscounts;
                      const clampedValue = Math.min(Math.max(0, inputValue), maxValue);
                      handleGlobalDiscountChange(quote.globalDiscountType, clampedValue);
                    }}
                    min={0}
                    max={quote.globalDiscountType === 'percent' ? 100 : (totals.subtotal - totals.lineDiscounts)}
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                </div>
              </div>
              )}

              {totals.globalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t.quotes.globalDiscount}</span>
                  <span className="text-red-600">-{formatCurrency(totals.globalDiscount)}</span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{t.quotes.total}</span>
                <span className="text-2xl font-bold text-dental-600">
                  {formatCurrency(Math.max(0, totals.total - invoicedAmount))}
                </span>
              </div>
              {invoicedAmount > 0 && (
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.invoices.invoicedAmount}</span>
                    <span className="font-medium">{formatCurrency(invoicedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t.invoices.remainingAmount}</span>
                    <span className={`font-medium ${remainingAmount <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {formatCurrency(remainingAmount)}
                    </span>
                  </div>
                </div>
              )}
            </CardFooter>
          </Card>

          {/* Issued Invoices */}
          {quoteInvoices.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-semibold">{t.invoices.issuedInvoices}</h3>
              </CardHeader>
              <CardContent className="space-y-2">
                {quoteInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{formatDate(inv.createdAt)}</span>
                      <Link to={`/invoices/${inv.id}`} className="text-dental-600 hover:text-dental-700 hover:underline font-medium">
                        {inv.szamlazzInvoiceNumber || inv.id.slice(0, 8)}
                      </Link>
                      {inv.status === 'storno' && (
                        <Badge variant="danger">{t.invoices.statusStorno}</Badge>
                      )}
                    </div>
                    <span className={`font-medium ${inv.status === 'storno' ? 'line-through text-gray-400' : ''}`}>
                      {formatCurrency(inv.totalGross, inv.currency)}
                    </span>
                  </div>
                ))}
                <div className="pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t.invoices.invoicedAmount}</span>
                    <span className="font-medium">{formatCurrency(invoicedAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">{t.invoices.remainingAmount}</span>
                    <span className={`font-semibold ${remainingAmount <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                      {formatCurrency(remainingAmount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Modal
        isOpen={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        title={t.invoices.invoicing}
        size="xl"
      >
        <div className="space-y-4">
          {/* Buyer section */}
          <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">{t.invoices.buyerSection}</h4>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              label={t.invoices.buyerName}
              value={invoiceForm.buyerName}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerName: e.target.value }))}
            />
            <Input
              label={t.invoices.buyerEmail}
              value={invoiceForm.buyerEmail}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerEmail: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label={t.invoices.buyerZip}
              value={invoiceForm.buyerZip}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerZip: e.target.value }))}
            />
            <Input
              label={t.invoices.buyerCity}
              value={invoiceForm.buyerCity}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerCity: e.target.value }))}
            />
            <Input
              label={t.invoices.buyerAddress}
              value={invoiceForm.buyerAddress}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerAddress: e.target.value }))}
            />
          </div>

          {/* Invoice data section */}
          <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">{t.invoices.invoiceDataSection}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.invoices.issueDate}</label>
              <div className="relative">
                <input
                  value={issueDateText}
                  onChange={(e) => {
                    setIssueDateText(e.target.value);
                    const parsed = parseBirthDateFromDisplay(e.target.value);
                    if (parsed) setInvoiceForm((prev) => ({ ...prev, issueDate: parsed }));
                    else if (!e.target.value) setInvoiceForm((prev) => ({ ...prev, issueDate: '' }));
                  }}
                  placeholder={getDatePlaceholder()}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
                />
                <input
                  type="date"
                  value={invoiceForm.issueDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setInvoiceForm((prev) => ({ ...prev, issueDate: e.target.value }));
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
                    if (parsed) setInvoiceForm((prev) => ({ ...prev, fulfillmentDate: parsed }));
                    else if (!e.target.value) setInvoiceForm((prev) => ({ ...prev, fulfillmentDate: '' }));
                  }}
                  placeholder={getDatePlaceholder()}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
                />
                <input
                  type="date"
                  value={invoiceForm.fulfillmentDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setInvoiceForm((prev) => ({ ...prev, fulfillmentDate: e.target.value }));
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
                    if (parsed) setInvoiceForm((prev) => ({ ...prev, dueDate: parsed }));
                    else if (!e.target.value) setInvoiceForm((prev) => ({ ...prev, dueDate: '' }));
                  }}
                  placeholder={getDatePlaceholder()}
                  className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
                />
                <input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }));
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
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select
              label={t.invoices.paymentMethod}
              value={invoiceForm.paymentMethod}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
              options={[
                { value: 'atutalas', label: t.invoices.paymentTransfer },
                { value: 'keszpenz', label: t.invoices.paymentCash },
                { value: 'bankkartya', label: t.invoices.paymentCard },
              ]}
            />
            <Input
              label={t.invoices.comment}
              value={invoiceComment}
              onChange={(e) => setInvoiceComment(e.target.value)}
            />
          </div>

          {/* Invoice type selector */}
          <div>
            <Select
              label={t.invoices.invoiceType}
              value={invoiceType}
              onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
              options={[
                { value: 'normal', label: t.invoices.invoiceTypeNormal, disabled: hasActiveAdvanceInvoice },
                { value: 'advance', label: t.invoices.invoiceTypeAdvance, disabled: (() => {
                  const itemsGross = invoiceItems.reduce((sum, it) => {
                    const net = it.qty * it.unitPriceNet;
                    return sum + net + (net * it.vatRate / 100);
                  }, 0);
                  return itemsGross >= remainingAmount;
                })() },
                { value: 'final', label: t.invoices.invoiceTypeFinal },
              ]}
              className="w-64"
            />
          </div>

          {/* Invoice items (read-only qty/price) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">{t.invoices.items}</h3>
            </div>
            {invoiceItems.length === 0 ? (
              <p className="text-sm text-gray-400">{t.quotes.noItems}</p>
            ) : (
              <div className="space-y-2">
                {invoiceItems.map((item, idx) => {
                  const net = Number((item.qty * item.unitPriceNet).toFixed(2));
                  const vat = Number(((net * item.vatRate) / 100).toFixed(2));
                  const gross = Number((net + vat).toFixed(2));
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 rounded border border-gray-200 p-2 text-sm ${
                        invoiceDraggedIndex === idx ? 'opacity-50' : ''
                      } ${invoiceDragOverIndex === idx ? 'border-dental-500 border-2' : ''}`}
                      draggable
                      onDragStart={() => setInvoiceDraggedIndex(idx)}
                      onDragOver={(e) => { e.preventDefault(); setInvoiceDragOverIndex(idx); }}
                      onDragEnd={() => {
                        if (invoiceDraggedIndex !== null && invoiceDragOverIndex !== null && invoiceDraggedIndex !== invoiceDragOverIndex) {
                          setInvoiceItems((prev) => {
                            const next = [...prev];
                            const [moved] = next.splice(invoiceDraggedIndex, 1);
                            next.splice(invoiceDragOverIndex, 0, moved);
                            return next;
                          });
                        }
                        setInvoiceDraggedIndex(null);
                        setInvoiceDragOverIndex(null);
                      }}
                    >
                      <div className="text-gray-400 cursor-grab">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                      <span className="text-gray-500 w-6 text-center">{idx + 1}.</span>
                      <span className="flex-1 font-medium">{item.name}</span>
                      <span className="text-gray-600 w-10 text-center">{item.qty}</span>
                      <span className="text-gray-500">{item.unit}</span>
                      <span className="text-gray-600 w-24 text-right">{formatCurrency(item.unitPriceNet)}</span>
                      <span className="text-gray-500 w-12 text-center">{item.vatRate}%</span>
                      <span className="w-24 text-right font-semibold">{formatCurrency(gross)}</span>
                      <button
                        type="button"
                        onClick={() => setInvoiceItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-700"
                      >
                        &times;
                      </button>
                    </div>
                  );
                })}

                {/* Advance invoice: editable advance item */}
                {invoiceType === 'advance' && (
                  <div className="flex items-center gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-sm">
                    <span className="text-gray-500 w-6 text-center">{invoiceItems.length + 1}.</span>
                    <span className="flex-1 font-medium text-amber-800">{t.invoices.advanceItemName}</span>
                    <Input
                      type="number"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                      min={0}
                      max={remainingAmount}
                      className="w-28"
                    />
                    <span className="text-gray-500">{quote.currency}</span>
                  </div>
                )}

                {/* Final invoice: negative advance deduction (non-removable) */}
                {invoiceType === 'final' && hasActiveAdvanceInvoice && (() => {
                  const advanceTotal = quoteInvoices
                    .filter((inv) => inv.status !== 'storno' && inv.invoiceType === 'advance')
                    .reduce((sum, inv) => sum + (inv.totalGross || 0), 0);
                  return (
                    <div className="flex items-center gap-2 rounded border border-blue-300 bg-blue-50 p-2 text-sm">
                      <span className="text-gray-500 w-6 text-center">{invoiceItems.length + 1}.</span>
                      <span className="flex-1 font-medium text-blue-800">{t.invoices.advanceItemName}</span>
                      <span className="w-24 text-right font-semibold text-red-600">-{formatCurrency(advanceTotal)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Summary section */}
          <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">{t.invoices.summarySection}</h4>
          {(() => {
            const itemsGross = invoiceItems.reduce((sum, it) => {
              const net = it.qty * it.unitPriceNet;
              return sum + net + (net * it.vatRate / 100);
            }, 0);
            let currentTotal = Math.round((itemsGross + Number.EPSILON) * 100) / 100;
            if (invoiceType === 'advance') {
              currentTotal = advanceAmount;
            } else if (invoiceType === 'final' && hasActiveAdvanceInvoice) {
              const advTotal = quoteInvoices
                .filter((inv) => inv.status !== 'storno' && inv.invoiceType === 'advance')
                .reduce((sum, inv) => sum + (inv.totalGross || 0), 0);
              currentTotal = Math.round((itemsGross - advTotal + Number.EPSILON) * 100) / 100;
            }
            const currentRemaining = Math.max(0, totals.total - invoicedAmount - currentTotal);
            return (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="font-medium">{t.invoices.totalAmount}:</span>
                  <span className="font-semibold">{formatCurrency(currentTotal, quote.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">{t.invoices.quoteRemainingPart}:</span>
                  <span className={`font-medium ${currentRemaining <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {currentRemaining <= 0 ? t.invoices.noneRemaining : formatCurrency(currentRemaining, quote.currency)}
                  </span>
                </div>
              </div>
            );
          })()}

          {invoicePreviewTotals && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p>{t.invoices.netTotal}: {formatCurrency(invoicePreviewTotals.net, quote.currency)}</p>
              <p>{t.invoices.vatTotal}: {formatCurrency(invoicePreviewTotals.vat, quote.currency)}</p>
              <p className="font-semibold">{t.invoices.grossTotal}: {formatCurrency(invoicePreviewTotals.gross, quote.currency)}</p>
            </div>
          )}

          {invoiceError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {invoiceError}
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">{t.invoices.xmlPreview}</summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">
              {invoicePreviewXml || t.invoices.xmlNotAvailable}
            </pre>
          </details>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInvoiceModalOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button variant="secondary" onClick={handlePreviewInvoice} disabled={invoiceSubmitting}>
              {t.invoices.preview}
            </Button>
            <Button onClick={handleCreateInvoice} disabled={invoiceSubmitting}>
              {t.invoices.createInvoice}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Item Selector Modal */}
      <Modal
        isOpen={isItemSelectorOpen}
        onClose={() => {
          setIsItemSelectorOpen(false);
          setItemSearchQuery('');
          setSelectedCategory('all');
        }}
        title={t.quotes.selectItem}
        size="xl"
      >
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={itemSearchQuery}
                onChange={(e) => setItemSearchQuery(e.target.value)}
                placeholder={t.quotes.searchCatalog}
                className="pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent text-base"
                autoFocus
              />
              {itemSearchQuery && (
                <button
                  onClick={() => setItemSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as CatalogCategory | 'all')}
              options={[
                { value: 'all', label: t.common.all },
                ...categories.map((cat) => ({ value: cat, label: getCategoryName(cat, appLanguage) })),
              ]}
              className="w-48"
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredCatalogItems.length === 0 ? (
              <p className="text-center text-gray-500 py-8">{t.common.noResults}</p>
            ) : (
              filteredCatalogItems.map((item) => (
                <div
                  key={item.catalogItemId}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    handleAddItem(item);
                    setIsItemSelectorOpen(false);
                    setItemSearchQuery('');
                    setSelectedCategory('all');
                  }}
                >
                  <div>
                    <p className="font-medium">{getCatalogDisplayName(item, appLanguage)}</p>
                    <p className="text-sm text-gray-500">
                      {formatCode(item)} | {getCategoryName(item.catalogCategory, appLanguage)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.catalogPrice)}</p>
                    <p className="text-sm text-gray-500">/ {item.catalogUnit}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Event Log */}
      {quote.events && quote.events.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <h3 className="font-semibold">{t.quotes.eventLog}</h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...quote.events].reverse().map((event) => (
                <div key={event.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">{formatDateTime(event.timestamp)}</span>
                    {event.type === 'invoice_created' ? (
                      <span className="font-medium">
                        {(() => {
                          const evtAmount = formatCurrency(event.invoiceAmount || 0, event.invoiceCurrency as 'HUF' | 'EUR' | undefined);
                          const evtNumber = event.invoiceNumber || '';
                          // Calculate remaining after this event
                          const evtIdx = quote.events.indexOf(event);
                          const invoicedUpToEvent = quote.events
                            .filter((e, i) => e.type === 'invoice_created' && i <= evtIdx)
                            .reduce((sum, e) => sum + (e.invoiceAmount || 0), 0);
                          const evtRemaining = Math.max(0, totals.total - invoicedUpToEvent);
                          const evtRemainingStr = formatCurrency(evtRemaining, event.invoiceCurrency as 'HUF' | 'EUR' | undefined);
                          const eType = event.invoiceType || 'normal';
                          let msg = '';
                          if (eType === 'advance') {
                            msg = t.invoices.eventAdvanceCreated
                              .replace('{number}', evtNumber).replace('{amount}', evtAmount).replace('{remaining}', evtRemainingStr);
                          } else if (eType === 'final') {
                            msg = t.invoices.eventFinalCreated
                              .replace('{number}', evtNumber).replace('{amount}', evtAmount);
                          } else if (evtRemaining <= 0) {
                            msg = t.invoices.eventInvoiceFull
                              .replace('{number}', evtNumber).replace('{amount}', evtAmount);
                          } else {
                            msg = t.invoices.eventInvoicePartial
                              .replace('{number}', evtNumber).replace('{amount}', evtAmount).replace('{remaining}', evtRemainingStr);
                          }
                          return msg;
                        })()}{' '}
                        <Link
                          to={`/invoices/${event.invoiceId}`}
                          className="text-dental-600 hover:text-dental-700 hover:underline"
                        >
                          {event.invoiceNumber}
                        </Link>
                      </span>
                    ) : (
                      <span className="font-medium">
                        {event.type === 'created' ? t.quotes.eventCreated :
                         event.type === 'closed' ? t.quotes.eventClosed :
                         event.type === 'reopened' ? t.quotes.eventReopened :
                         event.type === 'accepted' ? t.quotes.eventAccepted :
                         event.type === 'acceptance_revoked' ? t.quotes.eventAcceptanceRevoked :
                         event.type === 'rejected' ? t.quotes.eventRejected :
                         event.type === 'rejection_revoked' ? t.quotes.eventRejectionRevoked :
                         event.type === 'completed' ? t.quotes.eventCompleted :
                         event.type === 'completion_revoked' ? t.quotes.eventCompletionRevoked :
                         event.type === 'deleted' ? t.quotes.eventDeleted :
                         event.type}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500">{event.doctorName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice disabled reason modal */}
      <Modal
        isOpen={invoiceDisabledModalOpen}
        onClose={() => setInvoiceDisabledModalOpen(false)}
        title={t.invoices.invoicing}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">{invoiceDisabledReason}</p>
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => setInvoiceDisabledModalOpen(false)}>
              {t.common.close}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t.common.confirm}
        message={t.quotes.deleteConfirm}
        confirmText={t.common.delete}
        cancelText={t.common.cancel}
        variant="danger"
      />

      {/* Valid Until Edit Modal */}
      <Modal
        isOpen={validUntilModalOpen}
        onClose={() => setValidUntilModalOpen(false)}
        title={t.quotes.quoteValidity}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{t.quotes.quoteValidityDescription}</p>
          <div className="relative">
            <input
              value={validUntilText}
              onChange={(e) => {
                setValidUntilText(e.target.value);
                const parsed = parseBirthDateFromDisplay(e.target.value);
                if (parsed) {
                  editQuote(quote.quoteId, { validUntil: parsed });
                }
              }}
              placeholder={getDatePlaceholder()}
              className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300"
            />
            <input
              type="date"
              value={quote.validUntil.slice(0, 10)}
              onChange={(e) => {
                if (e.target.value) {
                  editQuote(quote.quoteId, { validUntil: e.target.value });
                  setValidUntilText(formatBirthDateForDisplay(e.target.value));
                }
              }}
              className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer"
              tabIndex={-1}
            />
            <svg
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{t.quotes.quoteValidityAdjust}</span>
            {[30, 60, 90, 120].map((days) => {
              const newDate = new Date();
              newDate.setDate(newDate.getDate() + days);
              const isoDate = newDate.toISOString().slice(0, 10);
              return (
                <button
                  key={days}
                  onClick={() => {
                    editQuote(quote.quoteId, { validUntil: isoDate });
                    setValidUntilText(formatBirthDateForDisplay(isoDate));
                  }}
                  className="px-3 py-1 text-sm font-medium rounded-lg border border-gray-300 hover:bg-dental-50 hover:border-dental-400 transition-colors"
                >
                  {days}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="primary" onClick={() => setValidUntilModalOpen(false)}>
              {t.common.save}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

interface QuoteItemRowProps {
  item: QuoteItem;
  index: number;
  expectedTreatments: number;
  lineDiscountPreset: 'none' | '10' | '20' | '30' | '40' | '50' | 'custom';
  onUpdate: (data: Partial<QuoteItem>) => void;
  onRemove: () => void;
  isEditable: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  invoicedInvoiceNumber?: string;
}

function QuoteItemRow({
  item,
  index,
  expectedTreatments,
  lineDiscountPreset,
  onUpdate,
  onRemove,
  isEditable,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  invoicedInvoiceNumber,
}: QuoteItemRowProps) {
  const { t } = useSettings();
  const lineTotal = calculateLineTotal(item);
  const discountAmount = calculateLineDiscountAmount(item);

  const treatmentSessionOptions = Array.from({ length: expectedTreatments }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}. ${t.quotes.treatmentSession}`,
  }));

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        invoicedInvoiceNumber ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
      } ${isDragging ? 'opacity-50 scale-95' : ''
      } ${isDragOver ? 'border-dental-500 border-2' : ''} ${isEditable ? 'cursor-move' : ''}`}
      draggable={isEditable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          {isEditable && (
            <div className="text-gray-400 mt-1 cursor-grab">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          )}
          <span className="text-gray-400 font-medium mt-1">{index + 1}.</span>
          <div className="flex-1">
            <p className="font-medium mb-2">{item.quoteName}</p>

            <div className="text-sm space-y-2">
              <div className="flex flex-wrap items-center gap-3">

                <div className="flex items-center gap-6 mr-14">
                  <span className="text-gray-500">{t.quotes.unitPrice}:</span>
                  <span className="font-medium">{formatCurrency(item.quoteUnitPriceGross)}</span>
                </div>

                <div className="flex items-center gap-2 mr-4">
                  <span className="text-gray-500">{t.quotes.quantity}:</span>
                  {isEditable ? (
                    <Input
                      type="number"
                      value={item.quoteQty}
                      onChange={(e) => onUpdate({ quoteQty: parseInt(e.target.value) || 1 })}
                      min={1}
                      className="w-14"
                    />
                  ) : (
                    <span className="font-medium">{item.quoteQty}</span>
                  )}
                  <span className="text-gray-500">{item.quoteUnit}</span>
                </div>

                {isEditable && lineDiscountPreset !== 'none' && item.quoteUnitPriceGross > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">{t.quotes.discountLabel}</span>
                    <Input
                      type="number"
                      value={item.quoteLineDiscountValue || ''}
                      onChange={(e) => {
                        const inputValue = parseFloat(e.target.value) || 0;
                        const lineGross = item.quoteUnitPriceGross * item.quoteQty;
                        const maxValue = item.quoteLineDiscountType === 'percent' ? 100 : lineGross;
                        const clampedValue = Math.min(Math.max(0, inputValue), maxValue);
                        onUpdate({ quoteLineDiscountValue: clampedValue });
                      }}
                      min={0}
                      max={item.quoteLineDiscountType === 'percent' ? 100 : item.quoteUnitPriceGross * item.quoteQty}
                      className="w-20"
                    />
                    <Select
                        value={item.quoteLineDiscountType}
                        onChange={(e) =>
                            onUpdate({ quoteLineDiscountType: e.target.value as DiscountType })
                        }
                        options={[
                          { value: 'percent', label: '%' },
                          { value: 'fixed', label: 'Ft' },
                        ]}
                        className="w-16"
                    />
                  </div>
                )}

                {!isEditable && item.quoteLineDiscountValue > 0 && (
                  <span className="text-red-600">
                    -{' '}
                    {item.quoteLineDiscountType === 'percent'
                      ? `${item.quoteLineDiscountValue}%`
                      : formatCurrency(item.quoteLineDiscountValue)}
                  </span>
                )}

                {!isEditable && item.treatmentSession && expectedTreatments > 1 && (
                  <span className="text-gray-500">
                    {t.quotes.treatmentLabel} <span className="font-medium">{item.treatmentSession}.</span>
                  </span>
                )}

                {item.toothNum && (
                  <span className="text-gray-500">
                    {t.quotes.toothLabel} <span className="font-medium">{item.toothNum}</span>
                  </span>
                )}
              </div>

              {/* Treated Area Selector (third row) */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500">{t.quotes.treatedArea}</span>
                {item.quoteUnit === 'alkalom' && (
                  <span className="font-medium text-gray-700">{t.quotes.fullMouth}</span>
                )}
                {item.quoteUnit === 'db' && (
                  isEditable ? (
                    <Input
                      type="text"
                      value={item.treatedArea || ''}
                      onChange={(e) => onUpdate({ treatedArea: e.target.value })}
                      placeholder={t.quotes.toothPlaceholder}
                      className="w-48"
                    />
                  ) : (
                    <span className="font-medium">{item.treatedArea || '-'}</span>
                  )
                )}
                {item.quoteUnit === 'állcsont' && (
                  isEditable ? (
                    <Select
                      value={item.treatedArea || 'lower'}
                      onChange={(e) => {
                        const value = e.target.value;
                        const newQty = value === 'both' ? 2 : 1;
                        onUpdate({ treatedArea: value, quoteQty: newQty });
                      }}
                      options={[
                        { value: 'lower', label: t.quotes.lowerJaw },
                        { value: 'upper', label: t.quotes.upperJaw },
                        { value: 'both', label: t.quotes.bothJaws },
                      ]}
                      className="w-52"
                    />
                  ) : (
                    <span className="font-medium">
                      {item.treatedArea === 'lower' ? t.quotes.lowerJaw :
                       item.treatedArea === 'upper' ? t.quotes.upperJaw :
                       item.treatedArea === 'both' ? t.quotes.bothJaws : '-'}
                    </span>
                  )
                )}
                {item.quoteUnit === 'kvadráns' && (
                  isEditable ? (
                    <Select
                      value={item.treatedArea || 'q1'}
                      onChange={(e) => onUpdate({ treatedArea: e.target.value, quoteQty: 1 })}
                      options={[
                        { value: 'q1', label: t.quotes.quadrant1 },
                        { value: 'q2', label: t.quotes.quadrant2 },
                        { value: 'q3', label: t.quotes.quadrant3 },
                        { value: 'q4', label: t.quotes.quadrant4 },
                      ]}
                      className="w-56"
                    />
                  ) : (
                    <span className="font-medium">
                      {item.treatedArea === 'q1' ? t.quotes.quadrant1 :
                       item.treatedArea === 'q2' ? t.quotes.quadrant2 :
                       item.treatedArea === 'q3' ? t.quotes.quadrant3 :
                       item.treatedArea === 'q4' ? t.quotes.quadrant4 : '-'}
                    </span>
                  )
                )}
                {item.quoteUnit === 'fog' && (
                  isEditable ? (
                    <Input
                      type="text"
                      value={item.treatedArea || ''}
                      onChange={(e) => onUpdate({ treatedArea: e.target.value })}
                      placeholder={t.quotes.toothPlaceholder}
                      className="w-48"
                    />
                  ) : (
                    <span className="font-medium">{item.treatedArea || '-'}</span>
                  )
                )}
              </div>

              {/* Treatment Session Selector (fourth row) */}
              {isEditable && expectedTreatments > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{t.quotes.treatmentSessionNumber}</span>
                  <Select
                    value={String(item.treatmentSession || 1)}
                    onChange={(e) => onUpdate({ treatmentSession: parseInt(e.target.value) })}
                    options={treatmentSessionOptions}
                    className="w-28"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            <p className="font-semibold text-lg">{formatCurrency(lineTotal)}</p>
            {invoicedInvoiceNumber && (
              <span title={t.invoices.invoicedItem.replace('{invoiceNumber}', invoicedInvoiceNumber)}>
                <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
          </div>
          {discountAmount > 0 && (
            <p className="text-sm text-red-600">-{formatCurrency(discountAmount)}</p>
          )}
          {isEditable && (
            <button
              onClick={onRemove}
              className="mt-2 text-sm text-red-600 hover:text-red-700"
            >
              {t.common.remove}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
