import { useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { PriceList } from '../types';

export function usePriceLists() {
  const { pricelists, addPriceList, updatePriceList, deletePriceList } = useApp();

  const activePriceLists = useMemo(
    () => pricelists.filter((pl) => pl.isActive && !pl.isDeleted),
    [pricelists]
  );

  const defaultPriceList = useMemo(
    () => activePriceLists.find((pl) => pl.isDefault),
    [activePriceLists]
  );

  const createPriceList = useCallback(
    (data: Omit<PriceList, 'priceListId'>): void => {
      addPriceList({ ...data, priceListId: '' } as PriceList);
    },
    [addPriceList]
  );

  const editPriceList = useCallback(
    (priceListId: string, data: Partial<PriceList>): void => {
      const existing = pricelists.find((pl) => pl.priceListId === priceListId);
      if (!existing) return;
      updatePriceList({ ...existing, ...data });
    },
    [pricelists, updatePriceList]
  );

  const setDefaultPriceList = useCallback(
    (priceListId: string): void => {
      for (const pl of pricelists) {
        if (pl.isDefault && pl.priceListId !== priceListId) {
          updatePriceList({ ...pl, isDefault: false });
        }
      }
      const target = pricelists.find((pl) => pl.priceListId === priceListId);
      if (target) {
        updatePriceList({ ...target, isDefault: true });
      }
    },
    [pricelists, updatePriceList]
  );

  const removePriceList = useCallback(
    (priceListId: string): void => {
      deletePriceList(priceListId);
    },
    [deletePriceList]
  );

  return {
    pricelists,
    activePriceLists,
    defaultPriceList,
    createPriceList,
    editPriceList,
    setDefaultPriceList,
    deletePriceList: removePriceList,
  };
}
