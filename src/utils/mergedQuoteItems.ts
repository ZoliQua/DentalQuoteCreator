import type { QuoteItem, DiscountType } from '../types/quote';
import { SURFACE_ABBREVIATIONS, type SurfaceName } from './svgLayerParser';

export interface MergedQuoteItem {
  catalogItemId: string;
  quoteName: string;
  quoteUnit: string;
  quoteUnitPriceGross: number;
  quoteUnitPriceCurrency: 'HUF' | 'EUR';
  totalQty: number;
  items: QuoteItem[];
  treatedAreaText: string;
  lineTotal: number;
  quoteLineDiscountType: DiscountType;
  quoteLineDiscountValue: number;
  treatmentSession: number;
}

function buildToothLabel(item: QuoteItem): string {
  const toothNum = item.toothNum || '';
  const surfaces = item.selectedSurfaces;
  if (surfaces && surfaces.length > 0) {
    const abbrevs = surfaces
      .map((s) => SURFACE_ABBREVIATIONS[s as SurfaceName] || s.charAt(0).toUpperCase())
      .join('');
    return `${toothNum}-${abbrevs}`;
  }
  return toothNum;
}

export function buildTreatedAreaText(items: QuoteItem[]): string {
  if (items.length === 0) return '';

  // Check if this is a full-mouth item (no toothNum, unit is 'alkalom')
  if (items[0].quoteUnit === 'alkalom') {
    return 'Teljes szájüreg';
  }

  // Check if arch item
  if (items[0].quoteUnit === 'állcsont') {
    const areas = items.map((item) => {
      if (item.treatedArea === 'upper') return 'Felső állcsont';
      if (item.treatedArea === 'lower') return 'Alsó állcsont';
      return item.treatedArea || '';
    });
    return [...new Set(areas)].join(', ');
  }

  // Check if quadrant item
  if (items[0].quoteUnit === 'kvadráns') {
    const areas = items.map((item) => item.treatedArea || '');
    return [...new Set(areas)].sort().join(', ');
  }

  // Tooth-based items — handle comma-separated toothNums (maxTeethPerArch items)
  const labels = items
    .filter((item) => item.toothNum)
    .flatMap((item) => {
      if (item.toothNum!.includes(',')) {
        return item.toothNum!.split(',').map(tn => buildToothLabel({ ...item, toothNum: tn.trim() }));
      }
      return [buildToothLabel(item)];
    })
    .sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });

  return labels.join(', ');
}

function buildMergedItems(items: QuoteItem[], session: number): MergedQuoteItem[] {
  const groups = new Map<string, QuoteItem[]>();

  for (const item of items) {
    const key = item.catalogItemId;
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  const merged: MergedQuoteItem[] = [];

  for (const [catalogItemId, groupItems] of groups) {
    const first = groupItems[0];
    const totalQty = groupItems.reduce((sum, it) => sum + it.quoteQty, 0);
    const lineTotal = groupItems.reduce(
      (sum, it) => sum + it.quoteUnitPriceGross * it.quoteQty,
      0
    );

    merged.push({
      catalogItemId,
      quoteName: first.quoteName,
      quoteUnit: first.quoteUnit,
      quoteUnitPriceGross: first.quoteUnitPriceGross,
      quoteUnitPriceCurrency: first.quoteUnitPriceCurrency,
      totalQty,
      items: groupItems,
      treatedAreaText: buildTreatedAreaText(groupItems),
      lineTotal,
      quoteLineDiscountType: first.quoteLineDiscountType,
      quoteLineDiscountValue: first.quoteLineDiscountValue,
      treatmentSession: session,
    });
  }

  return merged;
}

export function mergeQuoteItems(items: QuoteItem[]): MergedQuoteItem[] {
  return buildMergedItems(items, 1);
}

export function mergeQuoteItemsBySession(items: QuoteItem[]): Map<number, MergedQuoteItem[]> {
  const sessionGroups = new Map<number, QuoteItem[]>();

  for (const item of items) {
    const session = item.treatmentSession || 1;
    const existing = sessionGroups.get(session);
    if (existing) {
      existing.push(item);
    } else {
      sessionGroups.set(session, [item]);
    }
  }

  const result = new Map<number, MergedQuoteItem[]>();
  for (const [session, sessionItems] of sessionGroups) {
    result.set(session, buildMergedItems(sessionItems, session));
  }

  return result;
}
