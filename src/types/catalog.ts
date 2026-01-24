export type CatalogCategory =
  | 'Diagnosztika'
  | 'Parodontológia'
  | 'Konzerváló'
  | 'Endodoncia'
  | 'Szájsebészet'
  | 'Implantáció'
  | 'Protetika'
  | 'Gyerefogászat'
  | 'Fogszabályozás';

export const CATALOG_CATEGORIES: CatalogCategory[] = [
  'Diagnosztika',
  'Parodontológia',
  'Konzerváló',
  'Endodoncia',
  'Szájsebészet',
  'Implantáció',
  'Protetika',
  'Gyerefogászat',
  'Fogszabályozás',
];

export type CatalogUnit = 'alkalom' | 'db' | 'állcsont' | 'kvadráns' | 'fog';

export const CATALOG_UNITS: CatalogUnit[] = ['alkalom', 'db', 'állcsont', 'kvadráns', 'fog'];

export interface CatalogItem {
  catalogItemId: string;
  catalogCode: string;
  catalogName: string;
  catalogUnit: CatalogUnit;
  catalogPrice: number;
  catalogPriceCurrency: 'HUF' | 'EUR';
  catalogVatRate: number;
  catalogTechnicalPrice: number;
  catalogCategory: CatalogCategory;
  hasTechnicalPrice: boolean;
  isFullMouth: boolean;
  isArch: boolean;
  isActive: boolean;
}

export type CatalogItemFormData = Omit<CatalogItem, 'catalogItemId'>;
