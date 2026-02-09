import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { usePatients, useQuotes, useCatalog } from '../hooks';
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
} from '../components/common';
import {
  formatCurrency,
  formatPatientName,
  formatQuoteId,
  formatDate,
  formatDateTime,
  calculateQuoteTotals,
  calculateLineTotal,
  calculateLineDiscountAmount,
} from '../utils';
import { generateQuotePdf } from '../components/pdf/QuotePdfGenerator';
import { OdontogramHost } from '../modules/odontogram/OdontogramHost';
import { loadCurrent } from '../modules/odontogram/odontogramStorage';
import type { OdontogramState } from '../modules/odontogram/types';
import { previewInvoice, createInvoice } from '../modules/invoicing/api';
import { saveInvoice, getInvoicesByQuote } from '../modules/invoicing/storage';
import type { InvoiceRecord } from '../types/invoice';

// Per-line discount preset type
type LineDiscountPreset = 'none' | '10' | '20' | '30' | '40' | '50' | 'custom';

export function QuoteEditorPage() {
  const { patientId, quoteId } = useParams<{ patientId: string; quoteId: string }>();
  const navigate = useNavigate();
  const { t, settings } = useSettings();
  const { getPatient } = usePatients();
  const {
    getQuote,
    createQuote,
    addItemToQuote,
    updateQuoteItem,
    removeItemFromQuote,
    reorderQuoteItems,
    editQuote,
    deleteQuote,
    canDeleteQuote,
    closeQuote,
    reopenQuote,
    acceptQuote,
    rejectQuote,
    revokeAcceptance,
    revokeRejection,
    startTreatment,
    revokeStart,
    completeTreatment,
    reopenTreatment,
  } = useQuotes();
  const { activeItems, itemsByCategory } = useCatalog();

  const [isItemSelectorOpen, setIsItemSelectorOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [lineDiscountPreset, setLineDiscountPreset] = useState<LineDiscountPreset>('none');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [initialOdontogramState, setInitialOdontogramState] = useState<OdontogramState | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
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
  const [quoteInvoices, setQuoteInvoices] = useState<InvoiceRecord[]>([]);
  const [invoiceDraggedIndex, setInvoiceDraggedIndex] = useState<number | null>(null);
  const [invoiceDragOverIndex, setInvoiceDragOverIndex] = useState<number | null>(null);
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

  const canInvoice = (quote?.quoteStatus === 'accepted_in_progress' || quote?.quoteStatus === 'started') && remainingAmount > 0;

  const invoiceDisabledReason = (() => {
    if (!quote) return '';
    if (quote.quoteStatus === 'completed') return t.invoices.quoteSettled;
    if (quote.quoteStatus !== 'accepted_in_progress' && quote.quoteStatus !== 'started') return t.invoices.quoteNotAccepted;
    if (remainingAmount <= 0) return t.invoices.quoteFullyInvoiced;
    return '';
  })();

  const filteredCatalogItems = useMemo(() => {
    let items = activeItems;

    if (selectedCategory !== 'all') {
      items = items.filter((item) => item.catalogCategory === selectedCategory);
    }

    if (itemSearchQuery.trim()) {
      const query = itemSearchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.catalogName.toLowerCase().includes(query) ||
          item.catalogCode.toLowerCase().includes(query)
      );
    }

    return items;
  }, [activeItems, selectedCategory, itemSearchQuery]);

  if (!patient || !quote) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Árajánlat nem található</h2>
        <Link to="/patients" className="text-dental-600 hover:text-dental-700 mt-4 inline-block">
          Vissza a páciensekhez
        </Link>
      </div>
    );
  }

  const handleAddItem = (catalogItem: CatalogItem) => {
    addItemToQuote(quote.quoteId, catalogItem);
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
      },
      items: invoiceItems,
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
      saveInvoice({
        id: nanoid(),
        patientId: patient.patientId,
        quoteId: quote.quoteId,
        quoteNumber: quote.quoteNumber,
        quoteName: quote.quoteName,
        patientName: formatPatientName(patient.lastName, patient.firstName, patient.title),
        szamlazzInvoiceNumber: response.invoiceNumber || undefined,
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
      setInvoiceModalOpen(false);
      refreshQuoteInvoices();
      // Auto-complete when fully invoiced
      const updatedInvoices = getInvoicesByQuote(quote.quoteId);
      const newInvoicedAmount = updatedInvoices
        .filter((inv) => inv.status !== 'storno')
        .reduce((sum, inv) => sum + (inv.totalGross || 0), 0);
      if (newInvoicedAmount >= totals.total && (quote.quoteStatus === 'accepted_in_progress' || quote.quoteStatus === 'started')) {
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
            <span>{formatQuoteId(quote.quoteId)}</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs text-gray-400">{quote.quoteNumber}</span>
              <h1 className="text-2xl font-bold text-gray-900">{quote.quoteName}</h1>
            </div>
            <Badge
              variant={
                quote.quoteStatus === 'draft'
                  ? 'warning'
                  : quote.quoteStatus === 'completed'
                  ? 'default'
                  : quote.quoteStatus === 'rejected'
                  ? 'danger'
                  : 'success'
              }
            >
              {quote.quoteStatus === 'draft' ? t.quotes.statusDraft :
               quote.quoteStatus === 'closed_pending' ? t.quotes.statusClosedPending :
               quote.quoteStatus === 'accepted_in_progress' ? t.quotes.statusAcceptedInProgress :
               quote.quoteStatus === 'rejected' ? t.quotes.statusRejected :
               quote.quoteStatus === 'started' ? t.quotes.statusStarted :
               t.quotes.statusCompleted}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-sm">{t.quotes.quoteName}:</span>
              {quote.quoteStatus === 'draft' ? (
                <Input
                  value={quote.quoteName}
                  onChange={(e) => editQuote(quote.quoteId, { quoteName: e.target.value })}
                  className="w-64"
                  placeholder="Árajánlat neve"
                />
              ) : (
                <span className="font-medium">{quote.quoteName}</span>
              )}
            </div>
            <div className="text-gray-500 text-sm ml-auto text-right">
              {t.quotes.createdAt}: {formatDate(quote.createdAt)} | {t.quotes.modifiedAt}:{' '}
              {formatDateTime(quote.lastStatusChangeAt)} | {t.quotes.validUntil}:{' '}
              {formatDate(quote.validUntil)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Status-dependent action buttons */}
          {quote.quoteStatus === 'draft' && (
            <>
              <Button variant="secondary" onClick={() => navigate(`/patients/${patient.patientId}/quotes/${quote.quoteId}`)}>
                {t.common.edit}
              </Button>
              <Button
                variant="primary"
                onClick={handleClose}
                className="border-2 border-blue-500"
              >
                {t.quotes.close}
              </Button>
            </>
          )}

          {quote.quoteStatus === 'closed_pending' && (
            <>
              <Button
                variant="secondary"
                onClick={() => reopenQuote(quote.quoteId)}
                className="border-2 border-gray-400"
              >
                {t.quotes.reopen}
              </Button>
              <Button
                variant="success"
                onClick={() => acceptQuote(quote.quoteId)}
                className="border-2 border-green-500"
              >
                {t.quotes.accept}
              </Button>
              <Button
                variant="danger"
                onClick={() => rejectQuote(quote.quoteId)}
                className="border-2 border-red-500"
              >
                {t.quotes.reject}
              </Button>
            </>
          )}

          {quote.quoteStatus === 'accepted_in_progress' && (
            <>
              <Button
                variant="success"
                onClick={() => startTreatment(quote.quoteId)}
                className="border-2 border-green-500"
              >
                {t.quotes.startTreatment}
              </Button>
              <Button
                variant="danger"
                onClick={() => revokeAcceptance(quote.quoteId)}
                className="border-2 border-red-500"
              >
                {t.quotes.revokeAcceptance}
              </Button>
            </>
          )}

          {quote.quoteStatus === 'rejected' && (
            <Button
              variant="danger"
              onClick={() => revokeRejection(quote.quoteId)}
              className="border-2 border-red-500"
            >
              {t.quotes.revokeRejection}
            </Button>
          )}

          {quote.quoteStatus === 'started' && (
            <>
              <Button
                variant="success"
                onClick={() => completeTreatment(quote.quoteId)}
                className="border-2 border-green-500"
              >
                {t.quotes.completeTreatment}
              </Button>
              <Button
                variant="danger"
                onClick={() => revokeStart(quote.quoteId)}
                className="border-2 border-red-500"
              >
                {t.quotes.revokeStart}
              </Button>
            </>
          )}

          {quote.quoteStatus === 'completed' && (
            <Button
              variant="danger"
              onClick={() => reopenTreatment(quote.quoteId)}
              className="border-2 border-red-500"
            >
              {t.quotes.reopenTreatment}
            </Button>
          )}

          {/* Delete button - only for draft, closed_pending, rejected */}
          {canDeleteQuote(quote.quoteId) && (
            <Button
              variant="danger"
              onClick={() => setDeleteConfirm(true)}
            >
              {t.common.delete}
            </Button>
          )}

          {/* Invoicing button */}
          {canInvoice ? (
            <Button onClick={handleOpenInvoiceModal}>
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t.invoices.invoicing}
            </Button>
          ) : invoiceDisabledReason ? (
            <span className="text-xs text-gray-400 max-w-[120px] text-center" title={invoiceDisabledReason}>
              {invoiceDisabledReason}
            </span>
          ) : null}

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
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">{t.patients.dentalStatusTitle}</h2>
            </CardHeader>
            <CardContent noPadding>
              <OdontogramHost
                patientId={patient.patientId}
                mode="view"
                initialState={initialOdontogramState}
                onChange={() => {}}
                hidePanel
              />
            </CardContent>
          </Card>

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
                      label: doc.name || 'Névtelen orvos',
                    }))}
                    className="w-56"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                </div>

                {/* Expected Treatments and Discount Preset */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    Várható kezelések száma:
                  </label>
                  <Select
                    value={String(quote.expectedTreatments || 1)}
                    onChange={(e) => handleExpectedTreatmentsChange(parseInt(e.target.value))}
                    options={[
                      { value: '1', label: '1 kezelés' },
                      { value: '2', label: '2 kezelés' },
                      { value: '3', label: '3 kezelés' },
                      { value: '4', label: '4 kezelés' },
                      { value: '5', label: '5 kezelés' },
                      { value: '6', label: '6 kezelés' },
                      { value: '7', label: '7 kezelés' },
                      { value: '8', label: '8 kezelés' },
                      { value: '9', label: '9 kezelés' },
                    ]}
                    className="w-40"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">
                      Általános Kedvezmény:
                    </label>
                    <Select
                      value={lineDiscountPreset}
                      onChange={(e) => handleLineDiscountPresetChange(e.target.value as LineDiscountPreset)}
                      options={[
                        { value: 'none', label: 'Nincs' },
                        { value: '10', label: '10%' },
                        { value: '20', label: '20%' },
                        { value: '30', label: '30%' },
                        { value: '40', label: '40%' },
                        { value: '50', label: '50%' },
                        { value: 'custom', label: 'Egyedi' },
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
                  description="Adjon hozzá tételeket az árlistából"
                  actionLabel={t.quotes.addItem}
                  onAction={() => setIsItemSelectorOpen(true)}
                />
              ) : (
                <div className="space-y-3">
                  {quote.items.map((item, index) => (
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
                    />
                  ))}
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
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Páciens</h3>
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
              <h3 className="font-semibold">Összesítés</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">{t.quotes.subtotal}</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>

              {totals.lineDiscounts > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sor kedvezmények</span>
                  <span className="text-red-600">-{formatCurrency(totals.lineDiscounts)}</span>
                </div>
              )}

              {/* Global Discount */}
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

              {totals.globalDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Globális kedvezmény</span>
                  <span className="text-red-600">-{formatCurrency(totals.globalDiscount)}</span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">{t.quotes.total}</span>
                <span className="text-2xl font-bold text-dental-600">
                  {formatCurrency(totals.total)}
                </span>
              </div>
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
              label={t.invoices.issueDate}
              type="date"
              value={invoiceForm.issueDate}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, issueDate: e.target.value }))}
            />
            <Input
              label={t.invoices.fulfillmentDate}
              type="date"
              value={invoiceForm.fulfillmentDate}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, fulfillmentDate: e.target.value }))}
            />
            <Input
              label={t.invoices.dueDate}
              type="date"
              value={invoiceForm.dueDate}
              onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))}
            />
            <Input
              label={t.invoices.comment}
              value={invoiceComment}
              onChange={(e) => setInvoiceComment(e.target.value)}
            />
          </div>

          {/* Editable invoice items */}
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
                      <span className="flex-1 font-medium">{item.name}</span>
                      <Input
                        type="number"
                        value={item.qty}
                        onChange={(e) =>
                          setInvoiceItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, qty: Number(e.target.value) || 1 } : it))
                          )
                        }
                        min={1}
                        className="w-16"
                      />
                      <span className="text-gray-500">{item.unit}</span>
                      <Input
                        type="number"
                        value={item.unitPriceNet}
                        onChange={(e) =>
                          setInvoiceItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, unitPriceNet: Number(e.target.value) || 0 } : it))
                          )
                        }
                        className="w-24"
                      />
                      <span className="text-gray-500">{item.vatRate}%</span>
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
              </div>
            )}
          </div>

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
                ...categories.map((cat) => ({ value: cat, label: cat })),
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
                    <p className="font-medium">{item.catalogName}</p>
                    <p className="text-sm text-gray-500">
                      {item.catalogCode} | {item.catalogCategory}
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
                    <span className="font-medium">
                      {event.type === 'created' ? t.quotes.eventCreated :
                       event.type === 'closed' ? t.quotes.eventClosed :
                       event.type === 'reopened' ? t.quotes.eventReopened :
                       event.type === 'accepted' ? t.quotes.eventAccepted :
                       event.type === 'acceptance_revoked' ? t.quotes.eventAcceptanceRevoked :
                       event.type === 'rejected' ? t.quotes.eventRejected :
                       event.type === 'rejection_revoked' ? t.quotes.eventRejectionRevoked :
                       event.type === 'started' ? t.quotes.eventStarted :
                       event.type === 'start_revoked' ? t.quotes.eventStartRevoked :
                       event.type === 'completed' ? t.quotes.eventCompleted :
                       event.type === 'completion_revoked' ? t.quotes.eventCompletionRevoked :
                       event.type === 'deleted' ? t.quotes.eventDeleted :
                       event.type}
                    </span>
                  </div>
                  <span className="text-gray-500">{event.doctorName}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
}: QuoteItemRowProps) {
  const lineTotal = calculateLineTotal(item);
  const discountAmount = calculateLineDiscountAmount(item);

  const treatmentSessionOptions = Array.from({ length: expectedTreatments }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}. kezelés`,
  }));

  return (
    <div
      className={`p-4 rounded-lg border bg-gray-50 transition-all ${
        isDragging ? 'opacity-50 scale-95' : ''
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
                  <span className="text-gray-500">Egységár:</span>
                  <span className="font-medium">{formatCurrency(item.quoteUnitPriceGross)}</span>
                </div>

                <div className="flex items-center gap-2 mr-4">
                  <span className="text-gray-500">Mennyiség:</span>
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
                    <span className="text-gray-500">Kedvezmény:</span>
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
                    Kezelés: <span className="font-medium">{item.treatmentSession}.</span>
                  </span>
                )}

                {item.toothNum && (
                  <span className="text-gray-500">
                    Fog: <span className="font-medium">{item.toothNum}</span>
                  </span>
                )}
              </div>

              {/* Treated Area Selector (third row) */}
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Kezelt terület:</span>
                {item.quoteUnit === 'alkalom' && (
                  <span className="font-medium text-gray-700">Teljes szájüreg</span>
                )}
                {item.quoteUnit === 'db' && (
                  isEditable ? (
                    <Input
                      type="text"
                      value={item.treatedArea || ''}
                      onChange={(e) => onUpdate({ treatedArea: e.target.value })}
                      placeholder="Pl. frontfogak"
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
                        { value: 'lower', label: 'Alsó állcsont' },
                        { value: 'upper', label: 'Felső állcsont' },
                        { value: 'both', label: 'Alsó és Felső állcsont' },
                      ]}
                      className="w-52"
                    />
                  ) : (
                    <span className="font-medium">
                      {item.treatedArea === 'lower' ? 'Alsó állcsont' :
                       item.treatedArea === 'upper' ? 'Felső állcsont' :
                       item.treatedArea === 'both' ? 'Alsó és Felső állcsont' : '-'}
                    </span>
                  )
                )}
                {item.quoteUnit === 'kvadráns' && (
                  isEditable ? (
                    <Select
                      value={item.treatedArea || 'q1'}
                      onChange={(e) => onUpdate({ treatedArea: e.target.value, quoteQty: 1 })}
                      options={[
                        { value: 'q1', label: '1-es kvadráns (jobb felül)' },
                        { value: 'q2', label: '2-es kvadráns (bal felül)' },
                        { value: 'q3', label: '3-as kvadráns (bal alul)' },
                        { value: 'q4', label: '4-es kvadráns (jobb alul)' },
                      ]}
                      className="w-56"
                    />
                  ) : (
                    <span className="font-medium">
                      {item.treatedArea === 'q1' ? '1-es kvadráns (jobb felül)' :
                       item.treatedArea === 'q2' ? '2-es kvadráns (bal felül)' :
                       item.treatedArea === 'q3' ? '3-as kvadráns (bal alul)' :
                       item.treatedArea === 'q4' ? '4-es kvadráns (jobb alul)' : '-'}
                    </span>
                  )
                )}
                {item.quoteUnit === 'fog' && (
                  isEditable ? (
                    <Input
                      type="text"
                      value={item.treatedArea || ''}
                      onChange={(e) => onUpdate({ treatedArea: e.target.value })}
                      placeholder="Pl. 11, 12, 21"
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
                  <span className="text-gray-500">Kezelés sorszáma:</span>
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
          <p className="font-semibold text-lg">{formatCurrency(lineTotal)}</p>
          {discountAmount > 0 && (
            <p className="text-sm text-red-600">-{formatCurrency(discountAmount)}</p>
          )}
          {isEditable && (
            <button
              onClick={onRemove}
              className="mt-2 text-sm text-red-600 hover:text-red-700"
            >
              Eltávolítás
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
