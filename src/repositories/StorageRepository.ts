import { Patient, CatalogItem, Quote, Settings, DentalStatusSnapshot, PriceList, PriceListCategory } from '../types';

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

  // PriceLists
  getPriceLists(): PriceList[];
  savePriceList(priceList: PriceList): void;
  deletePriceList(priceListId: string): void;
  resetPriceLists(pricelists: PriceList[], categories: PriceListCategory[], items: CatalogItem[]): void;

  // PriceList Categories
  getPriceListCategories(priceListId?: string): PriceListCategory[];
  savePriceListCategory(category: PriceListCategory): void;
  deletePriceListCategory(catalogCategoryId: string): void;

  // Quotes
  getQuotes(): Quote[];
  getQuote(quoteId: string): Quote | undefined;
  getQuotesByPatient(patientId: string): Quote[];
  saveQuote(quote: Quote): void;
  deleteQuote(quoteId: string): void;

  // Settings
  getSettings(): Settings;
  saveSettings(settings: Settings): void;

  // Dental status snapshots
  getDentalStatusSnapshots(patientId: string): DentalStatusSnapshot[];
  getLatestDentalStatusSnapshot(patientId: string): DentalStatusSnapshot | undefined;
  createDentalStatusSnapshot(snapshot: DentalStatusSnapshot): void;
  updateDentalStatusSnapshot(snapshot: DentalStatusSnapshot): void;

  // Export/Import
  exportAll(): string;
  importAll(data: string): boolean;
}

export interface ExportDoctor {
  doctorId: string;
  doctorName: string;
  doctorNum?: string;
  doctorEESZTId?: string;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  patients: Patient[];
  catalog: CatalogItem[];
  quotes: Quote[];
  settings: Settings;
  dentalStatusSnapshots?: DentalStatusSnapshot[];
  pricelists?: PriceList[];
  pricelistCategories?: PriceListCategory[];
  doctors?: ExportDoctor[];
}
