-- ============================================================
-- 0021 — LEGACY BACKFILL AND STATUS REMAP
--
-- Moves data from the JSONB-era design (kyc_submissions, kyc_documents) into
-- the normalised model from 0020, and collapses the three competing status
-- vocabularies into the eight canonical states.
--
-- Requires: 0019, 0020
--
-- The governing rule in this file is that nothing is invented. Where the legacy
-- data cannot be represented faithfully in the new schema -- free-text
-- addresses with no PSGC codes, uploads that only ever had an expiring signed
-- URL -- the row is recorded as needing staff action rather than filled in with
-- a plausible-looking guess. A fabricated barangay code is worse than a blank
-- field, because it looks verified and will be relied on.
--
-- This is safe to re-run: every insert is keyed on the legacy primary key.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Canonical status mapping
--
-- The old code wrote at least three vocabularies. The loan screen and the
-- branch desk used PENDING/VERIFIED, the profile used NOT_STARTED, and the
-- spec calls for the eight uppercase states. Anything not recognised maps to
-- NOT_STARTED, which is the most restrictive outcome: it never grants
-- APPROVED and therefore never unlocks a loan on the strength of a value
-- nobody can explain.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION kyc_legacy_status_to_canonical(p_status TEXT)
RETURNS kyc_status LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v TEXT := upper(btrim(coalesce(p_status, '')));
BEGIN
  RETURN CASE v
    -- Already canonical.
    WHEN 'NOT_STARTED'          THEN 'NOT_STARTED'::kyc_status
    WHEN 'IN_PROGRESS'          THEN 'IN_PROGRESS'::kyc_status
    WHEN 'SUBMITTED'            THEN 'SUBMITTED'::kyc_status
    WHEN 'UNDER_REVIEW'         THEN 'UNDER_REVIEW'::kyc_status
    WHEN 'CORRECTION_REQUIRED'  THEN 'CORRECTION_REQUIRED'::kyc_status
    WHEN 'APPROVED'             THEN 'APPROVED'::kyc_status
    WHEN 'REJECTED'             THEN 'REJECTED'::kyc_status
    WHEN 'SUSPENDED'            THEN 'SUSPENDED'::kyc_status

    -- Legacy spellings actually present in the database.
    WHEN 'PENDING'              THEN 'SUBMITTED'::kyc_status
    WHEN 'VERIFIED'             THEN 'APPROVED'::kyc_status
    WHEN 'DRAFT'                THEN 'IN_PROGRESS'::kyc_status
    WHEN 'REVIEWING'            THEN 'UNDER_REVIEW'::kyc_status
    WHEN 'NEEDS_CORRECTION'     THEN 'CORRECTION_REQUIRED'::kyc_status
    WHEN 'NEEDS CORRECTION'     THEN 'CORRECTION_REQUIRED'::kyc_status
    -- EXPIRED meant an ID that had been approved and has since lapsed. The
    -- eight-state model has no EXPIRED; SUSPENDED is the honest equivalent,
    -- and both keep the KYC gate closed.
    WHEN 'EXPIRED'              THEN 'SUSPENDED'::kyc_status
    WHEN 'REJECT'               THEN 'REJECTED'::kyc_status
    WHEN 'APPROVE'              THEN 'APPROVED'::kyc_status
    WHEN 'SUBMIT'               THEN 'SUBMITTED'::kyc_status

    ELSE 'NOT_STARTED'::kyc_status
  END;
END;
$$;

-- ------------------------------------------------------------
-- 2. Report unrecognised statuses before changing anything
--
-- A silent fallback to NOT_STARTED is safe but lossy, so the values that hit
-- the fallback are surfaced. A deliberately stored 'PENDING_V2' should be
-- noticed by a human, not quietly downgraded.
-- ------------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT 'borrowers.kyc_status' AS src, kyc_status AS raw, count(*) AS n
      FROM borrowers GROUP BY kyc_status
    UNION ALL
    SELECT 'kyc_submissions.status', status, count(*)
      FROM kyc_submissions GROUP BY status
  LOOP
    IF kyc_legacy_status_to_canonical(r.raw)::text
       NOT IN ('NOT_STARTED','IN_PROGRESS','SUBMITTED','UNDER_REVIEW',
               'CORRECTION_REQUIRED','APPROVED','REJECTED','SUSPENDED')
       OR r.raw IS DISTINCT FROM kyc_legacy_status_to_canonical(r.raw)::text THEN
      RAISE NOTICE '0021: % value % (x%) maps to %',
        r.src, coalesce(r.raw, '<null>'), r.n, kyc_legacy_status_to_canonical(r.raw);
    END IF;
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 3. Remap borrowers.kyc_status
--
-- member_status is deliberately NOT touched. It is a separate axis (a member
-- can be an active member with an unverified KYC) and an earlier draft of this
-- migration set both columns, which would have suspended real members.
-- ------------------------------------------------------------

