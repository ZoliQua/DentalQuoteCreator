import { useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { Patient, PatientFormData, DentalStatusSnapshot } from '../types';
import { createHealthyTeethRecord, getCurrentDateString } from '../utils';

function generatePatientId(existingPatients: Patient[]): string {
  const existing = new Set(existingPatients.map((p) => p.patientId));
  let id: string;
  do {
    id = String(10000000 + Math.floor(Math.random() * 90000000));
  } while (existing.has(id));
  return id;
}

export function usePatients() {
  const {
    patients,
    addPatient,
    updatePatient,
    deletePatient,
    getPatient,
    restorePatient: restorePatientFromContext,
    createDentalStatusSnapshot,
  } = useApp();

  const activePatients = useMemo(
    () => patients.filter((p) => !p.isArchived),
    [patients]
  );

  const archivedPatients = useMemo(
    () => patients.filter((p) => p.isArchived),
    [patients]
  );

  const createPatient = useCallback(
    (data: PatientFormData): Patient => {
      const now = getCurrentDateString();
      const patient: Patient = {
        ...data,
        patientId: generatePatientId(patients),
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      };
      addPatient(patient);
      const snapshot: DentalStatusSnapshot = {
        snapshotId: nanoid(),
        patientId: patient.patientId,
        takenAt: now,
        note: '',
        teeth: createHealthyTeethRecord(now),
      };
      createDentalStatusSnapshot(snapshot);
      return patient;
    },
    [patients, addPatient, createDentalStatusSnapshot]
  );

  const editPatient = useCallback(
    (patientId: string, data: Partial<PatientFormData>): Patient | undefined => {
      const existing = getPatient(patientId);
      if (!existing) return undefined;

      const updated: Patient = {
        ...existing,
        ...data,
        updatedAt: getCurrentDateString(),
      };
      updatePatient(updated);
      return updated;
    },
    [getPatient, updatePatient]
  );

  const archivePatient = useCallback(
    (patientId: string): void => {
      const existing = getPatient(patientId);
      if (existing) {
        updatePatient({
          ...existing,
          isArchived: true,
          updatedAt: getCurrentDateString(),
        });
      }
    },
    [getPatient, updatePatient]
  );

  const restorePatient = useCallback(
    (patientId: string): void => {
      restorePatientFromContext(patientId);
    },
    [restorePatientFromContext]
  );

  const duplicatePatient = useCallback(
    (patientId: string): Patient | undefined => {
      const existing = getPatient(patientId);
      if (!existing) return undefined;

      const now = getCurrentDateString();
      const duplicate: Patient = {
        ...existing,
        patientId: generatePatientId(patients),
        lastName: `${existing.lastName} (másolat)`,
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      };
      addPatient(duplicate);
      const snapshot: DentalStatusSnapshot = {
        snapshotId: nanoid(),
        patientId: duplicate.patientId,
        takenAt: now,
        note: '',
        teeth: createHealthyTeethRecord(now),
      };
      createDentalStatusSnapshot(snapshot);
      return duplicate;
    },
    [getPatient, addPatient, createDentalStatusSnapshot]
  );

  const searchPatients = useCallback(
    (query: string, includeArchived = false): Patient[] => {
      const searchLower = query.toLowerCase().trim();
      if (!searchLower) {
        return includeArchived ? patients : activePatients;
      }

      const source = includeArchived ? patients : activePatients;
      return source.filter(
        (p) =>
          p.lastName.toLowerCase().includes(searchLower) ||
          p.firstName.toLowerCase().includes(searchLower) ||
          `${p.lastName} ${p.firstName}`.toLowerCase().includes(searchLower) ||
          (p.insuranceNum && p.insuranceNum.includes(searchLower)) ||
          (p.phone && p.phone.includes(searchLower)) ||
          (p.email && p.email.toLowerCase().includes(searchLower))
      );
    },
    [patients, activePatients]
  );

  return {
    patients,
    activePatients,
    archivedPatients,
    getPatient,
    createPatient,
    editPatient,
    deletePatient,
    archivePatient,
    restorePatient,
    duplicatePatient,
    searchPatients,
  };
}
