import { useState, useCallback } from 'react';
import type { SmsLog, SmsTemplate } from '../types/sms';
import { getAuthHeaders } from '../utils/auth';

const API = '/backend';

export function useSms() {
  const [smsHistory, setSmsHistory] = useState<SmsLog[]>([]);
  const [smsTotal, setSmsTotal] = useState(0);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHistory = useCallback(async (params?: {
    patientId?: string; status?: string; from?: string; to?: string; limit?: number; offset?: number;
  }) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (params?.patientId) qs.set('patientId', params.patientId);
      if (params?.status) qs.set('status', params.status);
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const res = await fetch(`${API}/sms/history?${qs}`, { headers: getAuthHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setSmsHistory(data.logs || []);
      setSmsTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch(`${API}/sms/templates`, { headers: getAuthHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    setTemplates(Array.isArray(data) ? data : []);
  }, []);

  const sendSms = useCallback(async (body: {
    to: string; message: string; patientId?: string; patientName?: string; context?: string; isHungarian?: boolean;
  }) => {
    const res = await fetch(`${API}/sms/send`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const sendTemplateSms = useCallback(async (body: {
    to: string; templateId: string; variables: Record<string, string>;
    patientId?: string; patientName?: string; context?: string; isHungarian?: boolean;
  }) => {
    const res = await fetch(`${API}/sms/send-template`, {
      method: 'POST',
      headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }, []);

  const checkEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/sms/enabled`, { headers: getAuthHeaders() });
      if (!res.ok) return false;
      const data = await res.json();
      return data.isEnabled || false;
    } catch {
      return false;
    }
  }, []);

  return { smsHistory, smsTotal, templates, loading, fetchHistory, fetchTemplates, sendSms, sendTemplateSms, checkEnabled };
}
