import { useState, useCallback } from 'react';
import { getAuthHeaders } from '../utils/auth';
import type {
  GoogleCalendarSettings,
  GoogleCalendar,
  GoogleCalendarLogEntry,
} from '../types/googleCalendar';

const API = '/backend';

export function useGoogleCalendar() {
  const [settings, setSettings] = useState<GoogleCalendarSettings | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [log, setLog] = useState<GoogleCalendarLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${API}/google-calendar/settings`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        return data as GoogleCalendarSettings;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const updateSettings = useCallback(async (data: Partial<GoogleCalendarSettings>) => {
    try {
      const res = await fetch(`${API}/google-calendar/settings`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setSettings(prev => prev ? { ...prev, ...data } : prev);
        return updated;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const getAuthUrl = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API}/google-calendar/auth-url`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const res = await fetch(`${API}/google-calendar/disconnect`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setSettings(prev => prev ? { ...prev, isConnected: false, isEnabled: false } : prev);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }, []);

  const fetchCalendars = useCallback(async () => {
    try {
      const res = await fetch(`${API}/google-calendar/calendars`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCalendars(data.calendars || []);
        return data.calendars as GoogleCalendar[];
      }
    } catch { /* ignore */ }
    return [];
  }, []);

  const triggerSync = useCallback(async (direction: 'pull' | 'push' | 'both' = 'both') => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/google-calendar/sync`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      if (res.ok) {
        const data = await res.json();
        setLoading(false);
        return data;
      }
    } catch { /* ignore */ }
    setLoading(false);
    return null;
  }, []);

  const fetchLog = useCallback(async (page = 1, limit = 50) => {
    try {
      const res = await fetch(`${API}/google-calendar/log?page=${page}&limit=${limit}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLog(data.logs || []);
        return data;
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  return {
    settings,
    calendars,
    log,
    loading,
    fetchSettings,
    updateSettings,
    getAuthUrl,
    disconnect,
    fetchCalendars,
    triggerSync,
    fetchLog,
  };
}
