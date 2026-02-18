export function getCatalogDisplayName(
  item: { catalogName: string; catalogNameEn?: string; catalogNameDe?: string },
  lang: 'hu' | 'en' | 'de'
): string {
  switch (lang) {
    case 'en': return item.catalogNameEn || item.catalogName;
    case 'de': return item.catalogNameDe || item.catalogName;
    default: return item.catalogName;
  }
}

export function getCategoryDisplayName(
  category: { catalogCategoryHu: string; catalogCategoryEn: string; catalogCategoryDe: string },
  lang: 'hu' | 'en' | 'de'
): string {
  switch (lang) {
    case 'en': return category.catalogCategoryEn || category.catalogCategoryHu;
    case 'de': return category.catalogCategoryDe || category.catalogCategoryHu;
    default: return category.catalogCategoryHu;
  }
}

export function getPriceListDisplayName(
  priceList: { priceListNameHu: string; priceListNameEn: string; priceListNameDe: string },
  lang: 'hu' | 'en' | 'de'
): string {
  switch (lang) {
    case 'en': return priceList.priceListNameEn || priceList.priceListNameHu;
    case 'de': return priceList.priceListNameDe || priceList.priceListNameHu;
    default: return priceList.priceListNameHu;
  }
}
