import { nanoid } from 'nanoid';
import {
  Patient,
  CatalogItem,
  Quote,
  Settings,
  CatalogCategory,
  CATALOG_CATEGORIES,
  CATALOG_UNITS,
  DentalStatusSnapshot,
} from '../types';
import { StorageRepository, ExportData } from './StorageRepository';
import { defaultCatalog } from '../data/defaultCatalog';
import { defaultSettings } from '../data/defaultSettings';

const STORAGE_KEYS = {
  PATIENTS: 'dental_quote_patients',
  CATALOG: 'dental_quote_catalog',
  QUOTES: 'dental_quote_quotes',
  SETTINGS: 'dental_quote_settings',
  DENTAL_STATUS: 'dental_quote_dental_status_snapshots',
} as const;

const DATA_VERSION = '1.0.0';

export class LocalStorageRepository implements StorageRepository {
  // Patients
  getPatients(): Patient[] {
    const data = localStorage.getItem(STORAGE_KEYS.PATIENTS);
    if (!data) return [];
    try {
      const patients = JSON.parse(data);

      // Migration: convert old address string to zipCode, city, street
      let needsSave = false;
      const migratedPatients = patients.map((p: Patient & { address?: string }) => {
        if (p.address && !p.zipCode && !p.city && !p.street) {
          needsSave = true;
          // Try to parse address: "9700 Szombathely, Fő tér 1."
          const match = p.address.match(/^(\d{4})\s+([^,]+),?\s*(.*)$/);
          if (match) {
            return {
              ...p,
              zipCode: match[1],
              city: match[2].trim(),
              street: match[3]?.trim() || '',
              address: undefined,
            };
          }
          // Fallback: put everything in street
          return {
            ...p,
            street: p.address,
            address: undefined,
          };
        }
        return p;
      });

      if (needsSave) {
        localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(migratedPatients));
      }

      return migratedPatients;
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
      localStorage.setItem(STORAGE_KEYS.CATALOG, JSON.stringify(defaultCatalog));
      return defaultCatalog;
    }
    try {
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        return defaultCatalog;
      }
      const normalized = parsed.map((item: Partial<CatalogItem>) => normalizeCatalogItem(item));
      const normalizedString = JSON.stringify(normalized);
      if (normalizedString !== data) {
        localStorage.setItem(STORAGE_KEYS.CATALOG, normalizedString);
      }
      return normalized;
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
      const quotes = JSON.parse(data);
      let needsSave = false;

      // Migration: convert old quote format to new format
      const migratedQuotes = quotes.map((q: Quote & {
        status?: string;
        acceptanceStatus?: string;
        updatedAt?: string;
        acceptedAt?: string;
      }, index: number) => {
        const migrated = { ...q };

        // Migration: old status/acceptanceStatus to new quoteStatus
        if (q.status && !q.quoteStatus) {
          needsSave = true;
          if (q.status === 'draft') {
            migrated.quoteStatus = 'draft';
          } else if (q.status === 'final') {
            if (q.acceptanceStatus === 'accepted') {
              migrated.quoteStatus = 'accepted_in_progress';
            } else if (q.acceptanceStatus === 'rejected') {
              migrated.quoteStatus = 'rejected';
            } else {
              migrated.quoteStatus = 'closed_pending';
            }
          } else if (q.status === 'archived') {
            migrated.quoteStatus = 'completed';
          }
          delete (migrated as { status?: string }).status;
          delete (migrated as { acceptanceStatus?: string }).acceptanceStatus;
          delete (migrated as { acceptedAt?: string }).acceptedAt;
        }

        // Migration: generate quoteNumber if missing
        if (!q.quoteNumber) {
          needsSave = true;
          // Use index + 1 as a fallback counter
          const settings = this.getSettings();
          migrated.quoteNumber = `${settings.quote.prefix}-${String(index + 1).padStart(4, '0')}`;
        }

        // Migration: lastStatusChangeAt from updatedAt
        if (!q.lastStatusChangeAt && q.updatedAt) {
          needsSave = true;
          migrated.lastStatusChangeAt = q.updatedAt;
          delete (migrated as { updatedAt?: string }).updatedAt;
        } else if (!q.lastStatusChangeAt) {
          needsSave = true;
          migrated.lastStatusChangeAt = q.createdAt;
        }

        // Migration: initialize events array if missing
        if (!q.events) {
          needsSave = true;
          migrated.events = [{
            id: nanoid(),
            timestamp: q.createdAt,
            type: 'created' as const,
            doctorName: 'Ismeretlen',
          }];
        }

        return migrated;
      });

