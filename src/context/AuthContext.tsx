import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { RegistrationInput } from '../../shared/kyc-core';
import { hasPermission } from '../auth/permissions';

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

/**
 * The three sites keep separate sessions. Each is stored under its own key and
 * read only by its own pages and API calls, so signing in on one site (in any
 * tab) never changes who is signed in on another, and logging out of one leaves
 * the others alone.
 *
 *   member  /portal/*  members only
 *   staff   /staff/*   staff only
 *   admin   /admin/*   staff with the all-branch permission (view_all_records)
 */
export type AuthScope = 'member' | 'staff' | 'admin';
export const AUTH_SCOPES: readonly AuthScope[] = ['member', 'staff', 'admin'];

const STORAGE_KEYS: Readonly<Record<AuthScope, string>> = {
  member: 'HOSCOMCO_session_member',
  staff: 'HOSCOMCO_session_staff',
  admin: 'HOSCOMCO_session_admin',
};
/** The single key every site used to share; migrated once, then removed. */
const LEGACY_TOKEN_KEY = 'HOSCOMCO_auth_token';

/** The site a path belongs to; null for the public pages (/, /login, /register). */
export function scopeForPath(pathname: string): AuthScope | null {
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return 'admin';
  if (pathname === '/staff' || pathname.startsWith('/staff/')) return 'staff';
  if (pathname === '/portal' || pathname.startsWith('/portal/')) return 'member';
  return null;
}

/** Whether an account may hold a session on a site. */
export function scopeAllows(scope: AuthScope, u: Pick<AuthUser, 'role' | 'staffRole'>): boolean {
  if (scope === 'member') return u.role === 'CLIENT';
  if (scope === 'staff') return u.role === 'STAFF';
  return u.role === 'STAFF' && hasPermission(u.staffRole, 'view_all_records');
}

const REFUSED: Readonly<Record<AuthScope, string>> = {
  member: 'This is a staff account. Staff sign in on the staff site.',
  staff: 'This is a member account. Members sign in on the member portal.',
  admin: 'This account cannot use the admin console. It needs all-branch access.',
};

const REQUEST_TIMEOUT_MS = 8000;

function timedInit(init?: RequestInit): RequestInit {
  if (typeof AbortSignal.timeout !== 'function') return init || {};
  const signal = init?.signal instanceof AbortSignal ? init.signal : AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  return { ...(init || {}), signal };
}

/**
 * Where each site keeps its session. The member portal and the staff app
 * remember it in the browser; the admin console only for the open tab, so
 * opening it in a new tab or after closing the browser asks for the password.
 */
type Store = 'local' | 'tab';
const SESSION_STORE: Readonly<Record<AuthScope, Store>> = { member: 'local', staff: 'local', admin: 'tab' };

/** Without activity for this long, the admin console signs out by itself. */
export const ADMIN_IDLE_MS = 15 * 60 * 1000;
const ADMIN_SEEN_KEY = 'HOSCOMCO_session_admin_seen';
const ADMIN_SIGNED_OUT_KEY = 'HOSCOMCO_admin_signed_out';

const storage = (store: Store): Storage => (store === 'tab' ? sessionStorage : localStorage);

function readKey(key: string, store: Store = 'local'): string {
  try {
    return storage(store).getItem(key) || '';
  } catch {
    return '';
  }
}

function writeKey(key: string, value: string, store: Store = 'local'): void {
  try {
    if (value) storage(store).setItem(key, value);
    else storage(store).removeItem(key);
  } catch {
    // Storage blocked (private mode): the session lasts until the page is closed.
  }
}

/** The token of one site's session. */
export function getStoredToken(scope: AuthScope): string {
  return readKey(STORAGE_KEYS[scope], SESSION_STORE[scope]);
}

export function setStoredToken(scope: AuthScope, token: string): void {
  writeKey(STORAGE_KEYS[scope], token, SESSION_STORE[scope]);
}

/** Why the admin console last signed out by itself, once (for its sign-in page). */
export function takeAdminSignOutReason(): 'idle' | null {
  const reason = readKey(ADMIN_SIGNED_OUT_KEY, 'tab');
  writeKey(ADMIN_SIGNED_OUT_KEY, '', 'tab');
  return reason === 'idle' ? 'idle' : null;
}