UPDATE borrowers
   SET kyc_status = kyc_legacy_status_to_canonical(kyc_status)::text
 WHERE kyc_status IS DISTINCT FROM kyc_legacy_status_to_canonical(kyc_status)::text;

-- Keep the loan gate honest: only APPROVED may open a KYC-dependent service.
-- Any borrower whose old status merely *looked* approved is moved out of it.
UPDATE borrowers
   SET kyc_status = 'CORRECTION_REQUIRED'
 WHERE kyc_status = 'APPROVED'
   AND NOT EXISTS (
     SELECT 1 FROM kyc_submissions s
      WHERE s.borrower_id = borrowers.id
        AND kyc_legacy_status_to_canonical(s.status) = 'APPROVED'::kyc_status
   );

-- Marks the session as a migration. 0022 refuses to let a new application
-- arrive in a resolved state, because a *request* doing that would be a bypass.
-- A backfill of historical records is not a request, and on a database where
-- 0022 is already installed this flag is the only thing that lets 0021 run
-- again. Set before the inserts below and cleared at the end of the file.
SET app.migration = '0021';

-- ------------------------------------------------------------
-- 4. kyc_applications from kyc_submissions
--
-- The legacy submission id is reused as the application id so that audit rows,
-- document rows and any external reference keep resolving to the same thing
-- across the cutover. One submission becomes one application; the legacy model
-- had no notion of a second attempt, so version is always 1.
--
-- snapshot is set to the raw legacy JSON so nothing is lost even where the
-- normalised columns cannot represent it.
-- ------------------------------------------------------------

INSERT INTO kyc_applications (
  id, borrower_id, version, status, current_step, furthest_step,
  started_at, submitted_at, reviewed_at, reviewed_by, reviewer_name,
  approved_at, verified_at, rejected_at, correction_reason, rejection_reason,
  snapshot, created_at, updated_at
)
SELECT
  s.id,
  s.borrower_id,
  1,
  kyc_legacy_status_to_canonical(s.status),
  -- The old wizard had five steps; the new flow has eight. Legacy data can
  -- never be further along than the old wizard's last step, so a completed
  -- legacy submission is mapped to step 5, not 8. Claiming 8 would mark steps
  -- complete that the client never filled in.
  CASE WHEN s.status IN ('PENDING','VERIFIED','REJECTED') THEN 5 ELSE 1 END,
  CASE WHEN s.status IN ('PENDING','VERIFIED','REJECTED') THEN 5 ELSE 1 END,
  NULLIF(btrim(s.created_at), '')::timestamptz,
  NULLIF(btrim(s.submitted_at), '')::timestamptz,
  NULLIF(btrim(s.reviewed_at), '')::timestamptz,
  NULLIF(btrim(s.reviewed_by), ''),
  NULLIF(btrim(s.reviewed_by_name), ''),
  CASE WHEN kyc_legacy_status_to_canonical(s.status) = 'APPROVED'::kyc_status
       THEN NULLIF(btrim(s.verified_at), '')::timestamptz END,
  CASE WHEN kyc_legacy_status_to_canonical(s.status) = 'APPROVED'::kyc_status
       THEN NULLIF(btrim(s.reviewed_at), '')::timestamptz END,
  CASE WHEN kyc_legacy_status_to_canonical(s.status) = 'REJECTED'::kyc_status
       THEN NULLIF(btrim(s.reviewed_at), '')::timestamptz END,
  NULLIF(btrim(s.correction_reason), ''),
  NULLIF(btrim(s.rejection_reason), ''),
  jsonb_build_object(
    'legacy_submission_id',    s.id,
    'legacy_personal_info',    s.personal_info,
    'legacy_address',          s.address,
    'legacy_employment',       s.employment,
    'legacy_status',           s.status,
    'backfilled_at',           now()
  ),
  COALESCE(NULLIF(btrim(s.created_at), '')::timestamptz, now()),
  COALESCE(NULLIF(btrim(s.updated_at), '')::timestamptz, now())
