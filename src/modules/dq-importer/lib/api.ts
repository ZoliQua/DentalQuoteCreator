import type { FetchPatientsResponse, ImportPatientResponse, PatientData, OdontogramState, ExportJsonData } from './types';

const SCRAPER_API = '/api/importer';

export async function fetchPatients(ids: string[]): Promise<FetchPatientsResponse> {
  const resp = await fetch(`${SCRAPER_API}/fetch-patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Hiba történt a lekéréskor.');
  return data;
}

export async function importPatient(
  patient: Omit<PatientData, '_rawFields' | 'flexiId'>,
  odontogram: OdontogramState | null,
): Promise<ImportPatientResponse> {
  const resp = await fetch(`${SCRAPER_API}/import-patient`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient, odontogram }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || 'Import hiba.');
  return data;
}

export async function getMode(): Promise<{ mode: string; dentalApiAvailable: boolean }> {
  const resp = await fetch(`${SCRAPER_API}/mode`);
  return resp.json();
}

export function exportToJson(
  patients: Array<{ patient: Omit<PatientData, '_rawFields' | 'flexiId'>; odontogram: OdontogramState | null }>,
): ExportJsonData {
  return {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    patients,
  };
}

export function downloadJson(data: ExportJsonData, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
