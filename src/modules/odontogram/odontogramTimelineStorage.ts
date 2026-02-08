import { nanoid } from 'nanoid';
import {
  getBudapestDateKey,
  listHistoryIndex,
  loadCurrent,
  loadDailySnapshot,
  saveCurrent,
  saveDailySnapshot,
} from './odontogramStorage';
import type { OdontogramState, OdontogramTimelineEntry, StoredOdontogramPayload } from './types';

const STORAGE_VERSION = 1;

const getTimelineIndexKey = (patientId: string) => `odontogram:patient:${patientId}:timelineIndex`;
const getTimelineSnapshotKey = (patientId: string, snapshotId: string) =>
  `odontogram:patient:${patientId}:timeline:${snapshotId}`;

const wrapPayload = (state: OdontogramState): StoredOdontogramPayload => ({
  version: STORAGE_VERSION,
  updatedAt: new Date().toISOString(),
  state,
});

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const saveIndex = (patientId: string, entries: OdontogramTimelineEntry[]) => {
  localStorage.setItem(getTimelineIndexKey(patientId), JSON.stringify(entries));
};

export const listTimelineEntries = (patientId: string): OdontogramTimelineEntry[] => {
  const entries = safeParse<OdontogramTimelineEntry[]>(
    localStorage.getItem(getTimelineIndexKey(patientId)),
    []
  );
  return entries
    .filter((entry) => typeof entry?.snapshotId === 'string' && typeof entry?.updatedAt === 'string')
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
};

export const loadTimelineSnapshot = (
  patientId: string,
  snapshotId: string
): StoredOdontogramPayload | null => {
  const payload = safeParse<StoredOdontogramPayload | null>(
    localStorage.getItem(getTimelineSnapshotKey(patientId, snapshotId)),
    null
  );
  if (!payload || !payload.state) return null;
  return payload;
};

export const createTimelineSnapshot = (patientId: string, state: OdontogramState): OdontogramTimelineEntry => {
  const snapshotId = nanoid();
  const payload = wrapPayload(state);
  localStorage.setItem(getTimelineSnapshotKey(patientId, snapshotId), JSON.stringify(payload));
  const entries = listTimelineEntries(patientId);
  const nextEntries = [{ snapshotId, updatedAt: payload.updatedAt }, ...entries];
  saveIndex(patientId, nextEntries);
  saveCurrent(patientId, state);
  saveDailySnapshot(patientId, state, getBudapestDateKey());
  return { snapshotId, updatedAt: payload.updatedAt };
};

export const updateTimelineSnapshot = (
  patientId: string,
  snapshotId: string,
  state: OdontogramState
): OdontogramTimelineEntry | null => {
  const exists = loadTimelineSnapshot(patientId, snapshotId);
  if (!exists) return null;
  const payload = wrapPayload(state);
  localStorage.setItem(getTimelineSnapshotKey(patientId, snapshotId), JSON.stringify(payload));
  const entries = listTimelineEntries(patientId);
  const nextEntries = entries.map((entry) =>
    entry.snapshotId === snapshotId ? { ...entry, updatedAt: payload.updatedAt } : entry
  );
  saveIndex(patientId, nextEntries);
  saveCurrent(patientId, state);
  saveDailySnapshot(patientId, state, getBudapestDateKey());
  return { snapshotId, updatedAt: payload.updatedAt };
};

export const deleteTimelineSnapshot = (patientId: string, snapshotId: string): boolean => {
  const snapshot = loadTimelineSnapshot(patientId, snapshotId);
  if (!snapshot) return false;
  localStorage.removeItem(getTimelineSnapshotKey(patientId, snapshotId));
  const entries = listTimelineEntries(patientId);
  saveIndex(
    patientId,
    entries.filter((entry) => entry.snapshotId !== snapshotId)
  );
  return true;
};

export const applyTimelineSnapshotAsCurrent = (
  patientId: string,
  snapshotId: string
): StoredOdontogramPayload | null => {
  const snapshot = loadTimelineSnapshot(patientId, snapshotId);
  if (!snapshot) return null;
  saveCurrent(patientId, snapshot.state);
  return snapshot;
};

export const duplicateLatestSnapshot = (
  patientId: string,
  fallbackState: OdontogramState | null = null
): OdontogramTimelineEntry | null => {
  const latestEntry = listTimelineEntries(patientId)[0];
  const latestState = latestEntry ? loadTimelineSnapshot(patientId, latestEntry.snapshotId)?.state ?? null : null;
  const currentState = loadCurrent(patientId)?.state ?? null;
  const sourceState = latestState ?? currentState ?? fallbackState;
  if (!sourceState) return null;
  return createTimelineSnapshot(patientId, sourceState);
};

export const ensureTimelineInitialized = (patientId: string): OdontogramTimelineEntry[] => {
  const existing = listTimelineEntries(patientId);
  if (existing.length > 0) return existing;

  const legacyEntries = listHistoryIndex(patientId);
  if (legacyEntries.length > 0) {
    const nextEntries: OdontogramTimelineEntry[] = [];
    legacyEntries
      .slice()
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      .forEach((entry) => {
        const snapshot = loadDailySnapshot(patientId, entry.dateKey);
        if (!snapshot?.state) return;
        const snapshotId = nanoid();
        localStorage.setItem(
          getTimelineSnapshotKey(patientId, snapshotId),
          JSON.stringify({
            ...snapshot,
            updatedAt: entry.updatedAt || snapshot.updatedAt,
          })
        );
        nextEntries.push({ snapshotId, updatedAt: entry.updatedAt || snapshot.updatedAt });
      });
    saveIndex(patientId, nextEntries);
    return listTimelineEntries(patientId);
  }

  const current = loadCurrent(patientId);
  if (current?.state) {
    createTimelineSnapshot(patientId, current.state);
    return listTimelineEntries(patientId);
  }

  return [];
};
