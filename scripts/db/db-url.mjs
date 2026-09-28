/**
 * Reads the application connection string from the environment without loading
 * dotenv, and can retarget it at a different database. Used by the migration
 * verification harness so it never connects to the application database.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');

/** Minimal .env reader: KEY=VALUE, # comments, optional quotes. */
export function loadDotEnv(file = path.join(REPO_ROOT, '.env')) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function baseConnectionString() {
  const env = { ...loadDotEnv(), ...process.env };
  const url =
    env.SUPABASE_DATABASE_URL ||
    env.DATABASE_URL ||
    env.CLOUD_SQL_DATABASE_URL ||
    '';
  if (!url) throw new Error('No database connection string in .env or the environment.');
  return url;
}

/** Rebuilds the connection string against a named database. */
export function createConnectionString({ database } = {}) {
  const url = new URL(baseConnectionString());
  if (database) url.pathname = `/${database}`;
  return url.toString();
}
