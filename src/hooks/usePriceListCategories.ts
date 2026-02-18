import { useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { PriceListCategory } from '../types';
import { getCategoryDisplayName } from '../utils/catalogLocale';

export function usePriceListCategories(priceListId?: string) {
  const { pricelistCategories, addPriceListCategory, updatePriceListCategory, deletePriceListCategory } = useApp();

  const categories = useMemo(() => {
    const active = pricelistCategories.filter((c) => c.isActive && !c.isDeleted);
    if (priceListId) {
      return active.filter((c) => c.priceListId === priceListId);
    }
    return active;
  }, [pricelistCategories, priceListId]);

  const createCategory = useCallback(
    (data: Omit<PriceListCategory, 'catalogCategoryId'>): void => {
      addPriceListCategory({ ...data, catalogCategoryId: '' } as PriceListCategory);
    },
    [addPriceListCategory]
  );

  const editCategory = useCallback(
    (catalogCategoryId: string, data: Partial<PriceListCategory>): void => {
      const existing = pricelistCategories.find((c) => c.catalogCategoryId === catalogCategoryId);
      if (!existing) return;
      updatePriceListCategory({ ...existing, ...data });
    },
    [pricelistCategories, updatePriceListCategory]
  );

  const removeCategory = useCallback(
    (catalogCategoryId: string): void => {
      deletePriceListCategory(catalogCategoryId);
    },
    [deletePriceListCategory]
  );

  const getCategoryName = useCallback(
    (categoryHuName: string, lang: 'hu' | 'en' | 'de'): string => {
      const found = pricelistCategories.find((c) => c.catalogCategoryHu === categoryHuName);
      if (!found) return categoryHuName;
      return getCategoryDisplayName(found, lang);
    },
    [pricelistCategories]
  );

  return {
    categories,
    allCategories: pricelistCategories,
    createCategory,
    editCategory,
    deleteCategory: removeCategory,
    getCategoryName,
  };
}
