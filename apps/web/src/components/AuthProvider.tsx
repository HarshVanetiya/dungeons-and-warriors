'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type User } from '@/lib/api';

interface AuthState {
  /** undefined while loading, null when logged out. */
  user: User | null | undefined;
  setUser: (user: User | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const res = await api<{ user: User }>('/auth/me');
    // a sleeping server isn't the same as being logged out
    if (res.ok || res.error !== 'serverUnavailable') setUser(res.ok ? res.data.user : null);
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }, []);

  useEffect(() => {
    let stopped = false;
    // keep retrying while the server wakes up
    void (async () => {
      while (!stopped) {
        const res = await api<{ user: User }>('/auth/me');
        if (stopped) return;
        if (res.ok || res.error !== 'serverUnavailable') {
          setUser(res.ok ? res.data.user : null);
          return;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
    })();
    return () => {
      stopped = true;
    };
  }, []);

  return <AuthContext.Provider value={{ user, setUser, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
