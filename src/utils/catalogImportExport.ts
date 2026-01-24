import { CatalogItem } from '../types';

const CATALOG_CSV_HEADERS = [
  'catalogItemId',
  'catalogCode',
  'catalogName',
  'catalogUnit',
  'catalogPrice',
  'catalogPriceCurrency',
  'catalogVatRate',
  'catalogTechnicalPrice',
  'catalogCategory',
  'hasTechnicalPrice',
  'isFullMouth',
  'isArch',
  'isActive',
] as const;

type CatalogCsvHeader = (typeof CATALOG_CSV_HEADERS)[number];

const needsEscaping = /["\n,]/;

function escapeCsvValue(value: unknown): string {
  const stringValue = value === undefined || value === null ? '' : String(value);
  if (!needsEscaping.test(stringValue)) {
    return stringValue;
  }
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function catalogToCsv(items: CatalogItem[]): string {
  const header = CATALOG_CSV_HEADERS.join(',');
  const rows = items.map((item) =>
    CATALOG_CSV_HEADERS.map((key) => {
      const value = (item as unknown as Record<string, unknown>)[key];
      return escapeCsvValue(value);
    }).join(',')
  );

  return [header, ...rows].join('\n');
}

export function parseCatalogCsv(data: string): Partial<CatalogItem>[] | null {
  const trimmed = data.trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headerValues = parseCsvLine(lines[0]);
  const headerIndexMap = new Map<string, number>();
  headerValues.forEach((value, index) => headerIndexMap.set(value, index));

  const missingHeaders = CATALOG_CSV_HEADERS.filter((headerKey) => !headerIndexMap.has(headerKey));
  if (missingHeaders.length > 0) {
    return null;
  }

  const rows: Partial<CatalogItem>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine.trim()) {
      continue;
    }

    const values = parseCsvLine(rawLine);
    const row: Partial<CatalogItem> = {};

    CATALOG_CSV_HEADERS.forEach((headerKey) => {
      const value = values[headerIndexMap.get(headerKey)!] ?? '';
      (row as unknown as Record<CatalogCsvHeader, string>)[headerKey] = value;
    });

    rows.push(row);
  }

  return rows;
}
