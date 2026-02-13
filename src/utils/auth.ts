export const AUTH_STORAGE_KEY = 'dqc_auth_session_v1';

export type PermissionItem = {
  key: string;
  isAllowed: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'doctor' | 'assistant' | 'receptionist' | 'user' | 'beta_tester';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: AuthUser;
  permissions: PermissionItem[];
};

export const getAuthSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
};

export const setAuthSession = (session: AuthSession): void => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent('auth-changed'));
};

export const clearAuthSession = (): void => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('auth-changed'));
};

export const getAuthToken = (): string | null => {
  return getAuthSession()?.token || null;
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};
