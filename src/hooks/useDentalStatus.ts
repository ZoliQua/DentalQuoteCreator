import { useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { DentalStatusSnapshot, FDITooth, ToothStatus } from '../types';
import { cloneTeethWithUpdatedAt, createHealthyTeethRecord, getCurrentDateString } from '../utils';

export function useDentalStatus(patientId?: string) {
  const {
    getDentalStatusSnapshots,
    getLatestDentalStatusSnapshot,
    createDentalStatusSnapshot,
    updateDentalStatusSnapshot,
  } = useApp();

  const snapshots = useMemo(() => {
    if (!patientId) return [];
    return getDentalStatusSnapshots(patientId);
  }, [getDentalStatusSnapshots, patientId]);

  const latestSnapshot = useMemo(() => {
    if (!patientId) return undefined;
    return getLatestDentalStatusSnapshot(patientId);
  }, [getLatestDentalStatusSnapshot, patientId]);

  const createSnapshot = useCallback(
    (
      options: { base?: DentalStatusSnapshot; note?: string; persist?: boolean } = {}
    ): DentalStatusSnapshot | undefined => {
      if (!patientId) return undefined;
      const now = getCurrentDateString();
      const teeth = options.base
        ? cloneTeethWithUpdatedAt(options.base.teeth, now)
        : createHealthyTeethRecord(now);

      const snapshot: DentalStatusSnapshot = {
        snapshotId: nanoid(),
        patientId,
        takenAt: now,
        note: options.note || '',
        teeth,
      };

      if (options.persist !== false) {
        createDentalStatusSnapshot(snapshot);
      }
      return snapshot;
    },
    [createDentalStatusSnapshot, patientId]
  );

  const saveSnapshot = useCallback(
    (snapshot: DentalStatusSnapshot): void => {
      createDentalStatusSnapshot(snapshot);
    },
    [createDentalStatusSnapshot]
  );

  const updateSnapshot = useCallback(
    (snapshot: DentalStatusSnapshot): void => {
      updateDentalStatusSnapshot(snapshot);
    },
    [updateDentalStatusSnapshot]
  );

  const updateTooth = useCallback(
    (snapshot: DentalStatusSnapshot, toothId: FDITooth, update: Partial<ToothStatus>): DentalStatusSnapshot => {
      const now = getCurrentDateString();
      return {
        ...snapshot,
        teeth: {
          ...snapshot.teeth,
          [toothId]: {
            ...snapshot.teeth[toothId],
            ...update,
            updatedAt: now,
          },
        },
      };
    },
    []
  );

  return {
    snapshots,
    latestSnapshot,
    createSnapshot,
    saveSnapshot,
    updateSnapshot,
    updateTooth,
  };
}