const adminSeen = () => Number(readKey(ADMIN_SEEN_KEY, 'tab')) || 0;
const markAdminSeen = () => writeKey(ADMIN_SEEN_KEY, String(Date.now()), 'tab');
const adminIdle = () => Date.now() - adminSeen() > ADMIN_IDLE_MS;

/** The site the current page belongs to (API calls use its session only). */
function currentScope(): AuthScope | null {
  return typeof window === 'undefined' ? null : scopeForPath(window.location.pathname);
}

/**
 * fetch with the current site's session. A public page sends no token, and a
 * page never sends another site's token.
 */
export async function authFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  const scope = currentScope();
  const token = scope ? getStoredToken(scope) : '';
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(input, timedInit(init ? { ...init, headers, signal: undefined } : { headers }));
}

async function parseJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Moves the old shared token into the site its account belongs to, once, and
 * drops an admin session remembered in the browser before the admin console
 * kept it per tab.
 */
function migrateLegacyToken(): void {
  writeKey(STORAGE_KEYS.admin, '', 'local');
  const legacy = readKey(LEGACY_TOKEN_KEY);
  if (!legacy) return;
  try {
    const body = JSON.parse(atob(legacy.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')));
    const scope: AuthScope = body?.role === 'CLIENT' ? 'member' : 'staff';
    if (!getStoredToken(scope)) setStoredToken(scope, legacy);
  } catch {
    // Not a token this app issued: drop it.
  }
  writeKey(LEGACY_TOKEN_KEY, '');
}

type Sessions = Record<AuthScope, AuthUser | null>;
const NO_SESSIONS: Sessions = { member: null, staff: null, admin: null };

interface AuthStore {
  sessions: Sessions;
  isRestoring: boolean;
  lastSignedIn: AuthScope | null;
  login: (scope: AuthScope | null, identifier: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  logout: (scope: AuthScope) => void;
  refresh: (scope: AuthScope) => Promise<AuthUser | null>;
  adopt: (scope: AuthScope, token: string, user: AuthUser) => void;
}

const AuthContext = createContext<AuthStore | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessions, setSessions] = useState<Sessions>(NO_SESSIONS);
  const [isRestoring, setIsRestoring] = useState(true);
  const [lastSignedIn, setLastSignedIn] = useState<AuthScope | null>(null);

  const put = useCallback((scope: AuthScope, user: AuthUser | null) => setSessions((s) => ({ ...s, [scope]: user })), []);

  /**
   * Asks the server who a site's token belongs to; keeps it only if that account may use the site.
   * `renew` stores the fresh token the server re-issues. A tab that is only following another
   * tab's sign-in must not renew: the write would fire `storage` in every other tab, and each
   * would renew in turn, without end.
   */
  const check = useCallback(async (scope: AuthScope, renew: boolean): Promise<AuthUser | null> => {
    const token = getStoredToken(scope);
    if (!token) return null;
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const data = await parseJson(res);
    if (res.ok && data.user && scopeAllows(scope, data.user)) {
      if (renew && data.token) setStoredToken(scope, data.token);
      return data.user as AuthUser;
    }
    if (renew && (res.ok || res.status === 401 || res.status === 403)) setStoredToken(scope, '');
    return null;
  }, []);

  // Restore each site's own session on load.
  useEffect(() => {
    let cancelled = false;
    migrateLegacyToken();
    if (getStoredToken('admin') && adminIdle()) {
      setStoredToken('admin', '');
      writeKey(ADMIN_SIGNED_OUT_KEY, 'idle', 'tab');
    }
    (async () => {
      const restored = { ...NO_SESSIONS };
      for (const scope of AUTH_SCOPES) {
        try {
          restored[scope] = await check(scope, true);
        } catch {
          // Server unreachable: the site shows its sign-in page; the stored token is kept for the next load.
          restored[scope] = null;
        }
      }
      if (!cancelled) {
        setSessions(restored);
        setIsRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [check]);

  // Another tab signed in or out of a site: follow it for that site only.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      const scope = AUTH_SCOPES.find((s) => STORAGE_KEYS[s] === e.key);
      if (!scope) return;
      if (!e.newValue) put(scope, null);
      else check(scope, false).then((u) => put(scope, u)).catch(() => undefined);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [check, put]);

  // The admin console signs out after ADMIN_IDLE_MS without activity in this tab.
  const adminSignedIn = Boolean(sessions.admin);
  useEffect(() => {
    if (!adminSignedIn) return;
    let last = 0;
    const seen = () => {
      if (Date.now() - last < 10_000) return;
      last = Date.now();
      markAdminSeen();
    };
    const checkIdle = () => {
      if (!adminIdle()) return;
      setStoredToken('admin', '');
      writeKey(ADMIN_SIGNED_OUT_KEY, 'idle', 'tab');
      put('admin', null);
    };
    const events = ['pointerdown', 'keydown', 'mousemove', 'scroll', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, seen, { passive: true });
    document.addEventListener('visibilitychange', checkIdle);
    const timer = setInterval(checkIdle, 20_000);
    return () => {
      for (const e of events) window.removeEventListener(e, seen);
      document.removeEventListener('visibilitychange', checkIdle);
      clearInterval(timer);
    };
  }, [adminSignedIn, put]);

  const adopt = useCallback(
    (scope: AuthScope, token: string, user: AuthUser) => {
      if (scope === 'admin') markAdminSeen();
      setStoredToken(scope, token);
      put(scope, user);
      setLastSignedIn(scope);
    },
    [put],
  );

  const login = useCallback(
    async (scope: AuthScope | null, identifier: string, password: string): Promise<AuthUser> => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = await parseJson(res);
      if (!res.ok || !data.success) throw new Error(data.error || 'Login failed');
      const user = data.user as AuthUser;
      // The general sign-in page (/login) sends each account to its own site.
      const target: AuthScope = scope ?? (user.role === 'CLIENT' ? 'member' : 'staff');
      if (!scopeAllows(target, user)) throw new Error(REFUSED[target]);
      adopt(target, data.token, user);
      return user;
    },
    [adopt],
  );

  const register = useCallback(
    async (reg: RegisterData): Promise<AuthUser> => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reg),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const data = await parseJson(res);
      if (!res.ok || !data.success) throw new RegistrationError(data.error || 'Registration failed', data.errors || {}, data.code);
      adopt('member', data.token, data.user);
      return data.user;
    },
    [adopt],
  );

  const logout = useCallback(
    (scope: AuthScope) => {
      setStoredToken(scope, '');
      put(scope, null);
    },
    [put],
  );

  const refresh = useCallback(
    async (scope: AuthScope): Promise<AuthUser | null> => {
      const user = await check(scope, true);
      put(scope, user);
      return user;
    },
    [check, put],
  );

  const value = useMemo<AuthStore>(
    () => ({ sessions, isRestoring, lastSignedIn, login, register, logout, refresh, adopt }),
    [sessions, isRestoring, lastSignedIn, login, register, logout, refresh, adopt],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

function useAuthStore(): AuthStore {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export interface SiteAuth {
  /** The site this page belongs to (null on the public pages). */
  scope: AuthScope | null;
  /** Who is signed in on this site; always null on a public page. */
  user: AuthUser | null;
  isRestoring: boolean;
  /** Every site's session, for the public pages ("go to my account"). */
  sessions: Sessions;
  /** The site most recently signed in to in this tab. */
  lastSignedIn: AuthScope | null;
  /** Signs in to this site (on /login: the site the account belongs to). */
  login: (identifier: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterData) => Promise<AuthUser>;
  /** Signs out of this site only. */
  logout: () => void;
  refreshUser: () => Promise<AuthUser | null>;
  /** Replaces this site's token after the server re-issued it (e.g. branch reassignment). */
  adoptToken: (token: string, user: AuthUser) => void;
}

/** The session of the site the current page belongs to. */
export function useAuth(): SiteAuth {
  const store = useAuthStore();
  const { pathname } = useLocation();
  const scope = scopeForPath(pathname);
  const { login, logout, refresh, adopt } = store;
  // Stable per site, so effects that depend on these do not re-run on every render.
  const actions = useMemo(
    () => ({
      login: (identifier: string, password: string) => login(scope, identifier, password),
      logout: () => {
        if (scope) logout(scope);
      },
      refreshUser: () => (scope ? refresh(scope) : Promise.resolve(null)),
      adoptToken: (token: string, user: AuthUser) => {
        if (scope) adopt(scope, token, user);
      },
    }),
    [scope, login, logout, refresh, adopt],
  );
  return {
    scope,
    user: scope ? store.sessions[scope] : null,
    isRestoring: store.isRestoring,
    sessions: store.sessions,
    lastSignedIn: store.lastSignedIn,
    register: store.register,
    ...actions,
  };
}
