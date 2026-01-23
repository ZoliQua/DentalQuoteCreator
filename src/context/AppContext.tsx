import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Patient, CatalogItem, Quote } from '../types';
import { storage } from '../repositories';
import { defaultCatalog } from '../data/defaultCatalog';

interface AppContextType {
  // Patients
  patients: Patient[];
  addPatient: (patient: Patient) => void;
  updatePatient: (patient: Patient) => void;
  deletePatient: (patientId: string) => void;
  getPatient: (patientId: string) => Patient | undefined;

  // Catalog
  catalog: CatalogItem[];
  addCatalogItem: (item: CatalogItem) => void;
  updateCatalogItem: (item: CatalogItem) => void;
  deleteCatalogItem: (catalogItemId: string) => void;
  getCatalogItem: (catalogItemId: string) => CatalogItem | undefined;
  resetCatalog: () => void;

  // Quotes
  quotes: Quote[];
  addQuote: (quote: Quote) => void;
  updateQuote: (quote: Quote) => void;
  deleteQuote: (quoteId: string) => void;
  getQuote: (quoteId: string) => Quote | undefined;
  getQuotesByPatient: (patientId: string) => Quote[];

  // Data management
  exportData: () => string;
  importData: (data: string) => boolean;
  refreshData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  // Load data on mount
  useEffect(() => {
    setPatients(storage.getPatients());
    setCatalog(storage.getCatalog());
    setQuotes(storage.getQuotes());
  }, []);

  // Listen for storage changes (for multi-tab support)
  useEffect(() => {
    const handleStorageChange = () => {
      setPatients(storage.getPatients());
      setCatalog(storage.getCatalog());
      setQuotes(storage.getQuotes());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Patients
  const addPatient = useCallback((patient: Patient) => {
    storage.savePatient(patient);
    setPatients(storage.getPatients());
  }, []);

  const updatePatient = useCallback((patient: Patient) => {
    storage.savePatient(patient);
    setPatients(storage.getPatients());
  }, []);

  const deletePatient = useCallback((patientId: string) => {
    storage.deletePatient(patientId);
    setPatients(storage.getPatients());
  }, []);

  const getPatient = useCallback(
    (patientId: string) => patients.find((p) => p.patientId === patientId),
    [patients]
  );

  // Catalog
  const addCatalogItem = useCallback((item: CatalogItem) => {
    storage.saveCatalogItem(item);
    setCatalog(storage.getCatalog());
  }, []);

  const updateCatalogItem = useCallback((item: CatalogItem) => {
    storage.saveCatalogItem(item);
    setCatalog(storage.getCatalog());
  }, []);

  const deleteCatalogItem = useCallback((catalogItemId: string) => {
    storage.deleteCatalogItem(catalogItemId);
    setCatalog(storage.getCatalog());
  }, []);

  const getCatalogItem = useCallback(
    (catalogItemId: string) => catalog.find((c) => c.catalogItemId === catalogItemId),
    [catalog]
  );

  const resetCatalog = useCallback(() => {
    storage.resetCatalog(defaultCatalog);
    setCatalog(defaultCatalog);
  }, []);

  // Quotes
  const addQuote = useCallback((quote: Quote) => {
    storage.saveQuote(quote);
    setQuotes(storage.getQuotes());
  }, []);

  const updateQuote = useCallback((quote: Quote) => {
    storage.saveQuote(quote);
    setQuotes(storage.getQuotes());
  }, []);

  const deleteQuote = useCallback((quoteId: string) => {
    storage.deleteQuote(quoteId);
    setQuotes(storage.getQuotes());
  }, []);

  const getQuote = useCallback(
    (quoteId: string) => quotes.find((q) => q.quoteId === quoteId),
    [quotes]
  );

  const getQuotesByPatient = useCallback(
    (patientId: string) => quotes.filter((q) => q.patientId === patientId),
    [quotes]
  );

  // Data management
  const exportData = useCallback(() => storage.exportAll(), []);

  const importData = useCallback((data: string) => {
    const success = storage.importAll(data);
    if (success) {
      setPatients(storage.getPatients());
      setCatalog(storage.getCatalog());
      setQuotes(storage.getQuotes());
    }
    return success;
  }, []);

  const refreshData = useCallback(() => {
    setPatients(storage.getPatients());
    setCatalog(storage.getCatalog());
    setQuotes(storage.getQuotes());
  }, []);

  return (
    <AppContext.Provider
      value={{
        patients,
        addPatient,
        updatePatient,
        deletePatient,
        getPatient,
        catalog,
        addCatalogItem,
        updateCatalogItem,
        deleteCatalogItem,
        getCatalogItem,
        resetCatalog,
        quotes,
        addQuote,
        updateQuote,
        deleteQuote,
        getQuote,
        getQuotesByPatient,
        exportData,
        importData,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