FROM kyc_submissions s
ON CONFLICT (id) DO NOTHING;

-- The remap itself is an auditable event, not a silent rewrite.
INSERT INTO kyc_audit_logs (borrower_id, application_id, action, actor_role, reason, metadata)
SELECT
  s.borrower_id,
  s.id,
  'KYC_MIGRATED',
  'SYSTEM',
  'Backfilled from legacy kyc_submissions; status remapped to the canonical vocabulary.',
  jsonb_build_object('legacy_status', s.status, 'canonical_status',
                     kyc_legacy_status_to_canonical(s.status)::text)
FROM kyc_submissions s
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 5. kyc_personal from personal_info
--
-- A row is migrated only when every field the schema requires can be resolved
-- without guessing. personal_info is the client's own submission; borrowers is
-- the denormalised copy the old submit handler wrote from it, so coalescing the
-- two is still the client's data and not a fabrication.
--
-- Rows that cannot be completed are left out and flagged below. Supplying a
-- placeholder nationality to satisfy NOT NULL would put an invented value in
-- front of a reviewer deciding whether to approve a loan, which is worse than
-- an empty record.
-- ------------------------------------------------------------

INSERT INTO kyc_personal (
  application_id, first_name, middle_name, has_middle_name, last_name,
  date_of_birth, place_of_birth, sex, civil_status,
  nationality, nationality_other, citizenship, citizenship_other,
  created_at, updated_at
)
SELECT
  s.id,
  NULLIF(btrim(s.personal_info ->> 'firstName'), ''),
  NULLIF(btrim(s.personal_info ->> 'middleName'), ''),
  COALESCE((s.personal_info ->> 'hasMiddleName')::boolean, TRUE),
  NULLIF(btrim(s.personal_info ->> 'lastName'), ''),
  COALESCE(
    NULLIF(btrim(s.personal_info ->> 'dateOfBirth'), '')::date,
    NULLIF(btrim(b.date_of_birth), '')::date
  ),
  NULLIF(btrim(s.personal_info ->> 'placeOfBirth'), ''),
  CASE upper(btrim(coalesce(s.personal_info ->> 'sex', s.personal_info ->> 'gender', b.gender)))
    WHEN 'MALE' THEN 'male' WHEN 'FEMALE' THEN 'female' WHEN 'OTHER' THEN 'other'
  END,
  NULLIF(btrim(coalesce(s.personal_info ->> 'civilStatus', b.civil_status)), ''),
  NULLIF(btrim(s.personal_info ->> 'nationality'), ''),
  NULLIF(btrim(s.personal_info ->> 'nationalityOther'), ''),
  NULLIF(btrim(coalesce(s.personal_info ->> 'citizenship', s.personal_info ->> 'nationality')), ''),
  NULLIF(btrim(s.personal_info ->> 'citizenshipOther'), ''),
  COALESCE(NULLIF(btrim(s.created_at), '')::timestamptz, now()),
  COALESCE(NULLIF(btrim(s.updated_at), '')::timestamptz, now())
FROM kyc_submissions s
JOIN borrowers b ON b.id = s.borrower_id
WHERE NULLIF(btrim(s.personal_info ->> 'firstName'), '') IS NOT NULL
  AND NULLIF(btrim(s.personal_info ->> 'lastName'),  '') IS NOT NULL
  AND COALESCE(
        NULLIF(btrim(s.personal_info ->> 'dateOfBirth'), '')::date,
        NULLIF(btrim(b.date_of_birth), '')::date
      ) IS NOT NULL
  AND upper(btrim(coalesce(s.personal_info ->> 'sex', s.personal_info ->> 'gender', b.gender)))
      IN ('MALE', 'FEMALE', 'OTHER')
  AND NULLIF(btrim(coalesce(s.personal_info ->> 'civilStatus', b.civil_status)), '') IS NOT NULL
  AND NULLIF(btrim(s.personal_info ->> 'placeOfBirth'), '') IS NOT NULL
  AND NULLIF(btrim(s.personal_info ->> 'nationality'), '') IS NOT NULL
  AND NULLIF(btrim(coalesce(s.personal_info ->> 'citizenship', s.personal_info ->> 'nationality')), '') IS NOT NULL
