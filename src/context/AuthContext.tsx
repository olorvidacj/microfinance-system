import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { RegistrationInput } from '../../shared/kyc-core';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STAFF' | 'CLIENT';
  staffRole?: string | null;
  staffId?: string | null;
  borrowerId?: string | null;
  avatar?: string;
  branchId?: string | null;
}

/** Self-registration payload; validated by shared/kyc-core on both sides. */
export interface RegisterData extends RegistrationInput {
  branchId?: string;
  password?: string;
  confirmPassword?: string;
  emailVerificationToken?: string;
}

/** A refused registration, with the server's per-field messages when it sent them. */
export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

interface AuthContextType {
  user: AuthUser | null;
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
}

const TOKEN_KEY = 'HOSCOMCO_auth_token';
const REQUEST_TIMEOUT_MS = 8000;

function timedInit(init?: RequestInit): RequestInit {
  if (typeof AbortSignal.timeout !== 'function') return init || {};
  let signal: AbortSignal | null = null;
  if (init?.signal instanceof AbortSignal) {
    signal = init.signal;
  } else {
    signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return { ...(init || {}), signal };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredToken(token: string): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

export async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, timedInit(init ? { ...init, headers, signal: undefined } : { headers }));
}

async function parseJson(res: Response) {
  let payload: any = {};
  try {
    payload = await res.json();
  } catch {}
  return payload;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(true);

  // Restore session on load
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      const token = getStoredToken();
      if (!token) {
        setIsRestoring(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        const data = await parseJson(res);
        if (!cancelled && res.ok && data.user) {
          setUser(data.user);
          if (data.token) {
            try {
              localStorage.setItem(TOKEN_KEY, data.token);
            } catch {}
          }
        } else if (res.status === 401 || res.status === 403) {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {}
        }
      } catch {
        // Network error: keep session optimistically if token has valid payload shape
        try {
          const [bodyStr, sig] = token.split('.');
          if (!cancelled && bodyStr && sig) {
            const body = JSON.parse(atob(bodyStr.replace(/-/g, '+').replace(/_/g, '/')));
            if (body && (!body.exp || body.exp > Date.now())) {
              setUser({
                id: body.sub || body.id,
                email: body.email,
                fullName: body.fullName || body.email?.split('@')[0] || 'User',
                role: body.role || 'CLIENT',
                staffRole: body.staffRole || null,
                staffId: body.staffId || null,
                borrowerId: body.borrowerId || null,
                branchId: body.branchId || null,
              });
            }
          }
        } catch {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {}
        }
      }
      if (!cancelled) setIsRestoring(false);
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSession = (token: string, u: AuthUser) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
    setUser(u);
  };

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login failed');
    }
    persistSession(data.token, data.user);
    return data.user;
  }, []);

  const register = useCallback(async (reg: RegisterData): Promise<AuthUser> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reg),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new RegistrationError(data.error || 'Registration failed', data.errors || {}, data.code);
    }
    persistSession(data.token, data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    setUser(null);
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    const token = getStoredToken();
    if (!token) return null;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = await parseJson(res);
      if (res.ok && data.user) {
        if (data.token) {
          try {
            localStorage.setItem(TOKEN_KEY, data.token);
          } catch {}
        }
        setUser(data.user);
        return data.user;
      }
    } catch {}
    return null;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isRestoring, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
