import { CatalogItem } from '../types';

// All columns in the CSV export. Order matters for the output file.
const ALL_CSV_HEADERS = [
  'catalogItemId',
  'catalogCode',
  'catalogName',
  'catalogUnit',
  'catalogPrice',
  'catalogPriceCurrency',
  'catalogVatRate',
  'catalogTechnicalPrice',
  'catalogCategory',
  'svgLayer',
  'hasLayer',
  'hasTechnicalPrice',
  'isFullMouth',
  'isArch',
  'isQuadrant',
  'maxTeethPerArch',
  'allowedTeeth',
  'milkToothOnly',
  'catalogNameEn',
  'catalogNameDe',
  'isActive',
] as const;

// Minimum required headers for a valid import (everything else gets defaults)
const REQUIRED_CSV_HEADERS: readonly string[] = [
  'catalogCode',
  'catalogName',
  'catalogUnit',
  'catalogCategory',
];

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
  const header = ALL_CSV_HEADERS.join(',');
  const rows = items.map((item) =>
    ALL_CSV_HEADERS.map((key) => {
      // allowedTeeth is a number[] → serialize as pipe-separated string
      if (key === 'allowedTeeth') {
        const arr = item.allowedTeeth;
        return arr && arr.length > 0 ? escapeCsvValue(arr.join('|')) : '';
      }
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

  // Only require essential headers — new fields are optional for backward compat
  const missingRequired = REQUIRED_CSV_HEADERS.filter((h) => !headerIndexMap.has(h));
  if (missingRequired.length > 0) {
    return null;
  }

  const rows: Partial<CatalogItem>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine.trim()) {
      continue;
    }

    const values = parseCsvLine(rawLine);
    const row: Record<string, unknown> = {};

    // Read all known headers that are present in the CSV
    for (const key of ALL_CSV_HEADERS) {
      if (headerIndexMap.has(key)) {
        row[key] = values[headerIndexMap.get(key)!] ?? '';
      }
    }

    // Parse allowedTeeth from pipe-separated string to number array
    if (typeof row.allowedTeeth === 'string' && row.allowedTeeth.trim()) {
      row.allowedTeeth = row.allowedTeeth.split('|').map(Number).filter((n: number) => Number.isFinite(n));
    } else {
      delete row.allowedTeeth;
    }

    rows.push(row as Partial<CatalogItem>);
  }

  return rows;
}
