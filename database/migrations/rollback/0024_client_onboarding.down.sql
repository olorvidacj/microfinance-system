-- Rollback for 0024_client_onboarding.sql
--
-- Not reversible: the status spelling rewrite in step 1 (the canonical values
-- remain valid under the restored 0023 function), and the notification
-- backfill in step 6 (dropping the columns removes the audience marking).
-- Dropping the address and provenance columns deletes the data in them.

BEGIN;

DROP INDEX IF EXISTS idx_branch_notifications_member;
ALTER TABLE branch_notifications DROP CONSTRAINT IF EXISTS branch_notifications_audience;
ALTER TABLE branch_notifications DROP COLUMN IF EXISTS borrower_id;
ALTER TABLE branch_notifications DROP COLUMN IF EXISTS audience;

DROP TABLE IF EXISTS email_verifications;

DROP INDEX IF EXISTS uq_kyc_submissions_borrower;
DROP INDEX IF EXISTS uq_borrowers_id_number_normalized;
DROP INDEX IF EXISTS uq_borrowers_phone_normalized;
DROP INDEX IF EXISTS uq_borrowers_email_normalized;

ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS borrowers_registration_channel;
ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS borrowers_psgc_code_format;
ALTER TABLE borrowers DROP COLUMN IF EXISTS registered_by;
ALTER TABLE borrowers DROP COLUMN IF EXISTS registration_channel;
ALTER TABLE borrowers DROP COLUMN IF EXISTS id_type;
ALTER TABLE borrowers DROP COLUMN IF EXISTS postal_code;
ALTER TABLE borrowers DROP COLUMN IF EXISTS barangay_code;
ALTER TABLE borrowers DROP COLUMN IF EXISTS city_code;
ALTER TABLE borrowers DROP COLUMN IF EXISTS province_code;
ALTER TABLE borrowers DROP COLUMN IF EXISTS region_code;
ALTER TABLE borrowers DROP COLUMN IF EXISTS region;

ALTER TABLE borrowers DROP CONSTRAINT IF EXISTS borrowers_kyc_status_canonical;

-- Restore the 0023 definition (without RESUBMISSION_REQUIRED).
CREATE OR REPLACE FUNCTION kyc_normalize_status(p_status text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN v = '' THEN 'NOT_STARTED'
    WHEN v IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW',
               'CORRECTION_REQUIRED','APPROVED','REJECTED','SUSPENDED') THEN v
    WHEN v IN ('PENDING','PENDING_REVIEW','PENDING_VERIFICATION','RESUBMITTED') THEN 'SUBMITTED'
    WHEN v = 'VERIFIED' THEN 'APPROVED'
    WHEN v IN ('CORRECTION_REQUESTED','REQUIRES_CORRECTION','NEEDS_CORRECTION',
               'ADDITIONAL_INFORMATION_REQUIRED') THEN 'CORRECTION_REQUIRED'
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

COMMIT;
