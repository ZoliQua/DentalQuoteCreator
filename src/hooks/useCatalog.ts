import { useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { CatalogItem, CatalogItemFormData, CatalogCategory } from '../types';

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
      Konzerváló: [],
      Endodontia: [],
      Sebészet: [],
      Protetika: [],
      Esztétika: [],
      Fogszabályozás: [],
      Parodontológia: [],
      Egyéb: [],
    };

    activeItems.forEach((item) => {
      grouped[item.catalogCategory].push(item);
    });

    return grouped;
  }, [activeItems]);

  const createCatalogItem = useCallback(
    (data: CatalogItemFormData): CatalogItem => {
      const item: CatalogItem = {
        ...data,
        catalogItemId: nanoid(),
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

  const importCatalog = useCallback(
    (data: string): boolean => {
      try {
        const items: CatalogItem[] = JSON.parse(data);
        if (!Array.isArray(items)) return false;

        // Validate structure
        for (const item of items) {
          if (!item.catalogItemId || !item.catalogName || !item.catalogCode) {
            return false;
          }
        }

        // Replace all catalog items
        items.forEach((item) => addCatalogItem(item));
        return true;
      } catch {
        return false;
      }
    },
    [addCatalogItem]
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
  };
}
