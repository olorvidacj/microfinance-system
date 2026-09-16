import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { UserSession, Role } from '../types';
import { api } from '../services/api';
import { loadSession, saveSession, clearSession } from '../services/session';

interface AuthContextValue {
  session: UserSession | null;
  isReady: boolean;
  isBranchPersonnel: boolean;
  role: Role | null;
  signIn: (session: UserSession, remember?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  restore: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  const restore = useCallback(async () => {
    try {
      const stored = await loadSession();
      if (stored) {
        api.setToken(stored.token);
        setSession(stored);
      }
    } catch (err) {
      console.warn('[Auth] restore failed:', err);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    restore();
  }, [restore]);

  const signIn = useCallback(async (newSession: UserSession) => {
    api.setToken(newSession.token);
    await saveSession(newSession);
    setSession(newSession);
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    await clearSession();
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role: Role | null = session?.user?.role ?? null;
    return {
      session,
      isReady,
      isBranchPersonnel: role === 'STAFF' || role === 'BRANCH_PERSONNEL',
      role,
      signIn,
      signOut,
      restore,
    };
  }, [session, isReady, signIn, signOut, restore]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}