import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../schema';
import { runMigrations, type MigrationTarget } from '../migrations';

/** Stand-ins for objects Supabase provides, so Supabase-aware migrations run on plain Postgres. */
const SUPABASE_STUBS_SQL = `
  DO $$ BEGIN
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, phone text,
    raw_user_meta_data jsonb, raw_app_meta_data jsonb, created_at timestamptz DEFAULT now());
  CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
  CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
  CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'anon'::text $$;
  CREATE SCHEMA IF NOT EXISTS storage;
  CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false,
    file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(), owner uuid);
  CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text,
    name text, owner uuid, metadata jsonb, created_at timestamptz DEFAULT now());
  CREATE OR REPLACE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE
    AS $$ SELECT string_to_array(name, '/') $$;
`;

/** PGlite as a migration target. */
function pgliteTarget(pg: PGlite): MigrationTarget {
  return {
    exec: async (sql) => {
      await pg.exec(sql);
    },
    query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
  };
}

/**
 * Builds (or reopens and brings up to date) a PGlite database from
 * database/migrations (APPLY_ORDER.txt), exactly like `npm run db:migrate`
 * builds a real one. `through` stops after that migration, for tests that
 * load data in the shape an older schema had.
 */
export async function createLocalDatabase(dataDir?: string, options: { through?: string } = {}): Promise<PGlite> {
  const pg = new PGlite({ dataDir, extensions: { pgcrypto, pg_trgm } });
  const [state] = (
    await pg.query<{ fresh: boolean; legacyTracking: boolean }>(
      `SELECT to_regclass('public.users') IS NULL AS fresh,
              to_regclass('public.local_schema_migrations') IS NOT NULL AS legacyTracking`,
    )
  ).rows;
  if (state.fresh) await pg.exec(SUPABASE_STUBS_SQL);
  if (state.legacyTracking) {
    // A data folder from before schema_migrations: it was built from the same
    // baseline, and local_schema_migrations lists the files applied on top.
    await pg.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (file text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
      INSERT INTO schema_migrations (file) SELECT file FROM local_schema_migrations ON CONFLICT DO NOTHING;
      INSERT INTO schema_migrations (file) VALUES ('0000_application_baseline.sql') ON CONFLICT DO NOTHING;
      DROP TABLE local_schema_migrations;`);
  }
  await runMigrations(pgliteTarget(pg), { through: options.through });
  return pg;
}

export function localDrizzle(pg: PGlite) {
  return drizzle(pg, { schema });
}
