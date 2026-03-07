import { useState, useCallback } from 'react';
import type { PendingAppointment } from '../types/notification';
import { getAuthHeaders } from '../utils/auth';

const API = '/backend';

export function useNotifications() {
  const [pendingAppointments, setPendingAppointments] = useState<PendingAppointment[]>([]);
  const [pendingDate, setPendingDate] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchPending = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const qs = date ? `?date=${date}` : '';
      const res = await fetch(`${API}/notifications/pending${qs}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setPendingAppointments(data.appointments || []);
      setPendingDate(data.date || '');
    } finally {
      setLoading(false);
    }
  }, []);

  return { pendingAppointments, pendingDate, loading, fetchPending };
}
