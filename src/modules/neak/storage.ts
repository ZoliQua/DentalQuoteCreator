import type { NeakCheckLogEntry } from './types';
import { requestJsonSync } from '../../utils/syncHttp';

const API_PREFIX = '/backend';

export const listChecks = (): NeakCheckLogEntry[] => {
  try {
    const checks = requestJsonSync<NeakCheckLogEntry[]>('GET', `${API_PREFIX}/neak-checks`);
    return (Array.isArray(checks) ? checks : []).sort(
      (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime()
    );
  } catch {
    return [];
  }
};

export const saveCheck = (entry: NeakCheckLogEntry): void => {
  requestJsonSync('PUT', `${API_PREFIX}/neak-checks/${entry.id}`, entry);
};

export const getChecksByPatient = (patientId: string): NeakCheckLogEntry[] => {
  return listChecks().filter((entry) => entry.patientId === patientId);
};
