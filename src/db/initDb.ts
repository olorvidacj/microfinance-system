import { getPool, markConnectionStringFailed } from './index';
import fs from 'fs';
import path from 'path';
import { MIGRATIONS_DIR, pendingMigrations, type MigrationTarget } from './migrations';

/**
 * The server no longer creates or alters tables. The schema comes from
 * database/migrations (npm run db:migrate); at start-up this only reports
 * whether the connected database is missing any of them, so a stale database
 * is named plainly instead of failing later inside a request.
 */
export async function verifyDbSchema(): Promise<{ ok: boolean; pending: string[] } | null> {
  const pool = getPool();
  if (!pool) return null;
  if (!fs.existsSync(path.join(MIGRATIONS_DIR, 'APPLY_ORDER.txt'))) {
    console.error(`[Database] ${MIGRATIONS_DIR} is not deployed with the server, so the schema cannot be checked. Ship database/migrations alongside dist/.`);
    return { ok: false, pending: [] };
  }
  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    markConnectionStringFailed();
    console.warn('[Database] Could not connect to the database:', err instanceof Error ? err.message : err);
    return null;
  }
  try {
    const c = client;
    const target: MigrationTarget = {
      exec: async (sql) => {
        await c.query(sql);
      },
      query: async <T>(sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as T[],
    };
    const pending = await pendingMigrations(target);
    if (pending.length) {
      console.error(
        `[Database] ${pending.length} migration(s) not applied: ${pending.join(', ')}. ` +
          'Run `npm run db:migrate` (an existing database without schema_migrations needs --baseline-through once).',
      );
    } else {
      console.log('[Database] Schema is up to date with database/migrations.');
    }
    return { ok: pending.length === 0, pending };
  } finally {
    client.release();
  }
}
