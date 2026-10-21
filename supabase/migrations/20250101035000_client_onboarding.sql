-- ============================================================
-- 0024 - CLIENT ONBOARDING
--
-- Requires: 0012, 0013, 0023. Idempotent; safe to re-run.
-- Rollback: database/migrations/rollback/0024_client_onboarding.down.sql
--
-- Builds on the tables the application uses (borrowers, users,
-- kyc_submissions, branch_notifications). Like 0023, it does not depend on
-- 0019-0022.
--
--   1. Adds RESUBMISSION_REQUIRED as an accepted spelling of
--      CORRECTION_REQUIRED (mirrors shared/kyc-core/status.ts) and rewrites
--      every stored KYC status to its canonical form. borrowers.kyc_status is
--      then constrained to the eight canonical values.
--   2. Stores the member's address as PSGC codes (region, province,
--      city/municipality, barangay) plus ZIP code, next to the names 0012 added.
--   3. Prevents duplicate members: one member per email, per mobile number
--      (last 10 digits) and per government ID number, enforced by unique
--      indexes on the normalised values the application compares.
--   4. One KYC application row per member (resubmissions reuse the row; every
--      submitted version is kept in kyc_submission_snapshots).
--   5. email_verifications: one-time codes for registration, stored hashed.
--   6. Notifications addressed to a member (audience = 'CLIENT' with
--      borrower_id) instead of overloading related_id, and a backfill of the
--      loan notifications that were written for members.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Canonical KYC statuses
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION kyc_normalize_status(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v = '' THEN 'NOT_STARTED'
    WHEN v IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW',
               'CORRECTION_REQUIRED','APPROVED','REJECTED','SUSPENDED') THEN v
    WHEN v IN ('PENDING','PENDING_REVIEW','PENDING_VERIFICATION','RESUBMITTED') THEN 'SUBMITTED'
    WHEN v = 'VERIFIED' THEN 'APPROVED'
    WHEN v IN ('CORRECTION_REQUESTED','REQUIRES_CORRECTION','NEEDS_CORRECTION',
               'ADDITIONAL_INFORMATION_REQUIRED','RESUBMISSION_REQUIRED') THEN 'CORRECTION_REQUIRED'
    WHEN v = 'IN_REVIEW' THEN 'UNDER_REVIEW'
    WHEN v = 'DRAFT' THEN 'IN_PROGRESS'
    ELSE 'NOT_STARTED'
  END
  FROM (
    SELECT regexp_replace(
             regexp_replace(upper(coalesce(p_status, '')), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
             '[[:space:]-]+', '_', 'g') AS v
  ) s
$$;

UPDATE borrowers
   SET kyc_status = kyc_normalize_status(kyc_status)
 WHERE kyc_status IS DISTINCT FROM kyc_normalize_status(kyc_status);

-- Spelling-only rewrites still pass through the 0023 guard, which requires an
-- actor; 'reconcile' is the actor reserved for this kind of maintenance.
SELECT set_config('hoscomo.kyc_actor', 'reconcile', true);
UPDATE kyc_submissions
   SET status = kyc_normalize_status(status)
 WHERE status IS DISTINCT FROM kyc_normalize_status(status);
SELECT set_config('hoscomo.kyc_actor', '', true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'borrowers_kyc_status_canonical') THEN
    ALTER TABLE borrowers ADD CONSTRAINT borrowers_kyc_status_canonical CHECK (
      kyc_status IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW',
                     'CORRECTION_REQUIRED','APPROVED','REJECTED','SUSPENDED'));
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 2. Address as PSGC codes; registration provenance
-- ------------------------------------------------------------

ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS region_code TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS province_code TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS city_code TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS barangay_code TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS registration_channel TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS registered_by TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'borrowers_psgc_code_format') THEN
    ALTER TABLE borrowers ADD CONSTRAINT borrowers_psgc_code_format CHECK (
          (region_code   IS NULL OR region_code   ~ '^[0-9]{2}$')
      AND (province_code IS NULL OR province_code ~ '^[0-9]{4}$')
      AND (city_code     IS NULL OR city_code     ~ '^[0-9]{6}$')
      AND (barangay_code IS NULL OR barangay_code ~ '^[0-9]{9}$')
      AND (postal_code   IS NULL OR postal_code   ~ '^[0-9]{4}$'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'borrowers_registration_channel') THEN
    ALTER TABLE borrowers ADD CONSTRAINT borrowers_registration_channel CHECK (
      registration_channel IS NULL OR registration_channel IN ('SELF', 'BRANCH'));
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 3. Duplicate prevention
-- ------------------------------------------------------------

-- Fail with a readable message rather than a bare unique-violation if the
-- data already holds duplicates; they must be merged by hand first.
DO $$
DECLARE
  v_email int; v_phone int; v_id int;
BEGIN
  SELECT count(*) INTO v_email FROM (
    SELECT lower(btrim(email)) FROM borrowers WHERE btrim(email) <> '' GROUP BY 1 HAVING count(*) > 1) d;
  SELECT count(*) INTO v_phone FROM (
    SELECT right(regexp_replace(phone, '\D', '', 'g'), 10) FROM borrowers
     WHERE length(regexp_replace(phone, '\D', '', 'g')) >= 10 GROUP BY 1 HAVING count(*) > 1) d;
  SELECT count(*) INTO v_id FROM (
    SELECT upper(regexp_replace(id_number, '[^A-Za-z0-9]', '', 'g')) FROM borrowers
     WHERE regexp_replace(id_number, '[^A-Za-z0-9]', '', 'g') <> '' GROUP BY 1 HAVING count(*) > 1) d;
  IF v_email + v_phone + v_id > 0 THEN
    RAISE EXCEPTION '0024: borrowers already contains duplicates (emails: %, mobile numbers: %, ID numbers: %). Merge them before applying.',
      v_email, v_phone, v_id;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowers_email_normalized
  ON borrowers ((lower(btrim(email))))
  WHERE btrim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowers_phone_normalized
  ON borrowers ((right(regexp_replace(phone, '\D', '', 'g'), 10)))
  WHERE length(regexp_replace(phone, '\D', '', 'g')) >= 10;

CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowers_id_number_normalized
  ON borrowers ((upper(regexp_replace(id_number, '[^A-Za-z0-9]', '', 'g'))))
  WHERE regexp_replace(id_number, '[^A-Za-z0-9]', '', 'g') <> '';

-- ------------------------------------------------------------
-- 4. One KYC application per member
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_submissions_borrower ON kyc_submissions (borrower_id);

-- ------------------------------------------------------------
-- 5. Email verification codes
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS email_verifications (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL,
  purpose           TEXT NOT NULL CHECK (purpose IN ('REGISTRATION')),
  code_hash         TEXT NOT NULL,
  attempts          INTEGER NOT NULL DEFAULT 0,
  expires_at        TIMESTAMPTZ NOT NULL,
  verified_at       TIMESTAMPTZ,
  token_hash        TEXT,
  token_expires_at  TIMESTAMPTZ,
  consumed_at       TIMESTAMPTZ,
  consumed_by       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_verifications_email_lower CHECK (email = lower(btrim(email)))
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications (email, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_email_verifications_token ON email_verifications (token_hash) WHERE token_hash IS NOT NULL;

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6. Notifications addressed to members
-- ------------------------------------------------------------

ALTER TABLE branch_notifications ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'STAFF';
ALTER TABLE branch_notifications ADD COLUMN IF NOT EXISTS borrower_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'branch_notifications_audience') THEN
    ALTER TABLE branch_notifications ADD CONSTRAINT branch_notifications_audience CHECK (
      audience IN ('STAFF', 'CLIENT') AND (audience <> 'CLIENT' OR borrower_id IS NOT NULL));
  END IF;
END
$$;

-- Loan decisions written for the member were stored with related_id = loan id
-- and so never reached the member's feed. These titles are the member-facing ones.
UPDATE branch_notifications n
   SET audience = 'CLIENT', borrower_id = l.borrower_id
  FROM loans l
 WHERE n.audience = 'STAFF'
   AND n.related_type = 'Loan'
   AND n.related_id = l.id
   AND n.title IN ('🎉 Loan Application Approved', '❌ Loan Application Update',
                   '⚠️ Loan Application Action Required', '💰 Loan Disbursed Successfully',
                   '🎉 Loan Fully Settled & Completed');

CREATE INDEX IF NOT EXISTS idx_branch_notifications_member
  ON branch_notifications (borrower_id, created_at DESC) WHERE audience = 'CLIENT';

-- ------------------------------------------------------------
-- 7. No direct access through the public API
-- ------------------------------------------------------------

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE email_verifications FROM %I', r);
    END IF;
  END LOOP;
END
$$;

COMMIT;
