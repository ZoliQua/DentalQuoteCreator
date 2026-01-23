import { useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { useSettings } from '../context/SettingsContext';
import { Quote, QuoteItem, QuoteStatus, CatalogItem } from '../types';
import { getCurrentDateString, addDays, calculateQuoteTotals } from '../utils';

export function useQuotes() {
  const { quotes, addQuote, updateQuote, deleteQuote, getQuote, getQuotesByPatient } = useApp();
  const { settings } = useSettings();

  const draftQuotes = useMemo(() => quotes.filter((q) => q.status === 'draft'), [quotes]);

  const finalQuotes = useMemo(() => quotes.filter((q) => q.status === 'final'), [quotes]);

  const archivedQuotes = useMemo(() => quotes.filter((q) => q.status === 'archived'), [quotes]);

  const createQuote = useCallback(
    (patientId: string): Quote => {
      const now = getCurrentDateString();
      const quote: Quote = {
        quoteId: nanoid(),
        patientId,
        createdAt: now,
        updatedAt: now,
        validUntil: addDays(now, settings.defaultValidityDays),
        status: 'draft',
        currency: 'HUF',
        items: [],
        globalDiscountType: 'percent',
        globalDiscountValue: 0,
        commentToPatient: '',
        internalNotes: '',
        expectedTreatments: 1,
      };
      addQuote(quote);
      return quote;
    },
    [addQuote, settings.defaultValidityDays]
  );

  const createQuoteItem = useCallback(
    (catalogItem: CatalogItem): QuoteItem => {
      return {
        lineId: nanoid(),
        catalogItemId: catalogItem.catalogItemId,
        quoteName: catalogItem.catalogName,
        quoteUnit: catalogItem.catalogUnit,
        quoteUnitPriceGross: catalogItem.catalogPrice,
        quoteUnitPriceCurrency: catalogItem.catalogPriceCurrency,
        quoteQty: 1,
        quoteLineDiscountType: 'percent',
        quoteLineDiscountValue: 0,
      };
    },
    []
  );

  const addItemToQuote = useCallback(
    (quoteId: string, catalogItem: CatalogItem): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const newItem = createQuoteItem(catalogItem);
      const updated: Quote = {
        ...existing,
        items: [...existing.items, newItem],
        updatedAt: getCurrentDateString(),
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote, createQuoteItem]
  );

  const updateQuoteItem = useCallback(
    (quoteId: string, lineId: string, data: Partial<QuoteItem>): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const items = existing.items.map((item) =>
        item.lineId === lineId ? { ...item, ...data } : item
      );

      const updated: Quote = {
        ...existing,
        items,
        updatedAt: getCurrentDateString(),
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote]
  );

  const removeItemFromQuote = useCallback(
    (quoteId: string, lineId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const updated: Quote = {
        ...existing,
        items: existing.items.filter((item) => item.lineId !== lineId),
        updatedAt: getCurrentDateString(),
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote]
  );

  const reorderQuoteItems = useCallback(
    (quoteId: string, fromIndex: number, toIndex: number): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const items = [...existing.items];
      const [movedItem] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, movedItem);

      const updated: Quote = {
        ...existing,
        items,
        updatedAt: getCurrentDateString(),
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote]
  );

  const editQuote = useCallback(
    (quoteId: string, data: Partial<Omit<Quote, 'quoteId' | 'createdAt' | 'items'>>): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const updated: Quote = {
        ...existing,
        ...data,
        updatedAt: getCurrentDateString(),
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote]
  );

  const setQuoteStatus = useCallback(
    (quoteId: string, status: QuoteStatus): Quote | undefined => {
      return editQuote(quoteId, { status });
    },
    [editQuote]
  );

  const finalizeQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      return setQuoteStatus(quoteId, 'final');
    },
    [setQuoteStatus]
  );

  const archiveQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      return setQuoteStatus(quoteId, 'archived');
    },
    [setQuoteStatus]
  );

  const duplicateQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const now = getCurrentDateString();
      const duplicate: Quote = {
        ...existing,
        quoteId: nanoid(),
        createdAt: now,
        updatedAt: now,
        validUntil: addDays(now, settings.defaultValidityDays),
        status: 'draft',
        items: existing.items.map((item) => ({
          ...item,
          lineId: nanoid(),
        })),
      };
      addQuote(duplicate);
      return duplicate;
    },
    [getQuote, addQuote, settings.defaultValidityDays]
  );

  const getQuoteTotals = useCallback((quoteId: string) => {
    const quote = getQuote(quoteId);
    if (!quote) return { subtotal: 0, lineDiscounts: 0, globalDiscount: 0, total: 0 };
    return calculateQuoteTotals(quote);
  }, [getQuote]);

  return {
    quotes,
    draftQuotes,
    finalQuotes,
    archivedQuotes,
    getQuote,
    getQuotesByPatient,
    createQuote,
    createQuoteItem,
    addItemToQuote,
    updateQuoteItem,
    removeItemFromQuote,
    reorderQuoteItems,
    editQuote,
    deleteQuote,
    setQuoteStatus,
    finalizeQuote,
    archiveQuote,
    duplicateQuote,
    getQuoteTotals,
  };
}
