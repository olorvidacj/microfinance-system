import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createLocalDatabase } from './localDatabase';

let pg: PGlite;

beforeAll(async () => {
  pg = await createLocalDatabase();
}, 120_000);

afterAll(async () => {
  await pg?.close();
});

describe('local database built from the initDb baseline and the migration chain', () => {
  it('installs the 0023 guard and append-only triggers', async () => {
    const r = await pg.query<{ tgname: string }>(`SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_kyc%' ORDER BY 1`);
    expect(r.rows.map((x) => x.tgname)).toEqual([
      'trg_kyc_audit_log_append_only',
      'trg_kyc_audit_log_no_truncate',
      'trg_kyc_snapshots_append_only',
      'trg_kyc_snapshots_no_truncate',
      'trg_kyc_submissions_guard',
    ]);
  });

  it('leaves the KYC bucket private', async () => {
    const r = await pg.query<{ public: boolean }>(`SELECT public FROM storage.buckets WHERE id = 'kyc-documents'`);
    expect(r.rows).toEqual([{ public: false }]);
  });

  it('accepts only canonical KYC statuses on borrowers', async () => {
    await expect(
      pg.query(`INSERT INTO borrowers (id, borrower_number, full_name, id_number, phone, email, date_of_birth, gender,
        civil_status, address, branch_id, employment_status, employer_or_business, occupation, monthly_income,
        monthly_expenses, credit_score, credit_tier, kyc_status, member_status, membership_date, avatar, joined_date,
        last_activity_date) VALUES ('b1','N1','A B','','','','1990-01-01','Male','Single','','br','','','',0,0,0,'',
        'Verified','Active','2026-01-01','','2026-01-01','2026-01-01')`),
    ).rejects.toThrow(/borrowers_kyc_status_canonical/);
  });

  it('maps RESUBMISSION_REQUIRED to CORRECTION_REQUIRED like shared/kyc-core', async () => {
    const r = await pg.query<{ s: string }>(`SELECT kyc_normalize_status('resubmission required') AS s`);
    expect(r.rows[0].s).toBe('CORRECTION_REQUIRED');
  });
});
