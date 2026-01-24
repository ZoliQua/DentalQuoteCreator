import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  calculateQuoteTotals,
  calculateLineTotal,
  calculateLineDiscountAmount,
} from '../utils';
import { generateQuotePdf } from '../components/pdf/QuotePdfGenerator';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const patient = patientId ? getPatient(patientId) : undefined;

  // Create quote if it doesn't exist
  useEffect(() => {
    if (patientId && !quoteId && patient) {
      const patientName = formatPatientName(patient.lastName, patient.firstName);
      const newQuote = createQuote(patientId, patientName);
      navigate(`/patients/${patientId}/quotes/${newQuote.quoteId}`, { replace: true });
    }
  }, [patientId, quoteId, patient, createQuote, navigate]);

  const quote = quoteId ? getQuote(quoteId) : undefined;

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
              {formatPatientName(patient.lastName, patient.firstName)}
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
              {formatDate(quote.lastStatusChangeAt)} | {t.quotes.validUntil}:{' '}
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
            {t.quotes.downloadPdf}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
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
              <p className="font-medium">{formatPatientName(patient.lastName, patient.firstName)}</p>
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
        </div>
      </div>

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
                    <span className="text-gray-500">{formatDate(event.timestamp)}</span>
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
