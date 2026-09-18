import { authFetch, getStoredToken } from '../../context/AuthContext';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number = 0, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Typed JSON request used by all portal services.
 * Returns the parsed payload on success and throws ApiError otherwise.
 */
export async function clientRequest(
  url: string,
  init?: RequestInit,
  parse?: (payload: any) => any
): Promise<any> {
  let res: Response;
  try {
    res = await authFetch(url, init);
  } catch (err: any) {
    throw new ApiError(err?.message || 'Network error. Please check your connection.', 0);
  }

  let payload: any = {};
  try {
    payload = await res.json();
  } catch {}

  if (!res.ok) {
    throw new ApiError(payload?.error || payload?.message || 'Request failed', res.status, payload?.code);
  }

  if (parse) return parse(payload);
  return payload;
}

/**
 * Public (non-authenticated) request used by client login / OTP / reset flows.
 */
export async function publicRequest(url: string, body?: unknown, method: 'POST' = 'POST'): Promise<any> {
  const token = getStoredToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(payload?.error || payload?.message || 'Request failed', res.status);
  return payload;
}