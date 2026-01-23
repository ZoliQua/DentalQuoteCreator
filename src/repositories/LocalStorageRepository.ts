import { Patient, CatalogItem, Quote, Settings } from '../types';
import { StorageRepository, ExportData } from './StorageRepository';
import { defaultCatalog } from '../data/defaultCatalog';
import { defaultSettings } from '../data/defaultSettings';

const STORAGE_KEYS = {
  PATIENTS: 'dental_quote_patients',
  CATALOG: 'dental_quote_catalog',
  QUOTES: 'dental_quote_quotes',
  SETTINGS: 'dental_quote_settings',
} as const;

const DATA_VERSION = '1.0.0';

export class LocalStorageRepository implements StorageRepository {
  // Patients
  getPatients(): Patient[] {
    const data = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  getPatient(patientId: string): Patient | undefined {
    return this.getPatients().find((p) => p.patientId === patientId);
  }

  savePatient(patient: Patient): void {
    const patients = this.getPatients();
    const index = patients.findIndex((p) => p.patientId === patient.patientId);
    if (index >= 0) {
      patients[index] = patient;
    } else {
      patients.push(patient);
    }
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  }

  deletePatient(patientId: string): void {
    const patients = this.getPatients().filter((p) => p.patientId !== patientId);
    localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
  }

  // Catalog
  getCatalog(): CatalogItem[] {
    const data = localStorage.getItem(STORAGE_KEYS.CATALOG);
    if (!data) {
      // Initialize with default catalog
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(defaultCatalog));
      return defaultCatalog;
    }
    try {
      return JSON.parse(data);
    } catch {
      return defaultCatalog;
    }
  }

  getCatalogItem(catalogItemId: string): CatalogItem | undefined {
    return this.getCatalog().find((c) => c.catalogItemId === catalogItemId);
  }

  saveCatalogItem(item: CatalogItem): void {
    const catalog = this.getCatalog();
    const index = catalog.findIndex((c) => c.catalogItemId === item.catalogItemId);
    if (index >= 0) {
      catalog[index] = item;
    } else {
      catalog.push(item);
    }
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
  }

  deleteCatalogItem(catalogItemId: string): void {
    const catalog = this.getCatalog().filter((c) => c.catalogItemId !== catalogItemId);
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(catalog));
  }

  resetCatalog(items: CatalogItem[]): void {
    localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(items));
  }

  // Quotes
  getQuotes(): Quote[] {
    const data = localStorage.getItem(STORAGE_KEYS.QUOTES);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  getQuote(quoteId: string): Quote | undefined {
    return this.getQuotes().find((q) => q.quoteId === quoteId);
  }

  getQuotesByPatient(patientId: string): Quote[] {
    return this.getQuotes().filter((q) => q.patientId === patientId);
  }

  saveQuote(quote: Quote): void {
    const quotes = this.getQuotes();
    const index = quotes.findIndex((q) => q.quoteId === quote.quoteId);
    if (index >= 0) {
      quotes[index] = quote;
    } else {
      quotes.push(quote);
    }
    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotes));
  }

  deleteQuote(quoteId: string): void {
    const quotes = this.getQuotes().filter((q) => q.quoteId !== quoteId);
    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotes));
  }

  // Settings
  getSettings(): Settings {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      // Initialize with default settings
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
      return defaultSettings;
    }
    try {
      return JSON.parse(data);
    } catch {
      return defaultSettings;
    }
  }

  saveSettings(settings: Settings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // Export/Import
  exportAll(): string {
    const exportData: ExportData = {
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      patients: this.getPatients(),
      catalog: this.getCatalog(),
      quotes: this.getQuotes(),
      settings: this.getSettings(),
    };
    return JSON.stringify(exportData, null, 2);
  }

  importAll(data: string): boolean {
    try {
      const importData: ExportData = JSON.parse(data);

      // Validate structure
      if (
        !importData.version ||
        !Array.isArray(importData.patients) ||
        !Array.isArray(importData.catalog) ||
        !Array.isArray(importData.quotes) ||
        !importData.settings
      ) {
        return false;
      }

      // Import all data
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(importData.patients));
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(importData.catalog));
      localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(importData.quotes));
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(importData.settings));

      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const storage = new LocalStorageRepository();
