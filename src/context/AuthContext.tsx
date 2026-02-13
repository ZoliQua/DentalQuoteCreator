import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearAuthSession,
  getAuthHeaders,
  getAuthSession,
  setAuthSession,
  type AuthSession,
  type AuthUser,
  type PermissionItem,
} from '../utils/auth';

type LoginResponse = {
  token: string;
  expiresAt: string;
  user: AuthUser;
  permissions: PermissionItem[];
};

type MeResponse = {
  user: AuthUser;
  permissions: PermissionItem[];
};

type AuthContextType = {
  user: AuthUser | null;
  permissions: PermissionItem[];
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  hasPermission: (key: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const parseError = async (response: Response, fallback: string) => {
  const text = await response.text();
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { message?: string };
    return parsed.message || fallback;
  } catch {
    return fallback;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => getAuthSession());

  const refreshMe = useCallback(async () => {
    const current = getAuthSession();
    if (!current?.token) {
      setSession(null);
      return;
    }
    const response = await fetch('/backend/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });
    if (response.status === 401) {
      clearAuthSession();
      setSession(null);
      return;
    }
    if (!response.ok) {
      throw new Error(await parseError(response, `Auth refresh failed (HTTP ${response.status})`));
    }
    const data = (await response.json()) as MeResponse;
    const next: AuthSession = {
      ...current,
      user: data.user,
      permissions: data.permissions,
    };
    setAuthSession(next);
    setSession(next);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/backend/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      throw new Error(await parseError(response, 'Sikertelen bejelentkezés'));
    }
    const data = (await response.json()) as LoginResponse;
    const next: AuthSession = {
      token: data.token,
      expiresAt: data.expiresAt,
      user: data.user,
      permissions: data.permissions,
    };
    setAuthSession(next);
    setSession(next);
  }, []);

  const logout = useCallback(async () => {
    const token = getAuthSession()?.token;
    if (token) {
      await fetch('/backend/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      }).catch(() => undefined);
    }
    clearAuthSession();
    setSession(null);
  }, []);

  useEffect(() => {
    const onAuthChanged = () => setSession(getAuthSession());
    window.addEventListener('auth-changed', onAuthChanged);
    return () => window.removeEventListener('auth-changed', onAuthChanged);
  }, []);

  useEffect(() => {
    const current = getAuthSession();
    if (!current?.token) return;
    refreshMe().catch(() => undefined);
  }, [refreshMe]);

  const value = useMemo<AuthContextType>(() => {
    const hasPermission = (key: string) => {
      return session?.permissions.some((item) => item.key === key && item.isAllowed) || false;
    };
    return {
      user: session?.user || null,
      permissions: session?.permissions || [],
      token: session?.token || null,
      isAuthenticated: Boolean(session?.token),
      login,
      logout,
      refreshMe,
      hasPermission,
    };
  }, [login, logout, refreshMe, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