      if (needsSave) {
        localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(migratedQuotes));
      }

      return migratedQuotes;
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
      const parsed = JSON.parse(data);
      let needsSave = false;

      // Migration: convert old clinic.doctor string to doctors array
      if (parsed.clinic?.doctor && !parsed.doctors) {
        parsed.doctors = [{ id: 'doc-1', name: parsed.clinic.doctor, stampNumber: '' }];
        delete parsed.clinic.doctor;
        needsSave = true;
      }

      // Ensure doctors array exists
      if (!parsed.doctors) {
        parsed.doctors = defaultSettings.doctors;
        needsSave = true;
      }

      // Migration: add stampNumber to existing doctors
      if (parsed.doctors && parsed.doctors.length > 0 && parsed.doctors[0].stampNumber === undefined) {
        parsed.doctors = parsed.doctors.map((d: { id: string; name: string; stampNumber?: string }) => ({
          ...d,
          stampNumber: d.stampNumber || '',
        }));
        needsSave = true;
      }

      // Migration: add quote settings if missing
      if (!parsed.quote) {
        // Generate random 4-letter prefix
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let prefix = '';
        for (let i = 0; i < 4; i++) {
          prefix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        parsed.quote = {
          prefix,
          counter: 0,
          deletedCount: 0,
        };
        needsSave = true;
      }

      if (!parsed.dateFormat) {
        parsed.dateFormat = defaultSettings.dateFormat;
        needsSave = true;
      } else if (!String(parsed.dateFormat).includes('HH:MM:SS')) {
        parsed.dateFormat = `${parsed.dateFormat} HH:MM:SS`;
        needsSave = true;
      }

      if (needsSave) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed));
      }

      return parsed;
    } catch {
      return defaultSettings;
    }
  }

  saveSettings(settings: Settings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  // Dental status snapshots
  getDentalStatusSnapshots(patientId: string): DentalStatusSnapshot[] {
    const data = localStorage.getItem(STORAGE_KEYS.DENTAL_STATUS);
    if (!data) return [];
    try {
      const snapshots = JSON.parse(data) as DentalStatusSnapshot[];
      if (!Array.isArray(snapshots)) return [];
      return patientId ? snapshots.filter((s) => s.patientId === patientId) : snapshots;
    } catch {
      return [];
    }
  }

  getLatestDentalStatusSnapshot(patientId: string): DentalStatusSnapshot | undefined {
    const snapshots = this.getDentalStatusSnapshots(patientId);
    return snapshots
      .slice()
      .sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime())[0];
  }

  createDentalStatusSnapshot(snapshot: DentalStatusSnapshot): void {
    const data = localStorage.getItem(STORAGE_KEYS.DENTAL_STATUS);
    let snapshots: DentalStatusSnapshot[] = [];
    if (data) {
      try {
        const parsed = JSON.parse(data) as DentalStatusSnapshot[];
        snapshots = Array.isArray(parsed) ? parsed : [];
      } catch {
        snapshots = [];
      }
    }
    snapshots.push(snapshot);
    localStorage.setItem(STORAGE_KEYS.DENTAL_STATUS, JSON.stringify(snapshots));
  }

  updateDentalStatusSnapshot(snapshot: DentalStatusSnapshot): void {
    const data = localStorage.getItem(STORAGE_KEYS.DENTAL_STATUS);
    let snapshots: DentalStatusSnapshot[] = [];
    if (data) {
      try {
        const parsed = JSON.parse(data) as DentalStatusSnapshot[];
        snapshots = Array.isArray(parsed) ? parsed : [];
      } catch {
        snapshots = [];
      }
    }
    const index = snapshots.findIndex((s) => s.snapshotId === snapshot.snapshotId);
    if (index >= 0) {
      snapshots[index] = snapshot;
    } else {
      snapshots.push(snapshot);
    }
    localStorage.setItem(STORAGE_KEYS.DENTAL_STATUS, JSON.stringify(snapshots));
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
      dentalStatusSnapshots: (() => {
        const data = localStorage.getItem(STORAGE_KEYS.DENTAL_STATUS);
        if (!data) return [];
        try {
          const snapshots = JSON.parse(data);
          return Array.isArray(snapshots) ? snapshots : [];
        } catch {
          return [];
        }
      })(),
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
      localStorage.setItem(
        STORAGE_KEYS.DENTAL_STATUS,
        JSON.stringify(importData.dentalStatusSnapshots || [])
      );

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
    catalogItemId: item.catalogItemId || nanoid(),
    catalogCode: item.catalogCode ? item.catalogCode.toString().toUpperCase() : '',
    catalogName: item.catalogName ? item.catalogName.toString() : '',
    catalogUnit: normalizedUnit,
    catalogPrice: Number.isFinite(catalogPriceValue) ? catalogPriceValue : 0,
    catalogPriceCurrency: item.catalogPriceCurrency === 'EUR' ? 'EUR' : 'HUF',
    catalogVatRate: Number.isFinite(vatValue) ? vatValue : 0,
    catalogTechnicalPrice: Number.isFinite(technicalPriceValue) ? technicalPriceValue : 0,
    catalogCategory: normalizedCategory,
    hasTechnicalPrice: Number.isFinite(technicalPriceValue) ? technicalPriceValue > 0 : false,
    isFullMouth: toBoolean(item.isFullMouth),
    isArch: toBoolean(item.isArch),
    isActive: toBoolean(item.isActive, true),
  };
}
