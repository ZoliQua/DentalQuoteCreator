import { useMemo, useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useApp } from '../context/AppContext';
import { Patient, PatientFormData } from '../types';
import { getCurrentDateString } from '../utils';

export function usePatients() {
  const { patients, addPatient, updatePatient, deletePatient, getPatient } = useApp();

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
        patientId: nanoid(),
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      };
      addPatient(patient);
      return patient;
    },
    [addPatient]
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
      const existing = getPatient(patientId);
      if (existing) {
        updatePatient({
          ...existing,
          isArchived: false,
          updatedAt: getCurrentDateString(),
        });
      }
    },
    [getPatient, updatePatient]
  );

  const duplicatePatient = useCallback(
    (patientId: string): Patient | undefined => {
      const existing = getPatient(patientId);
      if (!existing) return undefined;

      const now = getCurrentDateString();
      const duplicate: Patient = {
        ...existing,
        patientId: nanoid(),
        lastName: `${existing.lastName} (másolat)`,
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      };
      addPatient(duplicate);
      return duplicate;
    },
    [getPatient, addPatient]
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
