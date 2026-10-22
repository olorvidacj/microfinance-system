/**
 * A local Postgres for development and end-to-end checks, built from the same
 * schema chain the tests use (initDb baseline + migrations, see
 * src/db/testing/localDatabase.ts). Nothing here touches Supabase.
 *
 *   npm run db:local            # serves postgresql://postgres@127.0.0.1:54329/postgres
 *   LOCAL_DB_DIR=... LOCAL_DB_PORT=... npm run db:local
 *
 * Start the app against it with the PowerShell/bash env shown on startup.
 */
import path from 'path';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { createLocalDatabase } from '../src/db/testing/localDatabase';

const dir = path.resolve(process.env.LOCAL_DB_DIR || '.data/local-db');
const port = Number(process.env.LOCAL_DB_PORT) || 54329;

const db = await createLocalDatabase(dir);
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1' });
await server.start();

console.log(`[local-db] ${dir}`);
console.log(`[local-db] listening on postgresql://postgres@127.0.0.1:${port}/postgres`);
console.log('[local-db] run the app with: DATABASE_URL=<that url> DB_POOL_MAX=1 SUPABASE_URL= VITE_SUPABASE_URL= SUPABASE_SERVICE_ROLE_KEY= npm run dev');

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
