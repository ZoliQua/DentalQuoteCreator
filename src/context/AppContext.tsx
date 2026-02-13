import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Patient, CatalogItem, Quote, DentalStatusSnapshot } from '../types';
import { storage } from '../repositories';
import { defaultCatalog } from '../data/defaultCatalog';
import { useAuth } from './AuthContext';

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
  resetCatalog: (items?: CatalogItem[]) => void;

  // Quotes
  quotes: Quote[];
  addQuote: (quote: Quote) => void;
  updateQuote: (quote: Quote) => void;
  deleteQuote: (quoteId: string) => void;
  getQuote: (quoteId: string) => Quote | undefined;
  getQuotesByPatient: (patientId: string) => Quote[];

  // Restore (admin)
  restorePatient: (patientId: string) => void;
  restoreQuote: (quoteId: string) => void;

  // Data management
  exportData: () => string;
  importData: (data: string) => boolean;
  refreshData: () => void;

  // Dental status snapshots
  dentalStatusSnapshots: DentalStatusSnapshot[];
  getDentalStatusSnapshots: (patientId: string) => DentalStatusSnapshot[];
  getLatestDentalStatusSnapshot: (patientId: string) => DentalStatusSnapshot | undefined;
  createDentalStatusSnapshot: (snapshot: DentalStatusSnapshot) => void;
  updateDentalStatusSnapshot: (snapshot: DentalStatusSnapshot) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [dentalStatusSnapshots, setDentalStatusSnapshots] = useState<DentalStatusSnapshot[]>([]);

  // Load data on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setPatients([]);
      setCatalog([]);
      setQuotes([]);
      setDentalStatusSnapshots([]);
      return;
    }
    setPatients(storage.getPatients());
    setCatalog(storage.getCatalog());
    setQuotes(storage.getQuotes());
    setDentalStatusSnapshots(storage.getDentalStatusSnapshots(''));
  }, [isAuthenticated]);

  // Listen for storage changes (for multi-tab support)
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleStorageChange = () => {
      setPatients(storage.getPatients());
      setCatalog(storage.getCatalog());
      setQuotes(storage.getQuotes());
      setDentalStatusSnapshots(storage.getDentalStatusSnapshots(''));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-changed', handleStorageChange);
    };
  }, [isAuthenticated]);

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
    try {
      storage.deletePatient(patientId);
      setPatients(storage.getPatients());
    } catch (error) {
      console.error('Failed to delete patient:', error);
    }
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
    try {
      storage.deleteCatalogItem(catalogItemId);
      setCatalog(storage.getCatalog());
    } catch (error) {
      console.error('Failed to delete catalog item:', error);
    }
  }, []);

  const getCatalogItem = useCallback(
    (catalogItemId: string) => catalog.find((c) => c.catalogItemId === catalogItemId),
    [catalog]
  );

  const resetCatalog = useCallback((items?: CatalogItem[]) => {
    const newCatalog = items ?? defaultCatalog;
    storage.resetCatalog(newCatalog);
    setCatalog(newCatalog);
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
    try {
      storage.deleteQuote(quoteId);
      setQuotes(storage.getQuotes());
    } catch (error) {
      console.error('Failed to delete quote:', error);
    }
  }, []);

  const getQuote = useCallback(
    (quoteId: string) => quotes.find((q) => q.quoteId === quoteId),
    [quotes]
  );

  const getQuotesByPatient = useCallback(
    (patientId: string) => quotes.filter((q) => q.patientId === patientId),
    [quotes]
  );

  // Dental status snapshots
  const getDentalStatusSnapshots = useCallback(
    (patientId: string) => {
      const allSnapshots = dentalStatusSnapshots.length
        ? dentalStatusSnapshots
        : storage.getDentalStatusSnapshots(patientId);
      return patientId ? allSnapshots.filter((s) => s.patientId === patientId) : allSnapshots;
    },
    [dentalStatusSnapshots]
  );

  const getLatestDentalStatusSnapshot = useCallback(
    (patientId: string) => {
      const snapshots = getDentalStatusSnapshots(patientId);
      return snapshots
        .slice()
        .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
    },
    [getDentalStatusSnapshots]
  );

  const createDentalStatusSnapshot = useCallback((snapshot: DentalStatusSnapshot) => {
    storage.createDentalStatusSnapshot(snapshot);
    setDentalStatusSnapshots(storage.getDentalStatusSnapshots(''));
  }, []);

  const updateDentalStatusSnapshot = useCallback((snapshot: DentalStatusSnapshot) => {
    storage.updateDentalStatusSnapshot(snapshot);
    setDentalStatusSnapshots(storage.getDentalStatusSnapshots(''));
  }, []);

  // Restore (admin)
  const restorePatient = useCallback((patientId: string) => {
    try {
      storage.restorePatient(patientId);
      setPatients(storage.getPatients());
    } catch (error) {
      console.error('Failed to restore patient:', error);
    }
  }, []);

  const restoreQuote = useCallback((quoteId: string) => {
    try {
      storage.restoreQuote(quoteId);
      setQuotes(storage.getQuotes());
    } catch (error) {
      console.error('Failed to restore quote:', error);
    }
  }, []);

  // Data management
  const exportData = useCallback(() => storage.exportAll(), []);

  const importData = useCallback((data: string) => {
    const success = storage.importAll(data);
    if (success) {
      setPatients(storage.getPatients());
      setCatalog(storage.getCatalog());
      setQuotes(storage.getQuotes());
      setDentalStatusSnapshots(storage.getDentalStatusSnapshots(''));
    }
    return success;
  }, []);

  const refreshData = useCallback(() => {
    setPatients(storage.getPatients());
    setCatalog(storage.getCatalog());
    setQuotes(storage.getQuotes());
    setDentalStatusSnapshots(storage.getDentalStatusSnapshots(''));
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
        dentalStatusSnapshots,
        getDentalStatusSnapshots,
        getLatestDentalStatusSnapshot,
        createDentalStatusSnapshot,
        updateDentalStatusSnapshot,
        restorePatient,
        restoreQuote,
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
