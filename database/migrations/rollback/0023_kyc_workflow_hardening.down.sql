-- ============================================================
-- ROLLBACK for 0023 - KYC WORKFLOW HARDENING
--
-- Kept outside database/migrations/ on purpose: the verification scripts and
-- `supabase db push` apply every .sql file at the top level of their
-- directories, and this must never run as part of a forward migration.
--
-- What this restores:
--   - Removes the status guard and append-only triggers and their functions.
--   - Disables row level security on the KYC tables.
--
-- What this deliberately does NOT restore:
--   - The added columns and kyc_submission_snapshots are kept. Dropping them
--     destroys data, and the previous application code ignores them. Optional
--     statements to drop them are at the end, commented out.
--   - The anon/authenticated grants and the public storage bucket/policy.
--     Re-opening KYC data to the public API key is a data exposure, not a
--     rollback. If you truly need the grants back, run the commented GRANT
--     statements after reading why they were removed in 0023.
-- ============================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_kyc_submissions_guard ON kyc_submissions;
DROP TRIGGER IF EXISTS trg_kyc_audit_log_append_only ON kyc_audit_log;
DROP TRIGGER IF EXISTS trg_kyc_audit_log_no_truncate ON kyc_audit_log;
DROP TRIGGER IF EXISTS trg_kyc_snapshots_append_only ON kyc_submission_snapshots;
DROP TRIGGER IF EXISTS trg_kyc_snapshots_no_truncate ON kyc_submission_snapshots;

DROP FUNCTION IF EXISTS kyc_submissions_guard();
DROP FUNCTION IF EXISTS kyc_append_only();
DROP FUNCTION IF EXISTS kyc_transition_allowed(text, text, text);
DROP FUNCTION IF EXISTS kyc_current_actor();
DROP FUNCTION IF EXISTS kyc_blank(text);
DROP FUNCTION IF EXISTS kyc_normalize_status(text);

ALTER TABLE kyc_submissions          DISABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents            DISABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_audit_log            DISABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_required_documents   DISABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submission_snapshots DISABLE ROW LEVEL SECURITY;

-- GRANT ALL ON TABLE kyc_submissions, kyc_documents, kyc_audit_log,
--   kyc_required_documents, kyc_submission_snapshots TO anon, authenticated;

-- Data-destroying; only if you are certain:
-- DROP TABLE IF EXISTS kyc_submission_snapshots;
-- ALTER TABLE kyc_submissions DROP COLUMN IF EXISTS reference_number, ...;

COMMIT;
