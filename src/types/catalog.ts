export type CatalogCategory =
  | 'Diagnosztika'
  | 'Konzerváló'
  | 'Endodontia'
  | 'Sebészet'
  | 'Protetika'
  | 'Esztétika'
  | 'Fogszabályozás'
  | 'Parodontológia'
  | 'Egyéb';

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  'Diagnosztika',
  'Konzerváló',
  'Endodontia',
  'Sebészet',
  'Protetika',
  'Esztétika',
  'Fogszabályozás',
  'Parodontológia',
  'Egyéb',
];

export interface CatalogItem {
  catalogItemId: string;
  catalogCode: string;
  catalogName: string;
  catalogUnit: string;
  catalogPrice: number;
  catalogPriceCurrency: 'HUF' | 'EUR';
  catalogVatRate: number;
  catalogCategory: CatalogCategory;
  isActive: boolean;
}

export type CatalogItemFormData = Omit<CatalogItem, 'catalogItemId'>;
