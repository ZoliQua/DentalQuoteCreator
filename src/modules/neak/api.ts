import type { NeakCheckResult } from './types';
import { getAuthHeaders } from '../../utils/auth';

export const checkJogviszony = async (
  taj: string,
  date?: string,
): Promise<NeakCheckResult> => {
  const response = await fetch('/api/neak/jogviszony', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ taj, date }),
  });

  const rawText = await response.text();
  let data: unknown = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  const parsed = (data || {}) as NeakCheckResult;
  if (!response.ok) {
    throw new Error(parsed.message || `NEAK jogviszony check failed (HTTP ${response.status})`);
  }
  return parsed;
};

export const pingNeak = async (): Promise<{ ok: boolean; response: string }> => {
  const response = await fetch('/api/neak/ping', { headers: getAuthHeaders() });
  return response.json();
};
