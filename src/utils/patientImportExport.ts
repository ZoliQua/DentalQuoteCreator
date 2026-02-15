import type { Patient, Quote } from '../types';

export interface PatientExportData {
  version: string;
  exportedAt: string;
  patients: Patient[];
  quotes: Quote[];
}

// ---------------------------------------------------------------------------
// CSV helpers (mirrors catalogImportExport.ts)
// ---------------------------------------------------------------------------

const ALL_CSV_HEADERS = [
  'patientId',
  'title',
  'lastName',
  'firstName',
  'sex',
  'birthDate',
  'birthPlace',
  'insuranceNum',
  'phone',
  'email',
  'country',
  'isForeignAddress',
  'zipCode',
  'city',
  'street',
  'patientType',
  'notes',
  'createdAt',
  'updatedAt',
  'isArchived',
] as const;

const REQUIRED_CSV_HEADERS: readonly string[] = [
  'lastName',
  'firstName',
  'sex',
  'birthDate',
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
  return values.map((v) => v.trim());
}

// ---------------------------------------------------------------------------
// JSON export
// ---------------------------------------------------------------------------

export function allPatientsToJson(patients: Patient[], quotes: Quote[]): string {
  const data: PatientExportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    patients,
    quotes,
  };
  return JSON.stringify(data, null, 2);
}

export function singlePatientToJson(patient: Patient, patientQuotes: Quote[]): string {
  const data: PatientExportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    patients: [patient],
    quotes: patientQuotes,
  };
  return JSON.stringify(data, null, 2);
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

export function patientsToCsv(patients: Patient[]): string {
  const header = ALL_CSV_HEADERS.join(',');
  const rows = patients.map((patient) =>
    ALL_CSV_HEADERS.map((key) => {
      const value = (patient as unknown as Record<string, unknown>)[key];
      return escapeCsvValue(value);
    }).join(','),
  );
  return [header, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// JSON parse + validation
// ---------------------------------------------------------------------------

export function parsePatientExportJson(data: string): PatientExportData | null {
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.patients)) return null;
    // quotes are optional (single-patient CSV re-import won't have them)
    if (parsed.quotes !== undefined && !Array.isArray(parsed.quotes)) return null;
    return {
      version: parsed.version ?? '1.0.0',
      exportedAt: parsed.exportedAt ?? new Date().toISOString(),
      patients: parsed.patients,
      quotes: parsed.quotes ?? [],
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// CSV parse
// ---------------------------------------------------------------------------

export function parsePatientsFromCsv(data: string): Partial<Patient>[] | null {
  const trimmed = data.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headerValues = parseCsvLine(lines[0]);
  const headerIndexMap = new Map<string, number>();
  headerValues.forEach((value, index) => headerIndexMap.set(value, index));

  const missingRequired = REQUIRED_CSV_HEADERS.filter((h) => !headerIndexMap.has(h));
  if (missingRequired.length > 0) return null;

  const rows: Partial<Patient>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const rawLine = lines[i];
    if (!rawLine.trim()) continue;

    const values = parseCsvLine(rawLine);
    const row: Record<string, unknown> = {};

    for (const key of ALL_CSV_HEADERS) {
      if (headerIndexMap.has(key)) {
        row[key] = values[headerIndexMap.get(key)!] ?? '';
      }
    }

    // Convert isForeignAddress string to boolean
    if (typeof row.isForeignAddress === 'string') {
      row.isForeignAddress = row.isForeignAddress === 'true';
    }

    // Convert isArchived string to boolean
    if (typeof row.isArchived === 'string') {
      row.isArchived = row.isArchived === 'true';
    }

    rows.push(row as Partial<Patient>);
  }

  return rows;
}
