export type CatalogUnit = 'alkalom' | 'db' | 'állcsont' | 'kvadráns' | 'fog';

export const CATALOG_UNITS: CatalogUnit[] = ['alkalom', 'db', 'állcsont', 'kvadráns', 'fog'];

export interface CatalogItem {
  catalogItemId: string;
  catalogCode: string;
  catalogName: string;
  catalogNameHu?: string;
  catalogUnit: CatalogUnit;
  catalogPrice: number;
  catalogPriceCurrency: 'HUF' | 'EUR';
  catalogVatRate: number;
  catalogTechnicalPrice: number;
  catalogCategoryId: string;
  priceListId?: string;
  svgLayer: string;
  hasLayer: boolean;
  hasTechnicalPrice: boolean;
  isFullMouth: boolean;
  isArch: boolean;
  isQuadrant?: boolean;
  maxTeethPerArch?: number;
  allowedTeeth?: number[];
  milkToothOnly?: boolean;
  catalogNameEn?: string;
  catalogNameDe?: string;
  isActive: boolean;
  isDeleted?: boolean;
}

export type CatalogItemFormData = Omit<CatalogItem, 'catalogItemId'>;

// PriceList types
export interface PriceList {
  priceListId: string;
  priceListNameHu: string;
  priceListNameEn: string;
  priceListNameDe: string;
  isActive: boolean;
  isDeleted: boolean;
  isDefault: boolean;
  isUserLocked: boolean;
  listOfUsers: string[];
}

export interface PriceListCategory {
  catalogCategoryId: string;
  priceListId: string;
  catalogCategoryPrefix: string;
  catalogCategoryHu: string;
  catalogCategoryEn: string;
  catalogCategoryDe: string;
  isActive: boolean;
  isDeleted: boolean;
}
