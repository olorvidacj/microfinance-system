import fs from 'fs';
import path from 'path';

/**
 * Builds and upgrades a database from database/migrations, in the order listed
 * in database/migrations/APPLY_ORDER.txt. Each file runs once, in its own
 * transaction, and is recorded in schema_migrations. Used by
 * `npm run db:migrate` (any Postgres) and by the local PGlite database the
 * tests and end-to-end runs use, so both are built the same way.
 */
export const MIGRATIONS_DIR = path.resolve(process.cwd(), 'database/migrations');

/** The migrations a database is built from, in order. */
export function migrationChain(dir = MIGRATIONS_DIR): string[] {
  const text = fs.readFileSync(path.join(dir, 'APPLY_ORDER.txt'), 'utf8');
  const files = text
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean);
  for (const f of files) {
    if (!fs.existsSync(path.join(dir, f))) throw new Error(`APPLY_ORDER.txt lists ${f}, which is not in ${dir}`);
  }
  if (new Set(files).size !== files.length) throw new Error('APPLY_ORDER.txt lists a migration twice');
  return files;
}

/** The two operations the runner needs, so it works with node-postgres and PGlite alike. */
export interface MigrationTarget {
  exec(sql: string): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface MigrateOptions {
  /** Stop after this file (tests that load data in an older shape). */
  through?: string;
  /**
   * For a database that already has the schema but no record of it (one built
   * before schema_migrations existed): mark every file up to and including this
   * one as applied without running it. Required before such a database can be
   * migrated, so pending files are never guessed.
   */
  baselineThrough?: string;
  log?: (line: string) => void;
}

const TRACKING_SQL = 'CREATE TABLE IF NOT EXISTS schema_migrations (file text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())';

export async function appliedMigrations(t: MigrationTarget): Promise<Set<string> | null> {
  const [{ tracked }] = await t.query<{ tracked: boolean }>("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS tracked");
  if (!tracked) return null;
  return new Set((await t.query<{ file: string }>('SELECT file FROM schema_migrations')).map((r) => r.file));
}

/** Files of the chain not yet applied (all of them for an untracked database). */
export async function pendingMigrations(t: MigrationTarget, dir = MIGRATIONS_DIR): Promise<string[]> {
  const applied = await appliedMigrations(t);
  return migrationChain(dir).filter((f) => !applied?.has(f));
}

/** Applies the pending migrations in order; returns the files it ran. */
export async function runMigrations(t: MigrationTarget, options: MigrateOptions = {}, dir = MIGRATIONS_DIR): Promise<string[]> {
  const chain = migrationChain(dir);
  const log = options.log ?? (() => undefined);
  const index = (f: string, what: string) => {
    const i = chain.indexOf(f);
    if (i < 0) throw new Error(`${what} ${f} is not in APPLY_ORDER.txt`);
    return i;
  };
  const last = options.through ? index(options.through, '--through') : chain.length - 1;

  let applied = await appliedMigrations(t);
  if (!applied) {
    const [{ used }] = await t.query<{ used: boolean }>("SELECT to_regclass('public.users') IS NOT NULL OR to_regclass('public.borrowers') IS NOT NULL AS used");
    if (used && !options.baselineThrough) {
      throw new Error(
        'This database already has application tables but no schema_migrations record. ' +
          'Run once with --baseline-through <last migration it already has> so applied files are recorded, not re-run.',
      );
    }
    await t.exec(TRACKING_SQL);
    applied = new Set();
    if (options.baselineThrough) {
      for (const f of chain.slice(0, index(options.baselineThrough, '--baseline-through') + 1)) {
        await t.query('INSERT INTO schema_migrations (file) VALUES ($1) ON CONFLICT DO NOTHING', [f]);
        applied.add(f);
        log(`recorded ${f} as already applied`);
      }
    }
  }

  const ran: string[] = [];
  for (const file of chain.slice(0, last + 1)) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    // The record of the file goes in the same transaction as its statements:
    // before the file's own final COMMIT, or inside one the runner opens.
    const record = `INSERT INTO schema_migrations (file) VALUES ('${file.replace(/'/g, "''")}');`;
    const commits = [...sql.matchAll(/^\s*COMMIT\s*;/gim)];
    const script = commits.length
      ? `${sql.slice(0, commits[commits.length - 1].index)}${record}\n${sql.slice(commits[commits.length - 1].index)}`
      : `BEGIN;\n${sql}\n${record}\nCOMMIT;`;
    try {
      await t.exec(script);
    } catch (err) {
      // Leave no half-open transaction behind; the migration's own error is what is reported.
      await t.exec('ROLLBACK');
      throw new Error(`Migration ${file} failed and was rolled back: ${err instanceof Error ? err.message : String(err)}`);
    }
    ran.push(file);
    log(`applied ${file}`);
  }
  return ran;
}
