import type { PriceList, PriceListCategory, CatalogItem, CatalogUnit } from '../types';
import { parseCsvLine } from '../utils/catalogImportExport';
import PriceListCsv from './PriceList.csv?raw';
import PriceListCategoryCsv from './PriceListCategory.csv?raw';
import PriceListCatalogItemCsv from './PriceListCatalogItem.csv?raw';

function parseCsvRows(csv: string): Record<string, string>[] {
  const lines = csv.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

function toBool(val: string): boolean {
  return val.toUpperCase() === 'TRUE';
}

function parsePriceLists(csv: string): PriceList[] {
  return parseCsvRows(csv).map((r) => ({
    priceListId: r.priceListId,
    priceListNameHu: r.priceListNameHu,
    priceListNameEn: r.priceListNameEn,
    priceListNameDe: r.priceListNameDe,
    isActive: toBool(r.isActive),
    isDeleted: toBool(r.isDeleted),
    isDefault: toBool(r.isDefault),
    isNeak: toBool(r.isNeak),
    isUserLocked: toBool(r.isUserLocked),
    listOfUsers: r.listOfUsers ? JSON.parse(r.listOfUsers.replace(/'/g, '"')) : [],
  }));
}

function parseCategories(csv: string): PriceListCategory[] {
  return parseCsvRows(csv).map((r) => ({
    catalogCategoryId: r.catalogCategoryId,
    priceListId: r.priceListId,
    catalogCategoryPrefix: r.catalogCategoryPrefix,
    catalogCategoryHu: r.catalogCategoryHu,
    catalogCategoryEn: r.catalogCategoryEn,
    catalogCategoryDe: r.catalogCategoryDe,
    isActive: toBool(r.isActive),
    isDeleted: toBool(r.isDeleted),
  }));
}

function parseCatalogItems(csv: string, categoryToPriceList: Map<string, string>): CatalogItem[] {
  return parseCsvRows(csv).map((r) => ({
    catalogItemId: r.catalogItemId,
    catalogCode: r.catalogCode,
    catalogName: r.catalogNameHu || r.catalogName || '',
    catalogUnit: (r.catalogUnit || 'db') as CatalogUnit,
    catalogPrice: parseFloat(r.catalogPrice) || 0,
    catalogPriceCurrency: (r.catalogPriceCurrency || 'HUF') as 'HUF' | 'EUR',
    catalogVatRate: parseFloat(r.catalogVatRate) || 0,
    catalogTechnicalPrice: parseFloat(r.catalogTechnicalPrice) || 0,
    catalogCategoryId: r.catalogCategoryId,
    priceListId: r.priceListId || categoryToPriceList.get(r.catalogCategoryId),
    svgLayer: r.svgLayer || '',
    hasLayer: toBool(r.hasLayer),
    hasTechnicalPrice: toBool(r.hasTechnicalPrice),
    isFullMouth: toBool(r.isFullMouth),
    isArch: toBool(r.isArch),
    isQuadrant: toBool(r.isQuadrant),
    maxTeethPerArch: r.maxTeethPerArch ? parseInt(r.maxTeethPerArch, 10) : undefined,
    allowedTeeth: r.allowedTeeth ? r.allowedTeeth.split('|').map(Number) : undefined,
    milkToothOnly: toBool(r.milkToothOnly),
    catalogNameEn: r.catalogNameEn || '',
    catalogNameDe: r.catalogNameDe || '',
    isActive: toBool(r.isActive),
  }));
}

export const defaultPriceLists: PriceList[] = parsePriceLists(PriceListCsv);
export const defaultPriceListCategories: PriceListCategory[] = parseCategories(PriceListCategoryCsv);

const _categoryToPriceList = new Map(defaultPriceListCategories.map(c => [c.catalogCategoryId, c.priceListId]));
export const defaultCatalogItems: CatalogItem[] = parseCatalogItems(PriceListCatalogItemCsv, _categoryToPriceList);
