import { useState, useCallback } from 'react';
import { Appointment, AppointmentType } from '../types';
import type { AppointmentChair } from '../types/appointment';
import { getAuthHeaders } from '../utils/auth';

const API = '/backend';

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [chairs, setChairs] = useState<AppointmentChair[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAppointments = useCallback(async (start: string, end: string, chairIndex?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ start, end });
      if (chairIndex !== undefined) params.set('chairIndex', String(chairIndex));
      const res = await fetch(`${API}/appointments?${params}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setAppointments(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAppointmentsByPatient = useCallback(async (patientId: string) => {
    const res = await fetch(`${API}/appointments/by-patient/${patientId}`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    return res.json() as Promise<Appointment[]>;
  }, []);

  const fetchAppointmentTypes = useCallback(async () => {
    const res = await fetch(`${API}/appointment-types`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setAppointmentTypes(Array.isArray(data) ? data : []);
  }, []);

  const createAppointment = useCallback(async (appt: Partial<Appointment>): Promise<Appointment> => {
    const res = await fetch(`${API}/appointments`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(appt),
    });
    return res.json();
  }, []);

  const updateAppointment = useCallback(async (id: string, data: Partial<Appointment>): Promise<Appointment> => {
    const res = await fetch(`${API}/appointments/${id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }, []);

  const deleteAppointment = useCallback(async (id: string) => {
    await fetch(`${API}/appointments/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  }, []);

  const createAppointmentType = useCallback(async (type: Partial<AppointmentType>): Promise<AppointmentType> => {
    const res = await fetch(`${API}/appointment-types`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(type),
    });
    return res.json();
  }, []);

  const updateAppointmentType = useCallback(async (id: string, data: Partial<AppointmentType>): Promise<AppointmentType> => {
    const res = await fetch(`${API}/appointment-types/${id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }, []);

  const deleteAppointmentType = useCallback(async (id: string) => {
    await fetch(`${API}/appointment-types/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  }, []);

  const fetchChairs = useCallback(async () => {
    const res = await fetch(`${API}/appointment-chairs`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setChairs(Array.isArray(data) ? data : []);
  }, []);

  const createChair = useCallback(async (chair: Partial<AppointmentChair>): Promise<AppointmentChair> => {
    const res = await fetch(`${API}/appointment-chairs`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(chair),
    });
    return res.json();
  }, []);

  const updateChair = useCallback(async (id: string, data: Partial<AppointmentChair>): Promise<AppointmentChair> => {
    const res = await fetch(`${API}/appointment-chairs/${id}`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  }, []);

  const deleteChair = useCallback(async (id: string) => {
    await fetch(`${API}/appointment-chairs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  }, []);

  return {
    appointments,
    appointmentTypes,
    chairs,
    loading,
    fetchAppointments,
    fetchAppointmentsByPatient,
    fetchAppointmentTypes,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    createAppointmentType,
    updateAppointmentType,
    deleteAppointmentType,
    fetchChairs,
    createChair,
    updateChair,
    deleteChair,
  };
}
