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
