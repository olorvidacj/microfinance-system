import { authFetch } from '../../context/AuthContext';

export class BranchApiError extends Error {
  status: number;
  code?: string;
  /** Per-field messages the server sent with a validation or duplicate refusal. */
  fieldErrors: Record<string, string>;
  constructor(message: string, status: number = 0, code?: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'BranchApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export async function branchRequest(
  url: string,
  init?: RequestInit,
  parse?: (payload: any) => any
): Promise<any> {
  let res: Response;
  try {
    res = await authFetch(url, init);
  } catch (err: any) {
    throw new BranchApiError(err?.message || 'Network error. Please check your connection.', 0);
  }

  let payload: any = {};
  try {
    payload = await res.json();
  } catch {}

  if (!res.ok) {
    throw new BranchApiError(payload?.error || payload?.message || 'Request failed', res.status, payload?.code, payload?.errors || payload?.fields || {});
  }

  if (parse) return parse(payload);
  return payload;
}

