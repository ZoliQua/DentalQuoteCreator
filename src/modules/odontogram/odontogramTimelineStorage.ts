import { nanoid } from 'nanoid';
import {
  getBudapestDateKey,
  listHistoryIndex,
  loadCurrent,
  saveCurrent,
  saveDailySnapshot,
} from './odontogramStorage';
import type { OdontogramState, OdontogramTimelineEntry, StoredOdontogramPayload } from './types';
import { requestJsonSync } from '../../utils/syncHttp';

const STORAGE_VERSION = 1;
const API_PREFIX = '/backend';

const wrapPayload = (state: OdontogramState): StoredOdontogramPayload => ({
  version: STORAGE_VERSION,
  updatedAt: new Date().toISOString(),
  state,
});

export const listTimelineEntries = (patientId: string): OdontogramTimelineEntry[] => {
  try {
    const entries = requestJsonSync<OdontogramTimelineEntry[]>(
      'GET',
      `${API_PREFIX}/odontogram/timeline/${patientId}`
    );
    return (Array.isArray(entries) ? entries : [])
      .filter((entry) => typeof entry?.snapshotId === 'string' && typeof entry?.updatedAt === 'string')
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
};

export const loadTimelineSnapshot = (
  patientId: string,
  snapshotId: string
): StoredOdontogramPayload | null => {
  let payload: StoredOdontogramPayload | null = null;
  try {
    payload = requestJsonSync<StoredOdontogramPayload | null>(
      'GET',
      `${API_PREFIX}/odontogram/timeline/${patientId}/${snapshotId}`
    );
  } catch {
    payload = null;
  }
  if (!payload || !payload.state) return null;
  return payload;
};

export const createTimelineSnapshot = (patientId: string, state: OdontogramState): OdontogramTimelineEntry => {
  const snapshotId = nanoid();
  const payload = wrapPayload(state);
  requestJsonSync('POST', `${API_PREFIX}/odontogram/timeline/${patientId}`, { ...payload, snapshotId });
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
  requestJsonSync('PUT', `${API_PREFIX}/odontogram/timeline/${patientId}/${snapshotId}`, payload);
  saveCurrent(patientId, state);
  saveDailySnapshot(patientId, state, getBudapestDateKey());
  return { snapshotId, updatedAt: payload.updatedAt };
};

export const deleteTimelineSnapshot = (patientId: string, snapshotId: string): boolean => {
  const snapshot = loadTimelineSnapshot(patientId, snapshotId);
  if (!snapshot) return false;
  requestJsonSync('DELETE', `${API_PREFIX}/odontogram/timeline/${patientId}/${snapshotId}`);
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
  if (legacyEntries.length > 0) return existing;

  const current = loadCurrent(patientId);
  if (current?.state) {
    createTimelineSnapshot(patientId, current.state);
    return listTimelineEntries(patientId);
  }

  return [];
};
