/**
 * Applies database/migrations (in APPLY_ORDER.txt order) to the database the
 * server uses (DATABASE_URL / SUPABASE_DATABASE_URL, see src/db/index.ts).
 *
 *   npm run db:migrate -- --status                      list applied and pending files, change nothing
 *   npm run db:migrate                                  apply pending files (local databases)
 *   npm run db:migrate -- --yes                         required for a non-local host
 *   npm run db:migrate -- --baseline-through <file>     first run on a database built before
 *                                                       schema_migrations: record files up to <file>
 *                                                       as applied without running them
 *   npm run db:migrate -- --through <file>              stop after <file>
 *
 * A fresh environment is `npm run db:migrate` then `npm run db:seed`.
 */
import 'dotenv/config';
import { getPool } from '../../src/db/index';
import { appliedMigrations, migrationChain, runMigrations, type MigrationTarget } from '../../src/db/migrations';

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const statusOnly = process.argv.includes('--status');

const pool = getPool();
if (!pool) throw new Error('No database connection string (DATABASE_URL / SUPABASE_DATABASE_URL).');
const client = await pool.connect();
try {
  const params = (client as unknown as { connectionParameters?: { host?: string; database?: string } }).connectionParameters;
  const host = params?.host ?? 'unknown';
  console.log(`[db:migrate] target ${host}/${params?.database ?? ''}`);

  const target: MigrationTarget = {
    exec: async (sql) => {
      await client.query(sql);
    },
    query: async <T>(sql: string, params: unknown[] = []) => (await client.query(sql, params)).rows as T[],
  };
  const applied = await appliedMigrations(target);
  const chain = migrationChain();
  const pending = chain.filter((f) => !applied?.has(f));
  console.log(`[db:migrate] ${applied ? `${applied.size} applied` : 'no schema_migrations table yet'}; ${pending.length} pending${pending.length ? `: ${pending.join(', ')}` : ''}`);
  if (statusOnly || pending.length === 0) process.exit(0);

  const local = /^(localhost|127\.0\.0\.1|::1)$/.test(host);
  if (!local && !process.argv.includes('--yes')) {
    console.error(`[db:migrate] ${host} is not a local database. Back it up, then re-run with --yes to apply.`);
    process.exit(1);
  }
  const ran = await runMigrations(target, { through: arg('--through'), baselineThrough: arg('--baseline-through'), log: (l) => console.log(`[db:migrate] ${l}`) });
  console.log(`[db:migrate] done: ${ran.length} applied.`);
} finally {
  client.release();
  await pool.end();
}
