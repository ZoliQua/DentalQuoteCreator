import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { useSettings } from '../context/SettingsContext';
import { usePatients, useQuotes, useCatalog, useCatalogCodeFormatter, usePriceListCategories } from '../hooks';
import type { Quote, QuoteItem, CatalogItem, CatalogCategory, DiscountType } from '../types';
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
  ConfirmModal,
  QuoteProgressBar,
} from '../components/common';
import {
  formatCurrency,
  formatPatientName,
  formatDate,
  formatDateTime,
  calculateQuoteTotals,
  formatBirthDateForDisplay,
  parseBirthDateFromDisplay,
  getDatePlaceholder,
} from '../utils';
import { generateQuotePdf } from '../components/pdf/QuotePdfGenerator';
import { OdontogramHost } from '../modules/odontogram/OdontogramHost';
import type { OdontogramHostHandle } from '../modules/odontogram/OdontogramHost';
import { loadCurrent } from '../modules/odontogram/odontogramStorage';
import type { OdontogramState } from '../modules/odontogram/types';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { previewInvoice, createInvoice } from '../modules/invoicing/api';
import { saveInvoice, getInvoicesByQuote } from '../modules/invoicing/storage';
import type { InvoiceRecord, InvoiceType } from '../types/invoice';
import {
  parseSvgLayer,
  requiresSurfaceSelection,
  requiresMaterialSelection,
  resolveLayerIds,
  computeOdontogramStateFromItems,
  getQuadrantFromTooth,
  SURFACE_NAMES,
  MATERIAL_OPTIONS,
  SURFACE_ABBREVIATIONS,
  type SurfaceName,
} from '../utils/svgLayerParser';
import { mergeQuoteItems, mergeQuoteItemsBySession } from '../utils/mergedQuoteItems';
import type { MergedQuoteItem } from '../utils/mergedQuoteItems';
import { getCatalogDisplayName } from '../utils/catalogLocale';
import { getAuthHeaders } from '../utils/auth';

type SidebarCardsProps = {
  quote: Quote;
  totals: { subtotal: number; lineDiscounts: number; globalDiscount: number; total: number };
  quoteInvoices: InvoiceRecord[];
  invoicedAmount: number;
  remainingAmount: number;
  hasPermission: (p: string) => boolean;
  t: any;
  closeQuote: (id: string) => any;
  reopenQuote: (id: string) => any;
  acceptQuote: (id: string) => any;
  rejectQuote: (id: string) => any;
  revokeAcceptance: (id: string) => any;
  revokeRejection: (id: string) => any;
  completeTreatment: (id: string) => any;
  reopenTreatment: (id: string) => any;
  restoreQuote: (id: string) => void;
  handleGlobalDiscountChange: (type: DiscountType, value: number) => void;
  setDeleteConfirm: (v: boolean) => void;
};

