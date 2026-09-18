import { authFetch } from '../../context/AuthContext';

export class BranchApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number = 0, code?: string) {
    super(message);
    this.name = 'BranchApiError';
    this.status = status;
    this.code = code;
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
    throw new BranchApiError(payload?.error || payload?.message || 'Request failed', res.status, payload?.code);
  }

  if (parse) return parse(payload);
  return payload;
}

