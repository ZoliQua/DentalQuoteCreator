import type {
  OdontogramHistoryIndexEntry,
  OdontogramState,
  StoredOdontogramPayload,
} from './types';
import { requestJsonSync } from '../../utils/syncHttp';

const STORAGE_VERSION = 1;
const API_PREFIX = '/backend';

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

export const getBudapestDateKey = (date: Date = new Date()) => formatBudapestDateKey(date);

export const loadCurrent = (patientId: string): StoredOdontogramPayload | null => {
  try {
    return requestJsonSync<StoredOdontogramPayload | null>(
      'GET',
      `${API_PREFIX}/odontogram/current/${patientId}`
    );
  } catch {
    return null;
  }
};

export const saveCurrent = (patientId: string, state: OdontogramState): void => {
  const payload = wrapPayload(state);
  requestJsonSync('PUT', `${API_PREFIX}/odontogram/current/${patientId}`, payload);
};

export const saveDailySnapshot = (
  patientId: string,
  state: OdontogramState,
  dateKey: string
): void => {
  const payload = wrapPayload(state);
  requestJsonSync('PUT', `${API_PREFIX}/odontogram/daily/${patientId}/${dateKey}`, payload);
};

export const listHistoryIndex = (patientId: string): OdontogramHistoryIndexEntry[] => {
  try {
    const entries = requestJsonSync<OdontogramHistoryIndexEntry[]>(
      'GET',
      `${API_PREFIX}/odontogram/history/${patientId}`
    );
    return (Array.isArray(entries) ? entries : [])
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
};

export const loadDailySnapshot = (
  patientId: string,
  dateKey: string
): StoredOdontogramPayload | null => {
  try {
    return requestJsonSync<StoredOdontogramPayload | null>(
      'GET',
      `${API_PREFIX}/odontogram/daily/${patientId}/${dateKey}`
    );
  } catch {
    return null;
  }
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
