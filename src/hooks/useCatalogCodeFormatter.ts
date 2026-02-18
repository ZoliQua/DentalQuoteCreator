import { useMemo, useCallback } from 'react';
import { usePriceListCategories } from './usePriceListCategories';
import type { CatalogItem } from '../types';

/**
 * Hook that provides a `formatCode` function to display catalog item codes
 * with the category prefix from PriceListCategory (e.g. "DIAG-01").
 */
export function useCatalogCodeFormatter() {
  const { allCategories } = usePriceListCategories();

  const prefixLookup = useMemo(() => {
    const byId: Record<string, string> = {};
    const byName: Record<string, string> = {};
    for (const cat of allCategories) {
      byId[cat.catalogCategoryId] = cat.catalogCategoryPrefix;
      byName[cat.catalogCategoryHu] = cat.catalogCategoryPrefix;
    }
    return { byId, byName };
  }, [allCategories]);

  const getItemPrefix = useCallback(
    (item: CatalogItem): string => {
      if ((item as unknown as Record<string, unknown>).catalogCategoryId) {
        const catId = (item as unknown as Record<string, unknown>).catalogCategoryId as string;
        if (prefixLookup.byId[catId]) return prefixLookup.byId[catId];
      }
      if (item.catalogCategory && prefixLookup.byName[item.catalogCategory]) {
        return prefixLookup.byName[item.catalogCategory];
      }
      return '';
    },
    [prefixLookup],
  );

  const formatCode = useCallback(
    (item: CatalogItem): string => {
      const prefix = getItemPrefix(item);
      if (!prefix) return item.catalogCode;
      if (item.catalogCode.startsWith(prefix)) return item.catalogCode;
      return `${prefix}-${item.catalogCode}`;
    },
    [getItemPrefix],
  );

  return { formatCode, getItemPrefix, prefixLookup };
}
