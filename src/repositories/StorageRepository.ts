import { Patient, CatalogItem, Quote, Settings } from '../types';

export interface StorageRepository {
  // Patients
  getPatients(): Patient[];
  getPatient(patientId: string): Patient | undefined;
  savePatient(patient: Patient): void;
  deletePatient(patientId: string): void;

  // Catalog
  getCatalog(): CatalogItem[];
  getCatalogItem(catalogItemId: string): CatalogItem | undefined;
  saveCatalogItem(item: CatalogItem): void;
  deleteCatalogItem(catalogItemId: string): void;
  resetCatalog(items: CatalogItem[]): void;

  // Quotes
  getQuotes(): Quote[];
  getQuote(quoteId: string): Quote | undefined;
  getQuotesByPatient(patientId: string): Quote[];
  saveQuote(quote: Quote): void;
  deleteQuote(quoteId: string): void;

  // Settings
  getSettings(): Settings;
  saveSettings(settings: Settings): void;

  // Export/Import
  exportAll(): string;
  importAll(data: string): boolean;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  patients: Patient[];
  catalog: CatalogItem[];
  quotes: Quote[];
  settings: Settings;
}
