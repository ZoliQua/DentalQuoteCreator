import { useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { useSettings } from '../context/SettingsContext';
import { Quote, QuoteItem, QuoteStatus, QuoteEvent, CatalogItem } from '../types';
import { getCurrentDateString, addDays, calculateQuoteTotals } from '../utils';

// Helper to generate quote number in PREFIX-NNNN format
function generateQuoteNumber(prefix: string, counter: number): string {
  const paddedCounter = String(counter).padStart(4, '0');
  return `${prefix}-${paddedCounter}`;
}

// Helper to get current timestamp for events
function getEventTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

// Helper to create an event
function createEvent(
  type: QuoteEvent['type'],
  doctorName: string
): QuoteEvent {
  return {
    id: nanoid(),
    timestamp: getEventTimestamp(),
    type,
    doctorName,
  };
}

export function useQuotes() {
  const { quotes, addQuote, updateQuote, getQuote, getQuotesByPatient } = useApp();
  const { settings, updateSettings } = useSettings();

  // Filter out deleted quotes for display
  const activeQuotes = useMemo(() => quotes.filter((q) => !q.isDeleted), [quotes]);

  // Status-based filters
  const draftQuotes = useMemo(
    () => activeQuotes.filter((q) => q.quoteStatus === 'draft'),
    [activeQuotes]
  );

  const inProgressQuotes = useMemo(
    () => activeQuotes.filter((q) =>
      q.quoteStatus === 'closed_pending' ||
      q.quoteStatus === 'accepted_in_progress' ||
      q.quoteStatus === 'started'
    ),
    [activeQuotes]
  );

  const completedQuotes = useMemo(
    () => activeQuotes.filter((q) => q.quoteStatus === 'completed'),
    [activeQuotes]
  );

  const rejectedQuotes = useMemo(
    () => activeQuotes.filter((q) => q.quoteStatus === 'rejected'),
    [activeQuotes]
  );

  // Get doctor name by ID
  const getDoctorName = useCallback((doctorId: string): string => {
    const doctor = settings.doctors.find((d) => d.id === doctorId);
    return doctor?.name || 'Ismeretlen orvos';
  }, [settings.doctors]);

  // Create a new quote
  const createQuote = useCallback(
    (patientId: string, patientName?: string): Quote => {
      const now = getCurrentDateString();
      const defaultDoctorId = settings.doctors.length > 0 ? settings.doctors[0].id : '';
      const defaultQuoteName = patientName ? `${patientName} árajánlata` : 'Új árajánlat';
      const doctorName = getDoctorName(defaultDoctorId);

      // Increment counter and generate quote number
      const newCounter = settings.quote.counter + 1;
      const quoteNumber = generateQuoteNumber(settings.quote.prefix, newCounter);

      // Update settings with new counter
      updateSettings({
        ...settings,
        quote: {
          ...settings.quote,
          counter: newCounter,
        },
      });

      const quote: Quote = {
        quoteId: nanoid(),
        quoteNumber,
        patientId,
        doctorId: defaultDoctorId,
        quoteName: defaultQuoteName,
        createdAt: now,
        lastStatusChangeAt: now,
        validUntil: addDays(now, settings.defaultValidityDays),
        quoteStatus: 'draft',
        currency: 'HUF',
        items: [],
        globalDiscountType: 'percent',
        globalDiscountValue: 0,
        commentToPatient: '',
        internalNotes: '',
        expectedTreatments: 1,
        events: [createEvent('created', doctorName)],
      };
      addQuote(quote);
      return quote;
    },
    [addQuote, settings, updateSettings, getDoctorName]
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
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote]
  );

  const editQuote = useCallback(
    (quoteId: string, data: Partial<Omit<Quote, 'quoteId' | 'quoteNumber' | 'createdAt' | 'items' | 'events'>>): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const updated: Quote = {
        ...existing,
        ...data,
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote]
  );

  const addEventToQuote = useCallback(
    (quoteId: string, event: Omit<QuoteEvent, 'id' | 'timestamp'>): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const fullEvent: QuoteEvent = {
        ...event,
        id: nanoid(),
        timestamp: getEventTimestamp(),
      };
      const updated: Quote = {
        ...existing,
        events: [...existing.events, fullEvent],
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote]
  );

  // Status transition helper
  const changeStatus = useCallback(
    (quoteId: string, newStatus: QuoteStatus, eventType: QuoteEvent['type']): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const now = getCurrentDateString();
      const doctorName = getDoctorName(existing.doctorId);

      const updated: Quote = {
        ...existing,
        quoteStatus: newStatus,
        lastStatusChangeAt: now,
        events: [...existing.events, createEvent(eventType, doctorName)],
      };
      updateQuote(updated);
      return updated;
    },
    [getQuote, updateQuote, getDoctorName]
  );

  // Status transitions
  const closeQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'draft') return undefined;
      return changeStatus(quoteId, 'closed_pending', 'closed');
    },
    [getQuote, changeStatus]
  );

  const reopenQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'closed_pending') return undefined;
      return changeStatus(quoteId, 'draft', 'reopened');
    },
    [getQuote, changeStatus]
  );

  const acceptQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'closed_pending') return undefined;
      return changeStatus(quoteId, 'accepted_in_progress', 'accepted');
    },
    [getQuote, changeStatus]
  );

  const rejectQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'closed_pending') return undefined;
      return changeStatus(quoteId, 'rejected', 'rejected');
    },
    [getQuote, changeStatus]
  );

  const revokeAcceptance = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'accepted_in_progress') return undefined;
      return changeStatus(quoteId, 'closed_pending', 'acceptance_revoked');
    },
    [getQuote, changeStatus]
  );

  const revokeRejection = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'rejected') return undefined;
      return changeStatus(quoteId, 'closed_pending', 'rejection_revoked');
    },
    [getQuote, changeStatus]
  );

  const startTreatment = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'accepted_in_progress') return undefined;
      return changeStatus(quoteId, 'started', 'started');
    },
    [getQuote, changeStatus]
  );

  const revokeStart = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'started') return undefined;
      return changeStatus(quoteId, 'accepted_in_progress', 'start_revoked');
    },
    [getQuote, changeStatus]
  );

  const completeTreatment = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'started') return undefined;
      return changeStatus(quoteId, 'completed', 'completed');
    },
    [getQuote, changeStatus]
  );

  const reopenTreatment = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing || existing.quoteStatus !== 'completed') return undefined;
      return changeStatus(quoteId, 'started', 'completion_revoked');
    },
    [getQuote, changeStatus]
  );

  // Soft delete (marks as deleted but keeps the record)
  const deleteQuote = useCallback(
    (quoteId: string): boolean => {
      const existing = getQuote(quoteId);
      if (!existing) return false;

      // Cannot delete if accepted, started, or completed
      if (
        existing.quoteStatus === 'accepted_in_progress' ||
        existing.quoteStatus === 'started' ||
        existing.quoteStatus === 'completed'
      ) {
        return false;
      }

      const now = getCurrentDateString();
      const doctorName = getDoctorName(existing.doctorId);

      const updated: Quote = {
        ...existing,
        isDeleted: true,
        lastStatusChangeAt: now,
        events: [...existing.events, createEvent('deleted', doctorName)],
      };
      updateQuote(updated);

      // Increment deleted count
      updateSettings({
        ...settings,
        quote: {
          ...settings.quote,
          deletedCount: settings.quote.deletedCount + 1,
        },
      });

      return true;
    },
    [getQuote, updateQuote, getDoctorName, settings, updateSettings]
  );

  // Check if quote can be deleted
  const canDeleteQuote = useCallback((quoteId: string): boolean => {
    const existing = getQuote(quoteId);
    if (!existing) return false;
    return (
      existing.quoteStatus !== 'accepted_in_progress' &&
      existing.quoteStatus !== 'started' &&
      existing.quoteStatus !== 'completed'
    );
  }, [getQuote]);

  // Check if quote can be reopened (lezárás visszavonható)
  const canReopenQuote = useCallback((quoteId: string): boolean => {
    const existing = getQuote(quoteId);
    if (!existing) return false;
    return existing.quoteStatus === 'closed_pending';
  }, [getQuote]);

  const duplicateQuote = useCallback(
    (quoteId: string): Quote | undefined => {
      const existing = getQuote(quoteId);
      if (!existing) return undefined;

      const now = getCurrentDateString();
      const doctorName = getDoctorName(existing.doctorId);

      // Increment counter and generate quote number
      const newCounter = settings.quote.counter + 1;
      const quoteNumber = generateQuoteNumber(settings.quote.prefix, newCounter);

      // Update settings with new counter
      updateSettings({
        ...settings,
        quote: {
          ...settings.quote,
          counter: newCounter,
        },
      });

      const duplicate: Quote = {
        ...existing,
        quoteId: nanoid(),
        quoteNumber,
        quoteName: `${existing.quoteName} (másolat)`,
        createdAt: now,
        lastStatusChangeAt: now,
        validUntil: addDays(now, settings.defaultValidityDays),
        quoteStatus: 'draft',
        isDeleted: false,
        items: existing.items.map((item) => ({
          ...item,
          lineId: nanoid(),
        })),
        events: [createEvent('created', doctorName)],
      };
      addQuote(duplicate);
      return duplicate;
    },
    [getQuote, addQuote, settings, updateSettings, getDoctorName]
  );

  const getQuoteTotals = useCallback((quoteId: string) => {
    const quote = getQuote(quoteId);
    if (!quote) return { subtotal: 0, lineDiscounts: 0, globalDiscount: 0, total: 0 };
    return calculateQuoteTotals(quote);
  }, [getQuote]);

  // Statistics for settings page
  const getQuoteStatistics = useCallback(() => {
    const allQuotes = quotes; // Include deleted for total count
    const active = quotes.filter((q) => !q.isDeleted);

    return {
      total: allQuotes.length,
      deleted: settings.quote.deletedCount,
      closed: active.filter((q) =>
        q.quoteStatus !== 'draft' && q.events.some((e) => e.type === 'closed')
      ).length,
      acceptedInProgress: active.filter((q) => q.quoteStatus === 'accepted_in_progress').length,
      started: active.filter((q) => q.quoteStatus === 'started').length,
      completed: active.filter((q) => q.quoteStatus === 'completed').length,
      rejected: active.filter((q) => q.quoteStatus === 'rejected').length,
      draft: active.filter((q) => q.quoteStatus === 'draft').length,
      closedPending: active.filter((q) => q.quoteStatus === 'closed_pending').length,
    };
  }, [quotes, settings.quote.deletedCount]);

  return {
    quotes: activeQuotes,
    allQuotes: quotes,
    draftQuotes,
    inProgressQuotes,
    completedQuotes,
    rejectedQuotes,
    getQuote,
    getQuotesByPatient,
    createQuote,
    createQuoteItem,
    addItemToQuote,
    updateQuoteItem,
    removeItemFromQuote,
    reorderQuoteItems,
    editQuote,
    addEventToQuote,
    deleteQuote,
    canDeleteQuote,
    canReopenQuote,
    // Status transitions
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
    // Other
    duplicateQuote,
    getQuoteTotals,
    getQuoteStatistics,
    getDoctorName,
  };
}
