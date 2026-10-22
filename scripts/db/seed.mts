/**
 * Seeds a migrated database: the bootstrap administrator and the cooperative's
 * configuration (branches, staff, loan products, KYC requirements). Refuses to
 * run while migrations are pending.
 *
 *   npm run db:seed
 */
import 'dotenv/config';
import { getPool } from '../../src/db/index';
import { verifyDbSchema } from '../../src/db/initDb';
import { seedDatabase } from '../../src/db/seed';

const state = await verifyDbSchema();
if (!state) throw new Error('No database connection.');
if (!state.ok) {
  console.error('[db:seed] Apply the pending migrations first: npm run db:migrate');
  process.exit(1);
}
await seedDatabase();
console.log('[db:seed] done.');
await getPool()?.end();
