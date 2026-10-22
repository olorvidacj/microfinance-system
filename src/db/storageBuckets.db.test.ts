import fs from 'fs';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLocalDatabase } from './testing/localDatabase';
import { runMigrations, type MigrationTarget } from './migrations';

/** 0031: no storage bucket stays public, and policies opening 'documents' are dropped. */

const target = (pg: PGlite): MigrationTarget => ({
  exec: async (sql) => {
    await pg.exec(sql);
  },
  query: async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows,
});

const open: PGlite[] = [];
async function databaseBefore0031(): Promise<PGlite> {
  const pg = await createLocalDatabase(undefined, { through: '0030_online_payments.sql' });
  open.push(pg);
  return pg;
}

const policies = async (pg: PGlite) =>
  (await pg.query<{ policyname: string }>(`SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' ORDER BY policyname`)).rows.map(
    (r) => r.policyname,
  );
const isPublic = async (pg: PGlite, id: string) => (await pg.query<{ public: boolean }>('SELECT public FROM storage.buckets WHERE id = $1', [id])).rows[0]?.public;

afterEach(async () => {
  while (open.length) await open.pop()?.close();
});

describe('0031 private documents bucket', () => {
  it('makes the documents bucket private and drops only the policies that open it', async () => {
    const pg = await databaseBefore0031();
    await pg.exec(`
      INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO UPDATE SET public = true;
      CREATE POLICY "Anyone can read documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
      CREATE POLICY "Server reads kyc-documents" ON storage.objects FOR SELECT TO service_role USING (bucket_id = 'kyc-documents');
    `);

    expect(await runMigrations(target(pg))).toEqual(['0031_private_documents_bucket.sql']);
    expect(await isPublic(pg, 'documents')).toBe(false);
    expect(await isPublic(pg, 'kyc-documents')).toBe(false);
    const left = await policies(pg);
    expect(left).not.toContain('Anyone can read documents');
    // The kyc-documents policies (this one, and those from 0018) are kept.
    expect(left).toEqual(expect.arrayContaining(['Server reads kyc-documents', 'kyc_staff_select']));
    const mentioning = await pg.query(`SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '''documents'''`);
    expect(mentioning.rows).toHaveLength(0);
  }, 120_000);

  it('refuses to finish while another bucket is public', async () => {
    const pg = await databaseBefore0031();
    await pg.exec(`INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)`);
    await expect(runMigrations(target(pg))).rejects.toThrow(/still public: avatars/);
  }, 120_000);

  it('rolls back to a public documents bucket', async () => {
    const pg = await databaseBefore0031();
    await pg.exec(`INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO UPDATE SET public = true`);
    await runMigrations(target(pg));
    await pg.exec(fs.readFileSync(path.resolve('database/migrations/rollback/0031_private_documents_bucket.down.sql'), 'utf8'));
    expect(await isPublic(pg, 'documents')).toBe(true);
  }, 120_000);
});
