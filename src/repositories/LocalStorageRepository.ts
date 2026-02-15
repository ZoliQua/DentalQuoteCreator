import {
  CatalogCategory,
  CATALOG_CATEGORIES,
  CATALOG_UNITS,
  CatalogItem,
  DentalStatusSnapshot,
  Patient,
  Quote,
  Settings,
} from '../types';
import { defaultCatalog } from '../data/defaultCatalog';
import { defaultSettings } from '../data/defaultSettings';
import { StorageRepository, ExportData } from './StorageRepository';
import { requestJsonSync } from '../utils/syncHttp';
import { getAuthToken } from '../utils/auth';

const API_PREFIX = '/backend';

export class LocalStorageRepository implements StorageRepository {
  // Patients
  getPatients(): Patient[] {
    if (!getAuthToken()) return [];
    try {
      return requestJsonSync<Patient[]>('GET', `${API_PREFIX}/patients?includeArchived=true`);
    } catch {
      return [];
    }
  }

  getPatient(patientId: string): Patient | undefined {
    try {
      return requestJsonSync<Patient>('GET', `${API_PREFIX}/patients/${patientId}`);
    } catch {
      return undefined;
    }
  }

  savePatient(patient: Patient): void {
    const exists = this.getPatient(patient.patientId);
    if (exists) {
      requestJsonSync('PATCH', `${API_PREFIX}/patients/${patient.patientId}`, patient);
      return;
    }
    requestJsonSync('POST', `${API_PREFIX}/patients`, patient);
  }

  deletePatient(patientId: string): void {
    requestJsonSync('PATCH', `${API_PREFIX}/patients/${patientId}`, { isArchived: true });
  }

  restorePatient(patientId: string): void {
    requestJsonSync('PATCH', `${API_PREFIX}/patients/${patientId}/restore`);
  }

  // Catalog
  getCatalog(): CatalogItem[] {
    if (!getAuthToken()) return defaultCatalog;
    try {
      const items = requestJsonSync<CatalogItem[]>('GET', `${API_PREFIX}/catalog`);
      if (!Array.isArray(items) || items.length === 0) {
        return defaultCatalog;
      }
      return items.map((item) => normalizeCatalogItem(item));
    } catch {
      return defaultCatalog;
    }
  }

  getCatalogItem(catalogItemId: string): CatalogItem | undefined {
    return this.getCatalog().find((c) => c.catalogItemId === catalogItemId);
  }

  saveCatalogItem(item: CatalogItem): void {
    const exists = this.getCatalogItem(item.catalogItemId);
    if (exists) {
      requestJsonSync('PATCH', `${API_PREFIX}/catalog/${item.catalogItemId}`, item);
      return;
    }
    requestJsonSync('POST', `${API_PREFIX}/catalog`, item);
  }

  deleteCatalogItem(catalogItemId: string): void {
    requestJsonSync('DELETE', `${API_PREFIX}/catalog/${catalogItemId}`);
  }

  resetCatalog(items: CatalogItem[]): void {
    requestJsonSync('PUT', `${API_PREFIX}/catalog/reset`, { items });
  }

