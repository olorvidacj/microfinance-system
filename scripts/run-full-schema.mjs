// Runs database/supabase_full_schema.sql against Supabase Postgres.
// Usage: node scripts/run-full-schema.mjs
// Requires SUPABASE_DB_URL (or CLOUD_SQL_DATABASE_URL) in .env
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '..', 'supabase_schema.sql');

const connectionString =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.CLOUD_SQL_DATABASE_URL;

if (!connectionString) {
  console.error(
    'ERROR: No database URL found.\n' +
      'Add this line to your .env file (get it from Supabase Dashboard -> Connect -> Connection string):\n' +
      'SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:6543/postgres'
  );
  process.exit(1);
}

const sql = readFileSync(sqlPath, 'utf8');
const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log('Connected. Running full schema (this is idempotent)...');
  const t0 = Date.now();
  await client.query(sql); // simple-query protocol handles the whole multi-statement file incl. DO $$ blocks
  console.log(`DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s - schema applied.`);
} catch (err) {
  console.error('FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