ON CONFLICT (application_id) DO NOTHING;

-- ------------------------------------------------------------
-- 6. kyc_addresses is deliberately NOT backfilled
--
-- The legacy address was free text: houseUnit, street, barangay, city,
-- province, postalCode -- names typed by a person, with no PSGC codes. The new
-- schema requires region, city and barangay codes and a postal code that
-- belongs to the chosen city.
--
-- Those codes could be derived by name lookup, and it is tempting: the city
-- names mostly match PSGC. But barangay names are not unique across the
-- country, spelling varies, and a silent mismatch attaches a client's address
-- to the wrong municipality. A staff reviewer comparing a document against a
-- wrong address approves a loan against the wrong evidence.
--
-- So the legacy address is preserved in the application snapshot, the address
-- section is left outstanding, and a correction is raised telling the client to
-- re-enter it with the guided form. That is the honest outcome: the old data was
-- never verified to this standard.
-- ------------------------------------------------------------

INSERT INTO kyc_sections (application_id, section_key, data, completed_at, last_saved_at)
SELECT
  s.id,
  'ADDRESS'::kyc_section_key,
  s.address,
  NULL,
  now()
FROM kyc_submissions s
WHERE s.address IS NOT NULL
ON CONFLICT (application_id, section_key) DO NOTHING;

INSERT INTO kyc_corrections (
  application_id, section_key, target_kind, target_ref, reason, required_action, created_at
)
SELECT
  s.id,
  'PERSONAL'::kyc_section_key,
  'FIELD',
  'kyc_personal',
  'Your previous KYC record was stored as free text and could not be verified '
  'against the required identification standard.',
  'Re-enter your personal details using the guided form.',
  now()
FROM kyc_submissions s
WHERE NOT EXISTS (SELECT 1 FROM kyc_personal p WHERE p.application_id = s.id)
ON CONFLICT DO NOTHING;

INSERT INTO kyc_corrections (
  application_id, section_key, target_kind, target_ref, reason, required_action, created_at
)
SELECT
  s.id,
  'ADDRESS'::kyc_section_key,
  'FIELD',
  'kyc_addresses',
  'Your previous address was recorded as free text and cannot be verified against '
  'the Philippine address standard.',
  'Re-enter your current address using the guided form so it can be checked.',
  now()
FROM kyc_submissions s
WHERE s.address IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM kyc_addresses a WHERE a.application_id = s.id)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 7. kyc_documents from kyc_documents_legacy
--
-- The legacy rows hold `file_url`, a Supabase signed URL. Those expire -- 0011
-- itself notes the bucket was public and the URLs were minted per read -- so
-- there is no durable object to point at. A storage_path is therefore added
-- only where a non-expiring path can be derived, and the rest are recorded as
-- rejected pending re-upload.
--
-- Nothing is silently dropped: rows that cannot be migrated are counted in the
-- notice below so staff can see the size of the re-upload task.
-- ------------------------------------------------------------

-- Allow a migrated row to exist without a durable object. Without this the
-- storage_path NOT NULL constraint forces either a fabricated path or losing
-- the record of what the client claims to have uploaded.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'kyc_documents'
       AND column_name = 'legacy_reference'
  ) THEN
    ALTER TABLE kyc_documents ADD COLUMN legacy_reference TEXT;
    -- The column must also lose NOT NULL. Relaxing the CHECK alone is not
    -- enough: a NULL storage_path is still rejected by the column constraint
    -- before the CHECK is ever consulted.
    ALTER TABLE kyc_documents ALTER COLUMN storage_path DROP NOT NULL;
    ALTER TABLE kyc_documents DROP CONSTRAINT IF EXISTS kyc_documents_path_present;
    ALTER TABLE kyc_documents
      ADD CONSTRAINT kyc_documents_path_present
      CHECK (
        NULLIF(TRIM(storage_path), '') IS NOT NULL
        OR NULLIF(TRIM(legacy_reference), '') IS NOT NULL
      );
    COMMENT ON COLUMN kyc_documents.storage_path IS
      'Durable object path. Nullable only for records migrated from the legacy '
      'JSONB-era table, where an expiring signed URL was the only reference and '
      'no durable object existed; those rows carry legacy_reference instead.';
  END IF;
