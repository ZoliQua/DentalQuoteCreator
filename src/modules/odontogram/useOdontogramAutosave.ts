import { useEffect, useRef } from 'react';
import { getBudapestDateKey, saveCurrent, saveDailySnapshot } from './odontogramStorage';
import type { OdontogramState } from './types';

type UseOdontogramAutosaveOptions = {
  patientId: string;
  state: OdontogramState | null;
  enabled?: boolean;
  debounceMs?: number;
};

export const useOdontogramAutosave = ({
  patientId,
  state,
  enabled = true,
  debounceMs = 500,
}: UseOdontogramAutosaveOptions) => {
  const timeoutRef = useRef<number | null>(null);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !state || !patientId) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedRef.current) return;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      lastSavedRef.current = serialized;
      saveCurrent(patientId, state);
      saveDailySnapshot(patientId, state, getBudapestDateKey());
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [debounceMs, enabled, patientId, state]);
};
