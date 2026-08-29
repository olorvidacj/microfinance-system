import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'STAFF' | 'CLIENT';
  staffRole?: string | null;
  staffId?: string | null;
  borrowerId?: string | null;
  avatar?: string;
}

interface RegisterData {
  fullName: string;
  email?: string;
  phone?: string;
  password?: string;
  borrowerNumber?: string;
  address?: string;
  occupation?: string;
  monthlyIncome?: number;
}

interface AuthContextType {
  user: AuthUser | null;
  isRestoring: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  logout: () => void;
}

const TOKEN_KEY = 'hoscomo_auth_token';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getStoredToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
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
        });
        const data = await parseJson(res);
        if (!cancelled && res.ok && data.user) {
          setUser(data.user);
        } else {
          try {
            localStorage.removeItem(TOKEN_KEY);
          } catch {}
        }
      } catch {
        // Network error: keep session optimistically only if token parses as valid shape
        try {
          const [, sig] = token.split('.');
          const body = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
          if (!cancelled && sig && body?.exp > Date.now()) {
            setUser({
              id: body.sub,
              email: body.email,
              fullName: body.email,
              role: body.role,
            });
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
    });
    const data = await parseJson(res);
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Registration failed');
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

  return (
    <AuthContext.Provider value={{ user, isRestoring, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