  // Quotes
  getQuotes(): Quote[] {
    if (!getAuthToken()) return [];
    try {
      const quotes = requestJsonSync<Quote[]>('GET', `${API_PREFIX}/quotes`);
      return Array.isArray(quotes) ? quotes : [];
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
    const exists = this.getQuote(quote.quoteId);
    if (exists) {
      requestJsonSync('PATCH', `${API_PREFIX}/quotes/${quote.quoteId}`, quote);
      return;
    }
    requestJsonSync('POST', `${API_PREFIX}/quotes`, quote);
  }

  deleteQuote(quoteId: string): void {
    requestJsonSync('DELETE', `${API_PREFIX}/quotes/${quoteId}`);
  }

  restoreQuote(quoteId: string): void {
    requestJsonSync('PATCH', `${API_PREFIX}/quotes/${quoteId}/restore`);
  }

  // Settings
  getSettings(): Settings {
    if (!getAuthToken()) return defaultSettings;
    try {
      const settings = requestJsonSync<Settings>('GET', `${API_PREFIX}/settings`);
      return normalizeSettings(settings) || defaultSettings;
    } catch {
      return defaultSettings;
    }
  }

  saveSettings(settings: Settings): void {
    if (!getAuthToken()) return;
    requestJsonSync('PUT', `${API_PREFIX}/settings`, settings);
  }

  // Dental status snapshots
  getDentalStatusSnapshots(patientId: string): DentalStatusSnapshot[] {
    if (!getAuthToken()) return [];
    try {
      const query = patientId ? `?patientId=${encodeURIComponent(patientId)}` : '';
      const snapshots = requestJsonSync<DentalStatusSnapshot[]>(
        'GET',
        `${API_PREFIX}/dental-status-snapshots${query}`
      );
      return Array.isArray(snapshots) ? snapshots : [];
    } catch {
      return [];
    }
  }

  getLatestDentalStatusSnapshot(patientId: string): DentalStatusSnapshot | undefined {
    return this.getDentalStatusSnapshots(patientId)
      .slice()
      .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
  }

  createDentalStatusSnapshot(snapshot: DentalStatusSnapshot): void {
    requestJsonSync('POST', `${API_PREFIX}/dental-status-snapshots`, snapshot);
  }

  updateDentalStatusSnapshot(snapshot: DentalStatusSnapshot): void {
    requestJsonSync('PUT', `${API_PREFIX}/dental-status-snapshots/${snapshot.snapshotId}`, snapshot);
  }

  // Export/Import
  exportAll(): string {
    try {
      const exportData = requestJsonSync<ExportData>('GET', `${API_PREFIX}/data/export`);
      return JSON.stringify(exportData, null, 2);
    } catch {
      const fallback: ExportData = {
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        patients: this.getPatients(),
        catalog: this.getCatalog(),
        quotes: this.getQuotes(),
        settings: this.getSettings(),
        dentalStatusSnapshots: this.getDentalStatusSnapshots(''),
      };
      return JSON.stringify(fallback, null, 2);
    }
  }

  importAll(data: string): boolean {
    try {
      const parsed = JSON.parse(data) as ExportData;
      if (
        !parsed.version ||
        !Array.isArray(parsed.patients) ||
        !Array.isArray(parsed.catalog) ||
        !Array.isArray(parsed.quotes) ||
        !parsed.settings
      ) {
        return false;
      }
      requestJsonSync('POST', `${API_PREFIX}/data/import`, parsed);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const storage = new LocalStorageRepository();

function normalizeCatalogItem(item: Partial<CatalogItem>): CatalogItem {
  const toBoolean = (value: unknown, defaultValue = false): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['true', '1'].includes(value.trim().toLowerCase());
    }
    return defaultValue;
  };

  const technicalPriceValue = Number(item.catalogTechnicalPrice);
  const catalogPriceValue = Number(item.catalogPrice);
  const vatValue = Number(item.catalogVatRate);
  const normalizedUnit = CATALOG_UNITS.includes(item.catalogUnit as (typeof CATALOG_UNITS)[number])
    ? (item.catalogUnit as (typeof CATALOG_UNITS)[number])
    : 'alkalom';
  const normalizedCategory =
    item.catalogCategory &&
    (CATALOG_CATEGORIES as readonly CatalogCategory[]).includes(item.catalogCategory as CatalogCategory)
      ? (item.catalogCategory as CatalogCategory)
      : CATALOG_CATEGORIES[0];

  return {
    catalogItemId: item.catalogItemId || '',
    catalogCode: item.catalogCode ? item.catalogCode.toString().toUpperCase() : '',
    catalogName: item.catalogName ? item.catalogName.toString() : '',
    catalogUnit: normalizedUnit,
    catalogPrice: Number.isFinite(catalogPriceValue) ? catalogPriceValue : 0,
    catalogPriceCurrency: item.catalogPriceCurrency === 'EUR' ? 'EUR' : 'HUF',
    catalogVatRate: Number.isFinite(vatValue) ? vatValue : 0,
    catalogTechnicalPrice: Number.isFinite(technicalPriceValue) ? technicalPriceValue : 0,
    catalogCategory: normalizedCategory,
    svgLayer: item.svgLayer ? item.svgLayer.toString() : '',
    hasLayer: toBoolean(item.hasLayer),
    hasTechnicalPrice: Number.isFinite(technicalPriceValue) ? technicalPriceValue > 0 : false,
    isFullMouth: toBoolean(item.isFullMouth),
    isArch: toBoolean(item.isArch),
    isQuadrant: toBoolean(item.isQuadrant),
    maxTeethPerArch: item.maxTeethPerArch != null ? Number(item.maxTeethPerArch) : undefined,
    allowedTeeth: Array.isArray(item.allowedTeeth)
      ? (item.allowedTeeth as number[]).map(Number).filter((n) => Number.isFinite(n))
      : undefined,
    milkToothOnly: toBoolean(item.milkToothOnly),
    catalogNameEn: item.catalogNameEn ? item.catalogNameEn.toString() : '',
    catalogNameDe: item.catalogNameDe ? item.catalogNameDe.toString() : '',
    isActive: toBoolean(item.isActive, true),
  };
}

function normalizeSettings(raw: Settings | null | undefined): Settings | null {
  if (!raw) return null;

  // Migrate old flat pdf format { footerText, warrantyText }
  // to new per-language format { hu: {...}, en: {...}, de: {...} }
  const pdf = raw.pdf as unknown;
  if (pdf && typeof pdf === 'object' && !Array.isArray(pdf)) {
    const pdfObj = pdf as Record<string, unknown>;
    // Detect old format: has footerText/warrantyText at top level (not hu/en/de keys)
    if (typeof pdfObj.footerText === 'string' || typeof pdfObj.warrantyText === 'string') {
      raw.pdf = {
        hu: {
          footerText: (pdfObj.footerText as string) || defaultSettings.pdf.hu.footerText,
          warrantyText: (pdfObj.warrantyText as string) || defaultSettings.pdf.hu.warrantyText,
        },
        en: { ...defaultSettings.pdf.en },
        de: { ...defaultSettings.pdf.de },
      };
    } else {
      // New format but ensure all languages exist with fallbacks
      const typedPdf = pdfObj as Record<string, Record<string, string> | undefined>;
      raw.pdf = {
        hu: {
          footerText: typedPdf.hu?.footerText || defaultSettings.pdf.hu.footerText,
          warrantyText: typedPdf.hu?.warrantyText || defaultSettings.pdf.hu.warrantyText,
        },
        en: {
          footerText: typedPdf.en?.footerText || defaultSettings.pdf.en.footerText,
          warrantyText: typedPdf.en?.warrantyText || defaultSettings.pdf.en.warrantyText,
        },
        de: {
          footerText: typedPdf.de?.footerText || defaultSettings.pdf.de.footerText,
          warrantyText: typedPdf.de?.warrantyText || defaultSettings.pdf.de.warrantyText,
        },
      };
    }
  } else {
    raw.pdf = { ...defaultSettings.pdf };
  }

  // Ensure quote.quoteLang exists
  if (!raw.quote?.quoteLang) {
    raw.quote = { ...raw.quote, quoteLang: raw.quote?.quoteLang || 'hu' };
  }

  return raw;
}
