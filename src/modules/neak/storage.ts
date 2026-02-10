import type { NeakCheckLogEntry } from './types';

const STORAGE_KEY = 'neak_ojote_checks';

const safeParse = (raw: string | null): NeakCheckLogEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as NeakCheckLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const listChecks = (): NeakCheckLogEntry[] => {
  return safeParse(localStorage.getItem(STORAGE_KEY)).sort(
    (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
  );
};

export const saveCheck = (entry: NeakCheckLogEntry): void => {
  const current = listChecks();
  const next = [entry, ...current.filter((item) => item.id !== entry.id)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
};

export const getChecksByPatient = (patientId: string): NeakCheckLogEntry[] => {
  return listChecks().filter((entry) => entry.patientId === patientId);
};
