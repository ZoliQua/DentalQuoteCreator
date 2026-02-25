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
    for (const cat of allCategories) {
      byId[cat.catalogCategoryId] = cat.catalogCategoryPrefix;
    }
    return { byId };
  }, [allCategories]);

  const getItemPrefix = useCallback(
    (item: CatalogItem): string => {
      if (item.catalogCategoryId && prefixLookup.byId[item.catalogCategoryId]) {
        return prefixLookup.byId[item.catalogCategoryId];
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
