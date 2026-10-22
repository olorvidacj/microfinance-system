import type { PgDatabase } from 'drizzle-orm/pg-core';
import type * as schema from '../db/schema';

/** Any Drizzle Postgres database or transaction over the application schema (node-postgres or PGlite). */
export type AppDb = PgDatabase<any, typeof schema>;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const UNIQUE_INDEX_MESSAGES: Readonly<Record<string, { field: string; message: string }>> = {
  uq_borrowers_email_normalized: { field: 'email', message: 'A member with this email address is already registered.' },
  uq_borrowers_phone_normalized: { field: 'phone', message: 'A member with this mobile number is already registered.' },
  uq_borrowers_id_number_normalized: { field: 'idNumber', message: 'A member with this government ID number is already registered.' },
  users_email_key: { field: 'email', message: 'An account with this email address already exists.' },
};

function pgError(err: unknown): { code?: string; message?: string; constraint?: string } | null {
  let e: any = err;
  // Drizzle wraps driver errors in `cause`.
  for (let i = 0; i < 3 && e; i++) {
    if (typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) return e;
    e = e.cause;
  }
  return null;
}

/**
 * Translates refusals raised by the database (the 0023 KYC guard, unique
 * indexes, check constraints) into HTTP errors. Anything else is rethrown.
 */
export function translateDbError(err: unknown): never {
  if (err instanceof HttpError) throw err;
  const pg = pgError(err);
  if (pg?.code === '23505') {
    const known = Object.entries(UNIQUE_INDEX_MESSAGES).find(([name]) => String(pg.constraint ?? pg.message ?? '').includes(name));
    if (known) throw new HttpError(409, known[1].message, 'DUPLICATE', { field: known[1].field });
    throw new HttpError(409, 'This record already exists.', 'DUPLICATE');
  }
  if (pg?.code === '23514') throw new HttpError(409, String(pg.message), 'RULE_VIOLATION');
  if (pg?.code === '42501') throw new HttpError(403, String(pg.message), 'NOT_ALLOWED');
  throw err;
}
