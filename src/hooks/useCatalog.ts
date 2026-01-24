import { useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import {
  CatalogItem,
  CatalogItemFormData,
  CatalogCategory,
  CATALOG_CATEGORIES,
  CATALOG_UNITS,
} from '../types';
import { catalogToCsv, parseCatalogCsv } from '../utils';

export function useCatalog() {
  const {
    catalog,
    addCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
    getCatalogItem,
    resetCatalog,
  } = useApp();

  const activeItems = useMemo(() => catalog.filter((c) => c.isActive), [catalog]);

  const inactiveItems = useMemo(() => catalog.filter((c) => !c.isActive), [catalog]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<CatalogCategory, CatalogItem[]> = {
      Diagnosztika: [],
      Parodontológia: [],
      Konzerváló: [],
      Endodoncia: [],
      Szájsebészet: [],
      Implantáció: [],
      Protetika: [],
      Gyerefogászat: [],
      Fogszabályozás: [],
    };

    activeItems.forEach((item) => {
      grouped[item.catalogCategory].push(item);
    });

    return grouped;
  }, [activeItems]);

  const createCatalogItem = useCallback(
    (data: CatalogItemFormData): CatalogItem => {
      const technicalPrice = data.catalogTechnicalPrice ?? 0;
      const item: CatalogItem = {
        ...data,
        catalogTechnicalPrice: technicalPrice,
        catalogItemId: nanoid(),
        hasTechnicalPrice: technicalPrice > 0,
      };
      addCatalogItem(item);
      return item;
    },
    [addCatalogItem]
  );

  const editCatalogItem = useCallback(
    (catalogItemId: string, data: Partial<CatalogItemFormData>): CatalogItem | undefined => {
      const existing = getCatalogItem(catalogItemId);
      if (!existing) return undefined;

      const updated: CatalogItem = {
        ...existing,
        ...data,
        hasTechnicalPrice:
          (data.catalogTechnicalPrice ?? existing.catalogTechnicalPrice) > 0,
      };
      updateCatalogItem(updated);
      return updated;
    },
    [getCatalogItem, updateCatalogItem]
  );

  const toggleItemActive = useCallback(
    (catalogItemId: string): void => {
      const existing = getCatalogItem(catalogItemId);
      if (existing) {
        updateCatalogItem({
          ...existing,
          isActive: !existing.isActive,
        });
      }
    },
    [getCatalogItem, updateCatalogItem]
  );

  const searchCatalog = useCallback(
    (query: string, category?: CatalogCategory, activeOnly = true): CatalogItem[] => {
      const searchLower = query.toLowerCase().trim();
      let source = activeOnly ? activeItems : catalog;

      if (category) {
        source = source.filter((c) => c.catalogCategory === category);
      }

      if (!searchLower) {
        return source;
      }

      return source.filter(
        (c) =>
          c.catalogName.toLowerCase().includes(searchLower) ||
          c.catalogCode.toLowerCase().includes(searchLower)
      );
    },
    [catalog, activeItems]
  );

  const exportCatalog = useCallback((): string => {
    return JSON.stringify(catalog, null, 2);
  }, [catalog]);

  const normalizeCatalogItems = useCallback((items: Partial<CatalogItem>[]): CatalogItem[] | null => {
    const normalized: CatalogItem[] = [];

    for (const item of items) {
      const code = item.catalogCode?.toString().trim();
      const name = item.catalogName?.toString().trim();
      const unit = item.catalogUnit?.toString().trim();
      const category = item.catalogCategory as CatalogCategory | undefined;

      if (!code || !name || !unit || !category || !CATALOG_CATEGORIES.includes(category)) {
        return null;
      }

      const priceValue = Number(item.catalogPrice);
      const vatValue = Number(item.catalogVatRate);
      const technicalValue = Number(item.catalogTechnicalPrice);
      const rawIsActive = item.isActive as unknown;
      let isActive = true;
      if (typeof rawIsActive === 'boolean') {
        isActive = rawIsActive;
      } else if (typeof rawIsActive === 'string') {
        isActive = ['true', '1'].includes(rawIsActive.trim().toLowerCase());
      }

      const isFullMouthValue = (() => {
        const val = item.isFullMouth as unknown;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
          return ['true', '1'].includes(val.trim().toLowerCase());
        }
        return false;
      })();

      const isArchValue = (() => {
        const val = item.isArch as unknown;
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
          return ['true', '1'].includes(val.trim().toLowerCase());
        }
        return false;
      })();

      const normalizedUnit = ((): (typeof CATALOG_UNITS)[number] => {
        if (CATALOG_UNITS.includes(unit as (typeof CATALOG_UNITS)[number])) {
          return unit as (typeof CATALOG_UNITS)[number];
        }
        return 'alkalom';
      })();

      normalized.push({
        catalogItemId: item.catalogItemId?.toString() || nanoid(),
        catalogCode: code.toUpperCase(),
        catalogName: name,
        catalogUnit: normalizedUnit,
        catalogPrice: Number.isFinite(priceValue) ? priceValue : 0,
        catalogPriceCurrency: item.catalogPriceCurrency === 'EUR' ? 'EUR' : 'HUF',
        catalogVatRate: Number.isFinite(vatValue) ? vatValue : 0,
        catalogTechnicalPrice: Number.isFinite(technicalValue) ? technicalValue : 0,
        catalogCategory: category,
        hasTechnicalPrice: Number.isFinite(technicalValue) ? technicalValue > 0 : false,
        isFullMouth: isFullMouthValue,
        isArch: isArchValue,
        isActive,
      });
    }

    return normalized;
  }, []);

  const importCatalog = useCallback(
    (data: string): boolean => {
      try {
        const items: Partial<CatalogItem>[] = JSON.parse(data);
        if (!Array.isArray(items)) return false;

        const normalized = normalizeCatalogItems(items);
        if (!normalized) return false;

        resetCatalog(normalized);
        return true;
      } catch {
        return false;
      }
    },
    [normalizeCatalogItems, resetCatalog]
  );

  const exportCatalogCSV = useCallback(() => catalogToCsv(catalog), [catalog]);

  const importCatalogCSV = useCallback(
    (data: string) => {
      const rows = parseCatalogCsv(data);
      if (rows === null) return false;

      const normalized = normalizeCatalogItems(rows);
      if (!normalized) return false;

      resetCatalog(normalized);
      return true;
    },
    [normalizeCatalogItems, resetCatalog]
  );

  return {
    catalog,
    activeItems,
    inactiveItems,
    itemsByCategory,
    getCatalogItem,
    createCatalogItem,
    editCatalogItem,
    deleteCatalogItem,
    toggleItemActive,
    searchCatalog,
    resetCatalog,
    exportCatalog,
    importCatalog,
    exportCatalogCSV,
    importCatalogCSV,
  };
}
