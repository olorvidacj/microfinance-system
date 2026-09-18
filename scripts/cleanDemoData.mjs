// scripts/cleanDemoData.mjs
//
// Idempotent cleanup script — removes all fabricated demo/sample data from
// the HOSCOMCO database and resets monetary column defaults to zero.
//
// Safe to run repeatedly; only removes rows matching legacy demo id patterns.
// Never touches configuration (branches, staff, loan products, KYC).
//
// Usage:
//   node scripts/cleanDemoData.mjs
//
// Requires SUPABASE_DB_URL (or CLOUD_SQL_DATABASE_URL) in .env.
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '..', 'database', 'migrations', '0014_remove_demo_and_zero_defaults.sql');

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
  console.log('[cleanDemoData] Connected. Running demo data cleanup (idempotent)...');
  const t0 = Date.now();
  await client.query(sql);
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[cleanDemoData] DONE in ${elapsed}s — demo data removed, defaults zeroed.`);
} catch (err) {
  console.error('[cleanDemoData] FAILED:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}