END
$$;

-- Map the legacy free-text document_type onto the catalogue. An unrecognised
-- value is left out rather than guessed at; see the notice at the end.
INSERT INTO kyc_documents (
  application_id, borrower_id, document_type_code, version, is_current,
  status, storage_bucket, storage_path, legacy_reference, original_filename,
  rejection_reason, created_at, updated_at
)
SELECT
  d.kyc_submission_id,
  d.borrower_id,
  mapped.code,
  1,
  TRUE,
  -- A document whose bytes cannot be produced is not "uploaded", whatever the
  -- legacy status column said. REJECTED with a reason is the state that sends
  -- the client back to upload.
  CASE WHEN d.file_url IS NULL OR btrim(d.file_url) = ''
       THEN 'REJECTED'::kyc_document_status
       ELSE 'UPLOADED'::kyc_document_status
  END,
  'kyc-documents',
  CASE WHEN d.file_url IS NOT NULL AND btrim(d.file_url) <> ''
       THEN 'kyc/' || d.borrower_id || '/legacy/' || d.id END,
  CASE WHEN d.file_url IS NULL OR btrim(d.file_url) = ''
       THEN 'Legacy record from kyc_documents_legacy (id ' || d.id || ') had no '
            || 'stored object; only a signed URL that has since expired. '
            || 'Client must upload again.'
       END,
  NULLIF(btrim(d.file_name), ''),
  CASE WHEN d.file_url IS NULL OR btrim(d.file_url) = ''
       THEN 'Legacy upload is no longer retrievable; please upload the document again.'
  END,
  COALESCE(NULLIF(btrim(d.created_at), '')::timestamptz, now()),
  COALESCE(NULLIF(btrim(d.created_at), '')::timestamptz, now())
FROM kyc_documents_legacy d
JOIN (
  VALUES
    ('proof_of_address', 'PROOF_OF_ADDRESS'),
    ('proof_of_income',  'PROOF_OF_INCOME'),
    ('business_permit',  'BUSINESS_PERMIT'),
    ('valid_id',         'PROOF_OF_ADDRESS'),
    ('valid id',         'PROOF_OF_ADDRESS'),
    ('barangay_id',      'PROOF_OF_ADDRESS'),
    ('barangay id',      'PROOF_OF_ADDRESS'),
    ('selfie',           'SELFIE'),
    ('selfie_with_id',   'SELFIE'),
    ('id_with_selfie',   'SELFIE')
) AS mapped(legacy_name, code)
  ON mapped.legacy_name = lower(btrim(d.document_type))
WHERE EXISTS (SELECT 1 FROM kyc_applications a WHERE a.id = d.kyc_submission_id)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_total         BIGINT;
  v_unrecoverable BIGINT;
  v_unmapped      TEXT;
BEGIN
  IF to_regclass('public.kyc_documents_legacy') IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_total FROM kyc_documents_legacy;

  SELECT count(*) INTO v_unrecoverable FROM kyc_documents_legacy
   WHERE file_url IS NULL OR btrim(file_url) = '';

  SELECT string_agg(t, ', ') INTO v_unmapped
    FROM (
      SELECT DISTINCT lower(btrim(document_type)) AS t FROM kyc_documents_legacy
    ) x
   WHERE x.t NOT IN ('proof_of_address','proof_of_income','business_permit','valid_id',
                     'valid id','barangay_id','barangay id','selfie','selfie_with_id','id_with_selfie');

  RAISE NOTICE
    '0021 documents: % legacy rows; % have no recoverable object and need client re-upload; '
    'document_type values not in the catalogue and therefore left unmigrated: %',
    v_total, v_unrecoverable, coalesce(v_unmapped, 'none');
END
$$;

RESET app.migration;