function SidebarCards({
  quote, totals, quoteInvoices, invoicedAmount, remainingAmount,
  hasPermission, t,
  closeQuote, reopenQuote, acceptQuote, rejectQuote,
  revokeAcceptance, revokeRejection, completeTreatment, reopenTreatment,
  restoreQuote, handleGlobalDiscountChange, setDeleteConfirm,
}: SidebarCardsProps) {
  return (
    <div className="space-y-4">
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
                <Button size="sm" onClick={() => closeQuote(quote.quoteId)}>
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

      {/* Summary */}
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
          {!(quote.globalDiscountValue === 0 && ['closed', 'started', 'completed'].includes(quote.quoteStatus)) && (
          <div className="pt-3 border-t">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t.quotes.globalDiscount}
            </label>
            <div className="flex gap-2">
              <Select
                value={quote.globalDiscountType}
                onChange={(e) =>
                  handleGlobalDiscountChange(e.target.value as DiscountType, quote.globalDiscountValue)
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
  );
}

type PopupState = {
  toothNum: number;
  x: number;
  y: number;
  needsSurfaces: boolean;
  maxSurfaces: number;
  needsMaterial: boolean;
  selectedSurfaces: string[];
  selectedMaterial: string;
};

export function VisualQuoteEditorPage() {
  const { patientId, quoteId } = useParams<{ patientId: string; quoteId: string }>();
  const navigate = useNavigate();
  const { t, settings, appLanguage } = useSettings();
  const { getPatient } = usePatients();
  const {
    getQuote,
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
    removeItemFromQuote,
  } = useQuotes();
  const { catalog, activeItems, itemsByCategory } = useCatalog();
  const { formatCode } = useCatalogCodeFormatter();
  const { getCategoryName } = usePriceListCategories();
  const { hasPermission } = useAuth();
  const { restoreQuote } = useApp();

  const [activeCatalogItem, setActiveCatalogItem] = useState<CatalogItem | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CatalogCategory | 'all'>('all');
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [initialOdontogramState, setInitialOdontogramState] = useState<OdontogramState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [expandedMergedItem, setExpandedMergedItem] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<{
    catalogItemId: string;
    fromSession: number;
  } | null>(null);
  const [dragOverSession, setDragOverSession] = useState<number | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceDisabledModalOpen, setInvoiceDisabledModalOpen] = useState(false);
  const [invoicePreviewXml, setInvoicePreviewXml] = useState('');
  const [invoicePreviewTotals, setInvoicePreviewTotals] = useState<{ net: number; vat: number; gross: number } | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [restrictionToast, setRestrictionToast] = useState<string | null>(null);
  const restrictionToastTimerRef = useRef<number | null>(null);
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
  const [quoteInvoices, setQuoteInvoices] = useState<InvoiceRecord[]>([]);
  const [invoiceDraggedIndex, setInvoiceDraggedIndex] = useState<number | null>(null);
  const [invoiceDragOverIndex, setInvoiceDragOverIndex] = useState<number | null>(null);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('normal');
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const popupRef = useRef<HTMLDivElement>(null);
  const odontogramContainerRef = useRef<HTMLDivElement>(null);
  const odontogramHostRef = useRef<OdontogramHostHandle | null>(null);

  const patient = patientId ? getPatient(patientId) : undefined;
  const quote = quoteId ? getQuote(quoteId) : undefined;
  const effectiveQuoteLang: 'hu' | 'en' | 'de' = quote?.quoteLang ?? settings.quote.quoteLang ?? 'hu';

  useEffect(() => {
    if (!patientId) return;
    const stored = loadCurrent(patientId);
    setInitialOdontogramState(stored?.state ?? null);
  }, [patientId]);

  // Compute odontogram state from quote items
  const computedOdontogramState = useMemo(() => {
    if (!quote) return initialOdontogramState;
    return computeOdontogramStateFromItems(quote.items, initialOdontogramState ?? undefined);
  }, [quote, initialOdontogramState]);

  // Check if there are any milk teeth in the computed odontogram state
  const hasMilkTeeth = useMemo(() => {
    if (!computedOdontogramState?.teeth) return false;
    return Object.values(computedOdontogramState.teeth).some(
      (tooth) => tooth.toothSelection === 'milktooth'
    );
  }, [computedOdontogramState]);

  const totals = useMemo(() => {
    if (!quote) return { subtotal: 0, lineDiscounts: 0, globalDiscount: 0, total: 0 };
    return calculateQuoteTotals(quote);
  }, [quote]);

  const mergedBySession = useMemo(() => {
    if (!quote) return new Map<number, MergedQuoteItem[]>();
    return mergeQuoteItemsBySession(quote.items);
  }, [quote]);

  const mergedItems = useMemo(() => {
    if (!quote) return [];
    return mergeQuoteItems(quote.items);
  }, [quote]);

  const catalogLookup = useMemo(() => {
    const map = new Map<string, CatalogItem>();
    for (const item of catalog) map.set(item.catalogItemId, item);
    return map;
  }, [catalog]);

  // Load invoices for this quote
  const refreshQuoteInvoices = useCallback(() => {
    if (quoteId) setQuoteInvoices(getInvoicesByQuote(quoteId));
  }, [quoteId]);
  useEffect(() => {
    refreshQuoteInvoices();
  }, [refreshQuoteInvoices]);

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

  const categories = Object.keys(itemsByCategory) as CatalogCategory[];

  // Close popup on outside click
  useEffect(() => {
    if (!popup) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popup]);

  const showRestrictionToast = useCallback((message: string) => {
    if (restrictionToastTimerRef.current) {
      window.clearTimeout(restrictionToastTimerRef.current);
    }
    setRestrictionToast(message);
    restrictionToastTimerRef.current = window.setTimeout(() => {
      setRestrictionToast(null);
      restrictionToastTimerRef.current = null;
    }, 2500);
  }, []);

  const addVisualItem = useCallback(
    (
      catalogItem: CatalogItem,
      toothNum?: number,
      selectedSurfaces?: string[],
      selectedMaterial?: string,
      treatedArea?: string
    ) => {
      if (!quote) return;
      const tokens = parseSvgLayer(catalogItem.svgLayer);
      const resolvedLayers = resolveLayerIds(tokens, selectedSurfaces, selectedMaterial);

      const newItem: QuoteItem = {
        lineId: nanoid(),
        catalogItemId: catalogItem.catalogItemId,
        quoteName: getCatalogDisplayName(catalogItem, effectiveQuoteLang),
        quoteUnit: catalogItem.catalogUnit,
        quoteUnitPriceGross: catalogItem.catalogPrice,
        quoteUnitPriceCurrency: catalogItem.catalogPriceCurrency,
        quoteQty: 1,
        quoteLineDiscountType: 'percent',
        quoteLineDiscountValue: 0,
        toothNum: toothNum ? String(toothNum) : undefined,
        selectedSurfaces,
        selectedMaterial,
        resolvedLayers,
        treatedArea,
      };

      editQuote(quote.quoteId, {
        items: [...quote.items, newItem],
      });
    },
    [quote, editQuote]
  );

  const handleToothClick = useCallback(
    (toothNum: number) => {
      if (!activeCatalogItem || !quote) return;

      const catalogItem = activeCatalogItem;

      // Tooth restriction: allowedTeeth
      if (catalogItem.allowedTeeth && catalogItem.allowedTeeth.length > 0) {
        if (!catalogItem.allowedTeeth.includes(toothNum)) {
          showRestrictionToast(
            (t.visualEditor.toothNotAllowed ?? 'Ez a kezelés nem alkalmazható erre a fogra') +
            ` (${formatCode(catalogItem)}: ${catalogItem.allowedTeeth.join(', ')})`
          );
          return;
        }
      }

      // Tooth restriction: milkToothOnly — the clicked tooth must be a milk tooth
      if (catalogItem.milkToothOnly) {
        const toothState = computedOdontogramState?.teeth?.[String(toothNum)];
        if (!toothState || toothState.toothSelection !== 'milktooth') {
          showRestrictionToast(t.visualEditor.toothNotAllowed ?? 'Ez a kezelés nem alkalmazható erre a fogra');
          return;
        }
      }

      // Full mouth item -> do NOT add on tooth click (only via catalog click)
      if (catalogItem.isFullMouth) {
        return;
      }

      // Arch item with per-tooth selection (e.g. PROT24/25: max N teeth per arch)
      // Price is counted once per arch; multiple teeth are stored comma-separated in a single item
      if (catalogItem.isArch && catalogItem.maxTeethPerArch) {
        const arch = toothNum >= 11 && toothNum <= 28 ? 'upper' : 'lower';
        const existingItem = quote.items.find(
          (it) => it.catalogItemId === catalogItem.catalogItemId && it.treatedArea === arch
        );

        if (existingItem) {
          // Add tooth to existing item
          const currentTeeth = existingItem.toothNum ? existingItem.toothNum.split(',').map(t => t.trim()) : [];
          if (currentTeeth.includes(String(toothNum))) return; // dedup
          if (currentTeeth.length >= catalogItem.maxTeethPerArch) return; // limit
          currentTeeth.push(String(toothNum));
          editQuote(quote.quoteId, {
            items: quote.items.map(it =>
              it.lineId === existingItem.lineId
                ? { ...it, toothNum: currentTeeth.join(',') }
                : it
            )
          });
        } else {
          // First tooth: create new item
          addVisualItem(catalogItem, toothNum, undefined, undefined, arch);
        }
        return;
      }

      // Arch item -> determine arch from tooth number, max 1 per arch (dedup)
      if (catalogItem.isArch) {
        const arch = toothNum >= 11 && toothNum <= 28 ? 'upper' : 'lower';
        const alreadyExists = quote.items.some(
          (it) => it.catalogItemId === catalogItem.catalogItemId && it.treatedArea === arch
        );
        if (alreadyExists) return;
        addVisualItem(catalogItem, undefined, undefined, undefined, arch);
        return;
      }

      // Quadrant item -> determine quadrant from tooth number, max 1 per quadrant (dedup)
      if (catalogItem.isQuadrant) {
        const quadrant = getQuadrantFromTooth(toothNum);
        const treatedArea = `Q${quadrant}`;
        const alreadyExists = quote.items.some(
          (it) => it.catalogItemId === catalogItem.catalogItemId && it.treatedArea === treatedArea
        );
        if (alreadyExists) return;
        addVisualItem(catalogItem, undefined, undefined, undefined, treatedArea);
        return;
      }

      // Check if parameters are needed
      const tokens = parseSvgLayer(catalogItem.svgLayer);
      const surfaceReq = requiresSurfaceSelection(tokens);
      const materialReq = requiresMaterialSelection(tokens);

      if (!surfaceReq.required && !materialReq.required) {
        // No parameters needed -> add immediately
        addVisualItem(catalogItem, toothNum);
        return;
      }

      // Show popup for parameter selection
      // Get tooth position relative to the odontogram container
      const container = odontogramContainerRef.current;
      if (!container) return;

      const toothEl = container.querySelector(`[data-tooth="${toothNum}"]`) as HTMLElement | null;
      let x = 200;
      let y = 200;
      if (toothEl) {
        const containerRect = container.getBoundingClientRect();
        const toothRect = toothEl.getBoundingClientRect();
        x = toothRect.left - containerRect.left + toothRect.width / 2;
        y = toothRect.top - containerRect.top + toothRect.height;
      }

      setPopup({
        toothNum,
        x,
        y,
        needsSurfaces: surfaceReq.required,
        maxSurfaces: surfaceReq.maxSurfaces,
        needsMaterial: materialReq.required,
        selectedSurfaces: [],
        selectedMaterial: MATERIAL_OPTIONS[0],
      });
    },
    [activeCatalogItem, quote, addVisualItem, computedOdontogramState, showRestrictionToast, t]
  );

  const handlePopupAdd = () => {
    if (!popup || !activeCatalogItem) return;
    addVisualItem(
      activeCatalogItem,
      popup.toothNum,
      popup.needsSurfaces ? popup.selectedSurfaces : undefined,
      popup.needsMaterial ? popup.selectedMaterial : undefined
    );
    setPopup(null);
  };

  const handlePopupSurfaceToggle = (surface: string) => {
    if (!popup) return;
    setPopup((prev) => {
      if (!prev) return null;
      const surfaces = prev.selectedSurfaces.includes(surface)
        ? prev.selectedSurfaces.filter((s) => s !== surface)
        : prev.selectedSurfaces.length < prev.maxSurfaces
          ? [...prev.selectedSurfaces, surface]
          : prev.selectedSurfaces;
      return { ...prev, selectedSurfaces: surfaces };
    });
  };

  const handleRemoveIndividualItem = (lineId: string) => {
    if (!quote) return;
    removeItemFromQuote(quote.quoteId, lineId);
  };

  const handleRemoveToothFromItem = (lineId: string, toothToRemove: string) => {
    if (!quote) return;
    const item = quote.items.find(it => it.lineId === lineId);
    if (!item || !item.toothNum) return;
    const teeth = item.toothNum.split(',').map(t => t.trim()).filter(t => t !== toothToRemove);
    if (teeth.length === 0) {
      removeItemFromQuote(quote.quoteId, lineId);
    } else {
      editQuote(quote.quoteId, {
        items: quote.items.map(it =>
          it.lineId === lineId ? { ...it, toothNum: teeth.join(',') } : it
        )
      });
    }
  };

  const handleRemoveMergedGroup = (catalogItemId: string) => {
    if (!quote) return;
    const itemsToRemove = quote.items.filter((it) => it.catalogItemId === catalogItemId);
    let current = quote;
    for (const item of itemsToRemove) {
      const updated = removeItemFromQuote(current.quoteId, item.lineId);
      if (updated) current = updated;
    }
  };

  const handleGlobalDiscountChange = (type: DiscountType, value: number) => {
    if (!quote) return;
    editQuote(quote.quoteId, { globalDiscountType: type, globalDiscountValue: value });
  };

  const handleDelete = () => {
    if (!quote || !patient) return;
    if (deleteQuote(quote.quoteId)) {
      navigate(`/patients/${patient.patientId}`);
    }
    setDeleteConfirm(false);
  };

  const handleSessionDrop = useCallback((targetSession: number) => {
    if (!quote || !draggedItem || draggedItem.fromSession === targetSession) {
      setDraggedItem(null);
      setDragOverSession(null);
      return;
    }
    // Move all items of the dragged merged group to the target session
    const newItems = quote.items.map((it) => {
      if (it.catalogItemId === draggedItem.catalogItemId && (it.treatmentSession || 1) === draggedItem.fromSession) {
        return { ...it, treatmentSession: targetSession };
      }
      return it;
    });
    editQuote(quote.quoteId, { items: newItems });
    setDraggedItem(null);
    setDragOverSession(null);
  }, [quote, draggedItem, editQuote]);

  const handleMoveInSession = useCallback((catalogItemId: string, sessionNum: number, direction: 'up' | 'down') => {
    if (!quote) return;
    const sessionMerged = mergedBySession.get(sessionNum) || [];
    const currentIndex = sessionMerged.findIndex(m => m.catalogItemId === catalogItemId);
    if (currentIndex < 0) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= sessionMerged.length) return;

    // Build new merged order with swapped items
    const newMergedOrder = [...sessionMerged];
    [newMergedOrder[currentIndex], newMergedOrder[targetIndex]] = [newMergedOrder[targetIndex], newMergedOrder[currentIndex]];

    // Rebuild session items in the new order
    const sessionItemsList = quote.items.filter(it => (it.treatmentSession || 1) === sessionNum);
    const reorderedSessionItems: typeof quote.items = [];
    for (const merged of newMergedOrder) {
      reorderedSessionItems.push(...sessionItemsList.filter(it => it.catalogItemId === merged.catalogItemId));
    }

    // Rebuild full items array preserving non-session items positions
    const newItems: typeof quote.items = [];
    let sessionInserted = false;
    for (const item of quote.items) {
      if ((item.treatmentSession || 1) === sessionNum) {
        if (!sessionInserted) {
          newItems.push(...reorderedSessionItems);
          sessionInserted = true;
        }
      } else {
        newItems.push(item);
      }
    }
    editQuote(quote.quoteId, { items: newItems });
  }, [quote, mergedBySession, editQuote]);

  const handleDoctorChange = (doctorId: string) => {
    if (!quote) return;
    editQuote(quote.quoteId, { doctorId });
  };

  // Full-mouth item qty adjustment
  const handleFullMouthQtyChange = useCallback(
    (catalogItemId: string, delta: number) => {
      if (!quote) return;
      const merged = mergedItems.find((m) => m.catalogItemId === catalogItemId);
      if (!merged) return;
      if (delta > 0) {
        // Add another copy
        const refItem = merged.items[0];
        const catalogItem = activeItems.find((ci) => ci.catalogItemId === catalogItemId);
        if (catalogItem) {
          addVisualItem(catalogItem, undefined, undefined, undefined, refItem.treatedArea || 'full-mouth');
        }
      } else if (delta < 0 && merged.items.length > 0) {
        // Remove last item
        const lastItem = merged.items[merged.items.length - 1];
        removeItemFromQuote(quote.quoteId, lastItem.lineId);
      }
    },
    [quote, mergedItems, activeItems, addVisualItem, removeItemFromQuote]
  );

  const selectedDoctor = settings.doctors.find((doc) => doc.id === quote?.doctorId);
  const doctorName = selectedDoctor?.name || (settings.doctors.length > 0 ? settings.doctors[0].name : '');

  const handleDownloadPdf = async () => {
    if (!quote || !patient) return;
    setPdfLoading(true);
    try {
      const odontogramImage = await odontogramHostRef.current?.captureImage({ width: 1200 }) ?? undefined;
      await generateQuotePdf(quote, patient, settings, doctorName, odontogramImage);
    } finally {
      setPdfLoading(false);
    }
  };

  const buildInvoicePayload = () => {
    if (!quote) return null;
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
    if (!quote || !patient) return;
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
      const payload = buildInvoicePayload();
      if (!payload) return;
      const response = await previewInvoice(payload);
      setInvoicePreviewXml(response.xml);
      setInvoicePreviewTotals(response.totals);
    } catch (error) {
      setInvoiceError(error instanceof Error ? error.message : t.invoices.errorGeneric);
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!quote || !patient) return;
    setInvoiceSubmitting(true);
    setInvoiceError(null);
    try {
      const payload = buildInvoicePayload();
      if (!payload) return;
      const response = await createInvoice(payload);
      if (response.mode === 'live' && !response.success) {
        throw new Error(response.message || t.invoices.errorGeneric);
      }
      const calculatedTotals = payload.items.reduce((acc, item) => {
        const net = item.qty * item.unitPriceNet;
        const vat = (net * item.vatRate) / 100;
        return { net: acc.net + net, vat: acc.vat + vat, gross: acc.gross + net + vat };
      }, { net: 0, vat: 0, gross: 0 });
      const totalGross = Math.round((calculatedTotals.gross + Number.EPSILON) * 100) / 100;
      const isActuallySent = response.mode === 'live' && response.success;
      // Fetch next invoice ID from backend
      let invoiceId: string;
      try {
        const idRes = await fetch(`/backend/invoices/next-id/${encodeURIComponent(patient.patientId)}`, { headers: getAuthHeaders() });
        if (idRes.ok) {
          const idData = await idRes.json() as { id: string };
          invoiceId = idData.id;
        } else {
          invoiceId = nanoid();
        }
      } catch {
        invoiceId = nanoid();
      }
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
          return { name: item.name, unit: item.unit, qty: item.qty, unitPriceNet: item.unitPriceNet, vatRate: item.vatRate, net, vat, gross };
        }),
        xmlPreview: response.xml || invoicePreviewXml || undefined,
        rawResponse: response.rawResponse || undefined,
        pdfBase64: response.pdfBase64 || undefined,
      });
      addEventToQuote(quote.quoteId, {
        type: 'invoice_created',
        doctorName,
        invoiceId,
        invoiceNumber: invoiceNumber || invoiceId.slice(0, 8),
        invoiceAmount: totalGross,
        invoiceCurrency: quote.currency,
        invoiceType,
      });
      setInvoiceModalOpen(false);
      if (response.pdfBase64) {
        const bytes = atob(response.pdfBase64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'application/pdf' });
        window.open(URL.createObjectURL(blob), '_blank');
      }
      refreshQuoteInvoices();
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

  const isEditing = quote.quoteStatus === 'draft' && !quote.isDeleted;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <Link to="/patients" className="hover:text-dental-600">{t.patients.title}</Link>
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
            <Badge variant="warning">{t.quotes.newQuoteVisual}</Badge>
            <Badge
              variant={
                quote.quoteStatus === 'draft' ? 'warning'
                : quote.quoteStatus === 'completed' ? 'default'
                : quote.quoteStatus === 'rejected' ? 'danger'
                : 'success'
              }
            >
              {quote.quoteStatus === 'draft' ? t.quotes.statusDraft
                : quote.quoteStatus === 'closed' ? t.quotes.statusClosed
                : quote.quoteStatus === 'rejected' ? t.quotes.statusRejected
                : quote.quoteStatus === 'started' ? t.quotes.statusStarted
                : t.quotes.statusCompleted}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            PDF
          </Button>
        </div>
      </div>

      {/* Main layout: Odontogram + Catalog side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Odontogram */}
        <div className="lg:col-span-2 relative" ref={odontogramContainerRef}>
          {isEditing && !activeCatalogItem && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {t.visualEditor.noActiveItem} — {t.visualEditor.selectItem}
            </div>
          )}
          {isEditing && activeCatalogItem && (
            <div className="mb-3 rounded-lg border border-dental-200 bg-dental-50 px-4 py-3 text-sm text-dental-700 flex items-center justify-between">
              <div>
                <span className="font-medium">{t.visualEditor.activeItem}: </span>
                <span className="font-semibold">{getCatalogDisplayName(activeCatalogItem, appLanguage)}</span>
                <span className="ml-2 text-dental-500">({formatCode(activeCatalogItem)})</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCatalogItem(null)}
                className="text-dental-500 hover:text-dental-700"
              >
                &times;
              </button>
            </div>
          )}

          <OdontogramHost
            ref={odontogramHostRef}
            patientId={patient.patientId}
            mode="quote-builder"
            initialState={computedOdontogramState}
            onChange={() => {}}
            onToothClick={isEditing ? handleToothClick : undefined}
            hidePanel
          />

          {/* Tooth restriction toast */}
          {restrictionToast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-pulse">
              {restrictionToast}
            </div>
          )}

          {/* Tooth parameter popup */}
          {popup && (
            <div
              ref={popupRef}
              className="absolute z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 w-64"
              style={{
                left: Math.min(popup.x - 128, (odontogramContainerRef.current?.clientWidth ?? 600) - 270),
                top: popup.y + 8,
              }}
            >
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                {t.visualEditor.toothParams} — {popup.toothNum}
              </h4>

              {popup.needsSurfaces && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    {t.visualEditor.selectSurfaces} (max {popup.maxSurfaces})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SURFACE_NAMES.map((surface) => (
                      <button
                        key={surface}
                        type="button"
                        onClick={() => handlePopupSurfaceToggle(surface)}
                        className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                          popup.selectedSurfaces.includes(surface)
                            ? 'bg-dental-500 text-white border-dental-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-dental-400'
                        }`}
                      >
                        {SURFACE_ABBREVIATIONS[surface as SurfaceName]} — {t.visualEditor.surfaces[surface as SurfaceName]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {popup.needsMaterial && (
                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    {t.visualEditor.selectMaterial}
                  </p>
                  <div className="flex gap-2">
                    {MATERIAL_OPTIONS.map((material) => (
                      <button
                        key={material}
                        type="button"
                        onClick={() => setPopup((prev) => prev ? { ...prev, selectedMaterial: material } : null)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors ${
                          popup.selectedMaterial === material
                            ? 'bg-dental-500 text-white border-dental-500'
                            : 'bg-white text-gray-700 border-gray-300 hover:border-dental-400'
                        }`}
                      >
                        {t.visualEditor.materials[material as keyof typeof t.visualEditor.materials]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPopup(null)}
                >
                  {t.common.cancel}
                </Button>
                <Button
                  size="sm"
                  onClick={handlePopupAdd}
                  disabled={popup.needsSurfaces && popup.selectedSurfaces.length === 0}
                >
                  {t.common.add}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Catalog (editing) or Status+Summary (read-only) */}
        {isEditing ? (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-sm">{t.visualEditor.selectItem}</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={itemSearchQuery}
                    onChange={(e) => setItemSearchQuery(e.target.value)}
                    placeholder={t.quotes.searchCatalog}
                    className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent"
                  />
                  {itemSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setItemSearchQuery('')}
                      className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                  className="text-sm"
                />
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {filteredCatalogItems.length === 0 ? (
                    <p className="text-center text-gray-500 py-4 text-sm">{t.common.noResults}</p>
                  ) : (
                    filteredCatalogItems.map((item) => {
                      // GYER category items require milk teeth on the odontogram
                      const isGyerDisabled = item.catalogCategory === 'Gyerefogászat' && !hasMilkTeeth;
                      return (
                      <button
                        key={item.catalogItemId}
                        type="button"
                        onClick={() => {
                          if (isGyerDisabled) return;
                          setActiveCatalogItem(item);
                          // For full-mouth items, add immediately
                          if (item.isFullMouth) {
                            addVisualItem(item, undefined, undefined, undefined, 'full-mouth');
                          }
                        }}
                        className={`w-full text-left p-2 rounded-lg border text-sm transition-colors ${
                          isGyerDisabled
                            ? 'opacity-40 cursor-not-allowed border-gray-200'
                            : activeCatalogItem?.catalogItemId === item.catalogItemId
                            ? 'border-dental-400 bg-dental-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        title={isGyerDisabled ? (t.visualEditor.requiresMilkTeeth ?? 'Tejfogazat szükséges') : undefined}
                      >
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 truncate">{getCatalogDisplayName(item, appLanguage)}</p>
                            <p className="text-xs text-gray-500">{formatCode(item)}</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-semibold text-sm">{formatCurrency(item.catalogPrice)}</p>
                          </div>
                        </div>
                      </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <SidebarCards
            quote={quote}
            totals={totals}
            quoteInvoices={quoteInvoices}
            invoicedAmount={invoicedAmount}
            remainingAmount={remainingAmount}
            hasPermission={hasPermission}
            t={t}
            closeQuote={closeQuote}
            reopenQuote={reopenQuote}
            acceptQuote={acceptQuote}
            rejectQuote={rejectQuote}
            revokeAcceptance={revokeAcceptance}
            revokeRejection={revokeRejection}
            completeTreatment={completeTreatment}
            reopenTreatment={reopenTreatment}
            restoreQuote={restoreQuote}
            handleGlobalDiscountChange={handleGlobalDiscountChange}
            setDeleteConfirm={setDeleteConfirm}
          />
        )}
      </div>

      {/* Merged items list */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t.visualEditor.mergedItems}</h2>
          <span className="text-sm text-gray-500">
            {t.quotes.itemsCount.replace('{count}', String(quote.items.length))}
          </span>
        </CardHeader>
        <CardContent>
          {mergedItems.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">
              {t.quotes.noItems}
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from({ length: quote.expectedTreatments || 1 }, (_, i) => i + 1).map((sessionNum) => {
                const sessionItems = mergedBySession.get(sessionNum) || [];
                const showLabel = (quote.expectedTreatments || 1) > 1;
                return (
                  <div
                    key={sessionNum}
                    className={showLabel ? `border rounded-lg p-3 ${dragOverSession === sessionNum ? 'border-dental-500 border-2' : ''}` : ''}
                    onDragOver={(e) => { e.preventDefault(); setDragOverSession(sessionNum); }}
                    onDrop={() => handleSessionDrop(sessionNum)}
                  >
                    {showLabel && (
                      <h3 className="text-sm font-semibold text-gray-600 mb-2">
                        {sessionNum}. {t.quotes.treatmentSession}
                      </h3>
                    )}
                    <div className="space-y-2">
                      {sessionItems.map((merged, index) => {
                        const invoicedInvoiceNumber = ['started', 'completed'].includes(quote.quoteStatus)
                          ? quoteInvoices.find((inv) => inv.status !== 'storno' && inv.items.some((ii) => ii.name === merged.quoteName))?.szamlazzInvoiceNumber
                          : undefined;
                        const isInvoiced = !!invoicedInvoiceNumber;
                        return (
                        <div
                          key={`${sessionNum}-${merged.catalogItemId}`}
                          className={`rounded-lg border transition-all ${
                            isInvoiced ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                          } ${
                            draggedItem?.catalogItemId === merged.catalogItemId && draggedItem?.fromSession === sessionNum ? 'opacity-50' : ''
                          }`}
                          draggable={quote.quoteStatus === 'draft' && showLabel}
                          onDragStart={() => setDraggedItem({ catalogItemId: merged.catalogItemId, fromSession: sessionNum })}
                          onDragEnd={() => { setDraggedItem(null); setDragOverSession(null); }}
                        >
                          <div className="p-3 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <span className="text-sm text-gray-500 font-mono w-6 text-right shrink-0">
                                {index + 1}.
                              </span>
                              {quote.quoteStatus === 'draft' && sessionItems.length > 1 && (
                                <div className="flex flex-col shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveInSession(merged.catalogItemId, sessionNum, 'up')}
                                    disabled={index === 0}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveInSession(merged.catalogItemId, sessionNum, 'down')}
                                    disabled={index === sessionItems.length - 1}
                                    className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                              {quote.quoteStatus === 'draft' && showLabel && (
                                <div className="text-gray-400 cursor-grab shrink-0">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                                  </svg>
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-gray-900">
                                  {catalogLookup.get(merged.catalogItemId)
                                    ? getCatalogDisplayName(catalogLookup.get(merged.catalogItemId)!, appLanguage)
                                    : merged.quoteName}
                                </p>
                                {merged.treatedAreaText && (
                                  <p className="text-sm text-gray-500 truncate">{merged.treatedAreaText}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <span className="text-sm text-gray-500">
                                &times;{merged.totalQty}
                              </span>
                              <span className="font-semibold w-24 text-right">
                                {formatCurrency(merged.lineTotal)}
                              </span>
                              {isInvoiced && (
                                <span title={t.invoices.invoicedItem.replace('{invoiceNumber}', invoicedInvoiceNumber || '')}>
                                  <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                              {quote.quoteStatus === 'draft' && (
                                <div className="flex items-center gap-1">
                                  {merged.items[0]?.treatedArea === 'full-mouth' ? (
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => handleFullMouthQtyChange(merged.catalogItemId, -1)}
                                        disabled={merged.totalQty <= 1}
                                        className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                      >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                          <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleFullMouthQtyChange(merged.catalogItemId, 1)}
                                        className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                                      >
                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                          <line x1="12" y1="5" x2="12" y2="19" />
                                          <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedMergedItem(
                                          expandedMergedItem === merged.catalogItemId ? null : merged.catalogItemId
                                        )
                                      }
                                      className="rounded-md border border-gray-200 p-1.5 text-gray-600 hover:bg-gray-100 transition-colors"
                                      title={t.visualEditor.editTeeth}
                                    >
                                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9" />
                                        <path d="M16.5 3.5a2.121 2.121 0 013 3L8 18l-4 1 1-4 11.5-11.5z" />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMergedGroup(merged.catalogItemId)}
                                    className="rounded-md border border-gray-200 p-1.5 text-red-600 hover:bg-red-50 transition-colors"
                                    title={t.common.delete}
                                  >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M19 7l-1 13H6L5 7" />
                                      <path d="M10 11v6M14 11v6" />
                                      <path d="M9 7V4h6v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Expanded individual items */}
                          {expandedMergedItem === merged.catalogItemId && (
                            <div className="border-t border-gray-200 px-3 py-2 space-y-1 bg-white rounded-b-lg">
                              {merged.items.flatMap((item) => {
                                if (item.toothNum && item.toothNum.includes(',')) {
                                  return item.toothNum.split(',').map(tn => tn.trim()).map((tooth) => (
                                    <div
                                      key={`${item.lineId}-${tooth}`}
                                      className="flex items-center justify-between text-sm py-1"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-700">{tooth}</span>
                                        {item.treatedArea && (
                                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                            {item.treatedArea}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveToothFromItem(item.lineId, tooth)}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                        title={t.visualEditor.removeTooth}
                                      >
                                        {t.common.remove}
                                      </button>
                                    </div>
                                  ));
                                }
                                const surfaceText = item.selectedSurfaces
                                  ? item.selectedSurfaces
                                      .map((s) => SURFACE_ABBREVIATIONS[s as SurfaceName] || s)
                                      .join('')
                                  : '';
                                return [(
                                  <div
                                    key={item.lineId}
                                    className="flex items-center justify-between text-sm py-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-700">
                                        {item.toothNum || item.treatedArea || '-'}
                                      </span>
                                      {surfaceText && (
                                        <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                                          {surfaceText}
                                        </span>
                                      )}
                                      {item.selectedMaterial && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                                          {item.selectedMaterial}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveIndividualItem(item.lineId)}
                                      className="text-red-500 hover:text-red-700 text-xs"
                                      title={t.visualEditor.removeTooth}
                                    >
                                      {t.common.remove}
                                    </button>
                                  </div>
                                )];
                              })}
                            </div>
                          )}
                        </div>
                        );
                      })}
                      {sessionItems.length === 0 && showLabel && (
                        <p className="text-gray-400 text-sm py-2 text-center">{t.quotes.noItems}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom section: Doctor, Treatments, Discount, Comments, Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${isEditing ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
          <Card>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">{t.quotes.doctor}:</label>
                  <Select
                    value={quote.doctorId || (settings.doctors.length > 0 ? settings.doctors[0].id : '')}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    options={settings.doctors.map((doc) => ({
                      value: doc.id,
                      label: doc.name || t.patients.unknownDoctor,
                    }))}
                    className="w-44"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">{t.quotes.expectedTreatments}</label>
                  <Select
                    value={String(quote.expectedTreatments || 1)}
                    onChange={(e) => {
                      const newCount = parseInt(e.target.value);
                      const oldCount = quote.expectedTreatments || 1;
                      if (newCount < oldCount) {
                        // Move items from excess sessions to the last remaining session
                        const newItems = quote.items.map((it) => {
                          const session = it.treatmentSession || 1;
                          if (session > newCount) {
                            return { ...it, treatmentSession: newCount };
                          }
                          return it;
                        });
                        editQuote(quote.quoteId, { expectedTreatments: newCount, items: newItems });
                      } else {
                        editQuote(quote.quoteId, { expectedTreatments: newCount });
                      }
                    }}
                    options={Array.from({ length: 9 }, (_, i) => ({
                      value: String(i + 1),
                      label: `${i + 1} ${t.quotes.treatmentSession}`,
                    }))}
                    className="w-32"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">{t.quotes.quoteLang}</label>
                  <Select
                    value={effectiveQuoteLang}
                    onChange={(e) => editQuote(quote.quoteId, { quoteLang: e.target.value as 'hu' | 'en' | 'de' })}
                    options={[
                      { value: 'hu', label: 'Magyar' },
                      { value: 'en', label: 'English' },
                      { value: 'de', label: 'Deutsch' },
                    ]}
                    className="w-28"
                    disabled={quote.quoteStatus !== 'draft'}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4">
              <TextArea
                label={t.quotes.commentToPatient}
                value={quote.commentToPatient}
                onChange={(e) => editQuote(quote.quoteId, { commentToPatient: e.target.value })}
                placeholder={t.quotes.commentPlaceholder}
                rows={3}
                disabled={quote.quoteStatus !== 'draft'}
              />
              <TextArea
                label={t.quotes.internalNotes}
                value={quote.internalNotes}
                onChange={(e) => editQuote(quote.quoteId, { internalNotes: e.target.value })}
                placeholder={t.quotes.internalNotesPlaceholder}
                rows={2}
                disabled={quote.quoteStatus !== 'draft'}
              />
            </CardContent>
          </Card>
        </div>

        {isEditing && (
          <SidebarCards
            quote={quote}
            totals={totals}
            quoteInvoices={quoteInvoices}
            invoicedAmount={invoicedAmount}
            remainingAmount={remainingAmount}
            hasPermission={hasPermission}
            t={t}
            closeQuote={closeQuote}
            reopenQuote={reopenQuote}
            acceptQuote={acceptQuote}
            rejectQuote={rejectQuote}
            revokeAcceptance={revokeAcceptance}
            revokeRejection={revokeRejection}
            completeTreatment={completeTreatment}
            reopenTreatment={reopenTreatment}
            restoreQuote={restoreQuote}
            handleGlobalDiscountChange={handleGlobalDiscountChange}
            setDeleteConfirm={setDeleteConfirm}
          />
        )}
      </div>

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

      {/* Invoice Modal */}
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
            <Input label={t.invoices.buyerName} value={invoiceForm.buyerName} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerName: e.target.value }))} />
            <Input label={t.invoices.buyerEmail} value={invoiceForm.buyerEmail} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerEmail: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label={t.invoices.buyerZip} value={invoiceForm.buyerZip} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerZip: e.target.value }))} />
            <Input label={t.invoices.buyerCity} value={invoiceForm.buyerCity} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerCity: e.target.value }))} />
            <Input label={t.invoices.buyerAddress} value={invoiceForm.buyerAddress} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, buyerAddress: e.target.value }))} />
          </div>

          {/* Invoice data section */}
          <h4 className="text-sm font-semibold text-gray-900 border-b pb-1">{t.invoices.invoiceDataSection}</h4>
          <div className="grid grid-cols-3 gap-3">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.invoices.issueDate}</label>
              <div className="relative">
                <input value={issueDateText} onChange={(e) => { setIssueDateText(e.target.value); const parsed = parseBirthDateFromDisplay(e.target.value); if (parsed) setInvoiceForm((prev) => ({ ...prev, issueDate: parsed })); else if (!e.target.value) setInvoiceForm((prev) => ({ ...prev, issueDate: '' })); }} placeholder={getDatePlaceholder()} className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300" />
                <input type="date" value={invoiceForm.issueDate} onChange={(e) => { if (e.target.value) { setInvoiceForm((prev) => ({ ...prev, issueDate: e.target.value })); setIssueDateText(formatBirthDateForDisplay(e.target.value)); } }} className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer" tabIndex={-1} />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.invoices.fulfillmentDate}</label>
              <div className="relative">
                <input value={fulfillmentDateText} onChange={(e) => { setFulfillmentDateText(e.target.value); const parsed = parseBirthDateFromDisplay(e.target.value); if (parsed) setInvoiceForm((prev) => ({ ...prev, fulfillmentDate: parsed })); else if (!e.target.value) setInvoiceForm((prev) => ({ ...prev, fulfillmentDate: '' })); }} placeholder={getDatePlaceholder()} className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300" />
                <input type="date" value={invoiceForm.fulfillmentDate} onChange={(e) => { if (e.target.value) { setInvoiceForm((prev) => ({ ...prev, fulfillmentDate: e.target.value })); setFulfillmentDateText(formatBirthDateForDisplay(e.target.value)); } }} className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer" tabIndex={-1} />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.invoices.dueDate}</label>
              <div className="relative">
                <input value={dueDateText} onChange={(e) => { setDueDateText(e.target.value); const parsed = parseBirthDateFromDisplay(e.target.value); if (parsed) setInvoiceForm((prev) => ({ ...prev, dueDate: parsed })); else if (!e.target.value) setInvoiceForm((prev) => ({ ...prev, dueDate: '' })); }} placeholder={getDatePlaceholder()} className="w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-dental-500 focus:border-transparent transition-colors border-gray-300" />
                <input type="date" value={invoiceForm.dueDate} onChange={(e) => { if (e.target.value) { setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value })); setDueDateText(formatBirthDateForDisplay(e.target.value)); } }} className="absolute inset-y-0 right-0 w-10 opacity-0 cursor-pointer" tabIndex={-1} />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Select label={t.invoices.paymentMethod} value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm((prev) => ({ ...prev, paymentMethod: e.target.value }))} options={[
              { value: 'atutalas', label: t.invoices.paymentTransfer },
              { value: 'keszpenz', label: t.invoices.paymentCash },
              { value: 'bankkartya', label: t.invoices.paymentCard },
            ]} />
            <Input label={t.invoices.comment} value={invoiceComment} onChange={(e) => setInvoiceComment(e.target.value)} />
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
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{t.invoices.items}</h3>
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
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                      </div>
                      <span className="text-gray-500 w-6 text-center">{idx + 1}.</span>
                      <span className="flex-1 font-medium">{item.name}</span>
                      <span className="text-gray-600 w-10 text-center">{item.qty}</span>
                      <span className="text-gray-500">{item.unit}</span>
                      <span className="text-gray-600 w-24 text-right">{formatCurrency(item.unitPriceNet)}</span>
                      <span className="text-gray-500 w-12 text-center">{item.vatRate}%</span>
                      <span className="w-24 text-right font-semibold">{formatCurrency(gross)}</span>
                      <button type="button" onClick={() => setInvoiceItems((prev) => prev.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700">&times;</button>
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

                {/* Final invoice: negative advance deduction */}
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
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{invoiceError}</div>
          )}

          <details>
            <summary className="cursor-pointer text-sm font-medium text-gray-700">{t.invoices.xmlPreview}</summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded bg-gray-900 p-3 text-xs text-gray-100">{invoicePreviewXml || t.invoices.xmlNotAvailable}</pre>
          </details>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setInvoiceModalOpen(false)}>{t.common.cancel}</Button>
            <Button variant="secondary" onClick={handlePreviewInvoice} disabled={invoiceSubmitting}>{t.invoices.preview}</Button>
            <Button onClick={handleCreateInvoice} disabled={invoiceSubmitting}>{t.invoices.createInvoice}</Button>
          </div>
        </div>
      </Modal>

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
            <Button variant="secondary" onClick={() => setInvoiceDisabledModalOpen(false)}>{t.common.close}</Button>
          </div>
        </div>
      </Modal>

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

      {pdfLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl px-8 py-6 shadow-xl flex flex-col items-center gap-4">
            <svg className="animate-spin h-8 w-8 text-dental-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-gray-700 font-medium text-center">{t.quotes.pdfGenerating}</p>
          </div>
        </div>
      )}
    </div>
  );
}
