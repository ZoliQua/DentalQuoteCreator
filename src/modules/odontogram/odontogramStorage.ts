import type {
  OdontogramHistoryIndexEntry,
  OdontogramState,
  StoredOdontogramPayload,
} from './types';

const STORAGE_VERSION = 1;

const getCurrentKey = (patientId: string) => `odontogram:patient:${patientId}:current`;
const getDailyKey = (patientId: string, dateKey: string) =>
  `odontogram:patient:${patientId}:daily:${dateKey}`;
const getHistoryIndexKey = (patientId: string) => `odontogram:patient:${patientId}:historyIndex`;

const formatBudapestDateKey = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
};

const wrapPayload = (state: OdontogramState): StoredOdontogramPayload => ({
  version: STORAGE_VERSION,
  updatedAt: new Date().toISOString(),
  state,
});

const safeParse = (raw: string | null): StoredOdontogramPayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredOdontogramPayload;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.state || typeof parsed.state !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const safeParseHistoryIndex = (raw: string | null): OdontogramHistoryIndexEntry[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as OdontogramHistoryIndexEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry) =>
        typeof entry?.dateKey === 'string' &&
        typeof entry?.updatedAt === 'string' &&
        Boolean(entry.dateKey)
    );
  } catch {
    return [];
  }
};

const updateHistoryIndex = (patientId: string, dateKey: string, updatedAt: string) => {
  const history = safeParseHistoryIndex(localStorage.getItem(getHistoryIndexKey(patientId)));
  const next = history.filter((entry) => entry.dateKey !== dateKey);
  next.push({ dateKey, updatedAt });
  localStorage.setItem(getHistoryIndexKey(patientId), JSON.stringify(next));
};

export const getBudapestDateKey = (date: Date = new Date()) => formatBudapestDateKey(date);

export const loadCurrent = (patientId: string): StoredOdontogramPayload | null => {
  return safeParse(localStorage.getItem(getCurrentKey(patientId)));
};

export const saveCurrent = (patientId: string, state: OdontogramState): void => {
  const payload = wrapPayload(state);
  localStorage.setItem(getCurrentKey(patientId), JSON.stringify(payload));
};

export const saveDailySnapshot = (
  patientId: string,
  state: OdontogramState,
  dateKey: string
): void => {
  const payload = wrapPayload(state);
  localStorage.setItem(getDailyKey(patientId, dateKey), JSON.stringify(payload));
  updateHistoryIndex(patientId, dateKey, payload.updatedAt);
};

export const listHistoryIndex = (patientId: string): OdontogramHistoryIndexEntry[] => {
  return safeParseHistoryIndex(localStorage.getItem(getHistoryIndexKey(patientId)))
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const loadDailySnapshot = (
  patientId: string,
  dateKey: string
): StoredOdontogramPayload | null => {
  return safeParse(localStorage.getItem(getDailyKey(patientId, dateKey)));
};

export const restoreDailySnapshotAsCurrent = (
  patientId: string,
  dateKey: string
): StoredOdontogramPayload | null => {
  const snapshot = loadDailySnapshot(patientId, dateKey);
  if (!snapshot) return null;
  saveCurrent(patientId, snapshot.state);
  saveDailySnapshot(patientId, snapshot.state, dateKey);
  return snapshot;
};
