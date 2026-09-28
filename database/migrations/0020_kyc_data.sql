-- ============================================================
-- 0020 — KYC DATA: applications, sections, documents, reviews
--
-- The normalised KYC data model required by §25. The legacy design stored the
-- whole form as three JSONB columns on kyc_submissions, which cannot be
-- validated relationally, reported on, or reviewed field by field. These tables
-- put every reportable value in a column of its own, with foreign keys and
-- CHECK constraints doing the work that application code previously did.
--
-- Requires: 0019
-- Legacy JSONB backfill and status remap follow in 0021; RLS in 0022.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Retire the legacy kyc_documents table
--
-- 0011 created a `kyc_documents` table for the old JSONB-era flow: one row per
-- upload, holding a signed URL that expires, keyed on kyc_submission_id. The
-- normalised model in section 9 wants the same name for a different shape (per
-- application, per document type, versioned, with a durable storage path).
--
-- Leaving both in place is not an option, and neither is relying on
-- `CREATE TABLE IF NOT EXISTS`: that would silently skip creation, so every
-- later statement would be building on the legacy shape and the migration would
-- fail somewhere far away with a misleading error. The failure has to happen
-- here, deliberately.
--
-- The legacy table is renamed, not dropped. Its rows are the input to the
-- backfill in 0021, and PII must not be destroyed as a side effect of a schema
-- change. Application code still reading `kyc_documents` will now fail loudly
-- rather than silently read the wrong columns, which is the intended outcome:
-- it is replaced by the routes written against this schema.
-- ------------------------------------------------------------

DO $$
DECLARE
  v_exists BOOLEAN;
  v_legacy BOOLEAN;
BEGIN
  SELECT to_regclass('public.kyc_documents') IS NOT NULL INTO v_exists;
  IF NOT v_exists THEN
    RETURN;
  END IF;

  -- The legacy table is identified by the columns it actually has, not by name:
  -- if this is already the normalised table, re-running the migration is a no-op.
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'kyc_documents'
       AND column_name = 'kyc_submission_id'
  ) INTO v_legacy;

  IF NOT v_legacy THEN
    RAISE NOTICE
      '0020: public.kyc_documents already has the normalised shape; leaving it alone.';
    RETURN;
  END IF;

  IF to_regclass('public.kyc_documents_legacy') IS NOT NULL THEN
    RAISE EXCEPTION
      'Both kyc_documents (legacy shape) and kyc_documents_legacy exist. Resolve by hand before re-running 0020.';
  END IF;

  ALTER TABLE kyc_documents RENAME TO kyc_documents_legacy;
  COMMENT ON TABLE kyc_documents_legacy IS
    'Legacy JSONB-era KYC uploads from 0011. Renamed by 0020; input to the backfill in 0021, then dropped.';

  RAISE NOTICE '0020: renamed legacy kyc_documents to kyc_documents_legacy.';
END
$$;

-- ------------------------------------------------------------
-- 1. kyc_applications — one row per KYC attempt
--
-- `version` increments on each resubmission so the audit trail can distinguish
-- attempts, and `snapshot` freezes exactly what the client submitted so a later
-- edit to a draft cannot rewrite history (§18, §28).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_applications (
  id                TEXT PRIMARY KEY,
  borrower_id       TEXT NOT NULL REFERENCES borrowers(id) ON DELETE RESTRICT,
  version           INTEGER NOT NULL DEFAULT 1,
  status            kyc_status NOT NULL DEFAULT 'NOT_STARTED',

  -- Resumable position. Drives "continue from the last incomplete step" (§2).
  current_step      SMALLINT NOT NULL DEFAULT 1,
  furthest_step     SMALLINT NOT NULL DEFAULT 1,

  started_at        TIMESTAMPTZ,
  submitted_at      TIMESTAMPTZ,
  submitted_by      TEXT,
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       TEXT,
  reviewer_name     TEXT,
  approved_at       TIMESTAMPTZ,
  verified_at       TIMESTAMPTZ,
  rejected_at       TIMESTAMPTZ,
  suspended_at      TIMESTAMPTZ,
  suspended_reason  TEXT,
  rejection_reason  TEXT,
  correction_reason TEXT,

  -- Soft claim so two reviewers cannot work the same file (§17.8).
  locked_until      TIMESTAMPTZ,
  locked_by         TEXT,
  locked_by_name    TEXT,

  -- §18: immutable record of the submitted information.
  snapshot          JSONB,
  -- §18: IP/device metadata, only when configured and legally appropriate.
  -- Guarded by a column-level GREVOKE in 0022 so clients cannot read their own
  -- submission fingerprint.
  ip_address        TEXT,
  user_agent        TEXT,
  device_fingerprint TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_applications_version_positive CHECK (version >= 1),
  CONSTRAINT kyc_applications_step_range CHECK (current_step BETWEEN 1 AND 8),
  -- A submission cannot be dated before the application existed.
  CONSTRAINT kyc_applications_submitted_after_start CHECK (
    submitted_at IS NULL OR started_at IS NULL OR submitted_at >= started_at
  )
);

-- One live application per borrower: the version that is not closed out.
-- Closed statuses may coexist, so history is preserved (a REJECTED v1 with a
-- SUBMITTED v2 is a legitimate state and must not be blocked).
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_applications_open_per_borrower
  ON kyc_applications(borrower_id)
  WHERE status NOT IN ('APPROVED', 'REJECTED', 'SUSPENDED');

CREATE INDEX IF NOT EXISTS idx_kyc_applications_borrower ON kyc_applications(borrower_id);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_status   ON kyc_applications(status);
CREATE INDEX IF NOT EXISTS idx_kyc_applications_submitted ON kyc_applications(submitted_at DESC NULLS LAST);

-- ------------------------------------------------------------
-- 2. kyc_sections — per-step autosave draft
--
-- §2 requires that a client can leave mid-flow and lose nothing. Each step is
-- written here as the client types, so returning to KYC rehydrates from the
-- database rather than from anything the client kept in the browser.
--
-- `data` is deliberately JSONB: it is an autosave staging area, not the record
-- of truth. On a valid step save the values are projected into the typed
-- tables below, and those are what staff review and what reporting reads.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_sections (
  id             BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  section_key    kyc_section_key NOT NULL,
  data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Validation errors from the last save, so the UI can re-highlight the
  -- offending fields after a round trip.
  errors         JSONB,
  completed_at   TIMESTAMPTZ,
  last_saved_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, section_key)
);

-- ------------------------------------------------------------
-- 3. kyc_personal — Step 1
--
-- `has_middle_name` exists so "I don't have a middle name" is a recorded,
-- affirmative answer rather than a blank that could also mean "not yet typed"
-- (§3). Placeholder values like N/A are rejected by the server validators.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_personal (
  application_id     TEXT PRIMARY KEY REFERENCES kyc_applications(id) ON DELETE CASCADE,
  first_name         TEXT NOT NULL,
  middle_name        TEXT,
  has_middle_name    BOOLEAN NOT NULL DEFAULT TRUE,
  last_name          TEXT NOT NULL,
  suffix             TEXT,
  suffix_other       TEXT,
  date_of_birth      DATE NOT NULL,
  place_of_birth     TEXT NOT NULL,
  sex                TEXT NOT NULL,
  civil_status       TEXT NOT NULL,
  nationality        TEXT NOT NULL,
  nationality_other  TEXT,
  citizenship        TEXT NOT NULL,
  citizenship_other  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_personal_suffix_required_when_other
    CHECK (suffix IS DISTINCT FROM 'OTHER' OR NULLIF(TRIM(suffix_other), '') IS NOT NULL),
  CONSTRAINT kyc_personal_nationality_other_required
    CHECK (nationality <> 'OTHER' OR NULLIF(TRIM(nationality_other), '') IS NOT NULL),
  -- A client cannot be born in the future, and no living person was born
  -- before 1900.
  CONSTRAINT kyc_personal_dob_sane
    CHECK (date_of_birth <= CURRENT_DATE AND date_of_birth > DATE '1900-01-01')
);

-- ------------------------------------------------------------
-- 4. kyc_addresses — Step 2
--
-- Two rows per application at most: one CURRENT, and one PERMANENT that exists
-- only when the client answers "no" to "is your permanent address the same as
-- your current address?" (§4). The client cannot type "same address" — the
-- relationship is modelled, not spelled.
--
-- Only PSGC codes are stored. Names are resolved at read time, so re-importing
-- a newer PSGC edition never rewrites a stored address (§32).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_addresses (
  id                 BIGSERIAL PRIMARY KEY,
  application_id     TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  kind               TEXT NOT NULL CHECK (kind IN ('CURRENT', 'PERMANENT')),
  is_primary         BOOLEAN NOT NULL DEFAULT FALSE,

  region_code        CHAR(2) NOT NULL REFERENCES psgc_regions(code) ON DELETE RESTRICT,
  province_code      CHAR(4) REFERENCES psgc_provinces(code) ON DELETE RESTRICT,
  city_code          CHAR(6) NOT NULL REFERENCES psgc_cities(code) ON DELETE RESTRICT,
  barangay_code      CHAR(9) NOT NULL REFERENCES psgc_barangays(code) ON DELETE RESTRICT,
  postal_code        CHAR(4) NOT NULL,

  house_number       TEXT NOT NULL,
  street             TEXT NOT NULL,
  subdivision        TEXT,
  landmark           TEXT,
  additional_details TEXT,
  years_at_address   NUMERIC(4,1),

  -- TRUE on the CURRENT row when the permanent address is identical. When TRUE
  -- no PERMANENT row may exist; when FALSE exactly one must.
  --
  -- Nullable, and that is deliberate. This row is autosaved while the client is
  -- still typing (RESUMABLE, §2), and the "is the permanent address the same as
  -- your current one?" question is asked after the current address is entered.
  -- A NOT NULL DEFAULT FALSE would make the very first save of a valid current
  -- address fail, because at that moment the answer is genuinely unknown and no
  -- permanent address has been captured yet. NULL means "not yet answered" and
  -- is exempt from the biconditional below; FALSE is a real answer and is not.
  is_same_as_current BOOLEAN,
  -- Set when the client declares the address step finished. The consistency
  -- rules below are checked only from this point, because they cannot hold
  -- while the step is still being filled in: answering "the addresses differ"
  -- requires a permanent address that is entered on the next screen, and
  -- answering "they are the same" has to happen before one exists. Enforcing
  -- the pair on every autosave would reject both orders.
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_addresses_years_positive CHECK (years_at_address IS NULL OR years_at_address >= 0),
  CONSTRAINT kyc_addresses_postal_shape CHECK (postal_code ~ '^[0-9]{4}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_addresses_one_per_kind
  ON kyc_addresses(application_id, kind);

-- Hierarchy integrity is enforced here, not only in application code, so a
-- hand-crafted API request cannot attach a Manila barangay to a Cebu city.
-- A foreign key alone would not catch it: every code exists in its own table.
CREATE OR REPLACE FUNCTION kyc_addresses_check_hierarchy() RETURNS TRIGGER AS $$
DECLARE
  v_barangay_city  CHAR(6);
  v_city_province  CHAR(4);
  v_city_region    CHAR(2);
  v_province_region CHAR(2);
BEGIN
  SELECT city_code INTO v_barangay_city
    FROM psgc_barangays WHERE code = NEW.barangay_code;
  IF v_barangay_city IS NULL OR v_barangay_city <> NEW.city_code THEN
    RAISE EXCEPTION
      'The selected barangay does not belong to the selected city or municipality.';
  END IF;

  SELECT province_code, region_code INTO v_city_province, v_city_region
    FROM psgc_cities WHERE code = NEW.city_code;

  -- An LGU with no province (NCR's 17 LGUs, Isabela, Cotabato) must not carry
  -- one; every other LGU must.
  IF v_city_province IS NULL THEN
    IF NEW.province_code IS NOT NULL THEN
      RAISE EXCEPTION 'The selected city or municipality does not belong to a province.';
    END IF;
  ELSIF NEW.province_code IS DISTINCT FROM v_city_province THEN
    RAISE EXCEPTION 'The selected province does not match the selected city or municipality.';
  END IF;

  IF NEW.region_code IS DISTINCT FROM v_city_region THEN
    RAISE EXCEPTION 'The selected region does not match the selected city or municipality.';
  END IF;

  -- The ZIP must be one actually assigned to the chosen area.
  IF NOT EXISTS (
    SELECT 1 FROM psgc_postal_codes
     WHERE postal_code = NEW.postal_code
       AND (city_code = NEW.city_code OR city_code IS NULL)
       AND (barangay_code = NEW.barangay_code OR barangay_code IS NULL)
  ) THEN
    RAISE EXCEPTION 'The ZIP code you entered is not assigned to the selected barangay.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kyc_addresses_hierarchy ON kyc_addresses;
CREATE TRIGGER trg_kyc_addresses_hierarchy
  BEFORE INSERT OR UPDATE ON kyc_addresses
  FOR EACH ROW EXECUTE FUNCTION kyc_addresses_check_hierarchy();

-- The CURRENT row's is_same_as_current flag and the presence of a PERMANENT row
-- must agree, or §4's "same address" question becomes meaningless. This is a
-- biconditional, and both halves matter: enforcing only "same => no permanent
-- row" would let a client record a different permanent address while leaving the
-- flag FALSE, so the form would claim two addresses are different without
-- asking the second question.
--
-- Checked only once the CURRENT address is marked complete, not on every
-- autosave. Neither legal order would survive an eager check: entering a
-- permanent address before answering TRUE, or answering FALSE before the
-- permanent address exists, are both normal mid-step states. The invariant is a
-- statement about a finished address section, so it is enforced against a
-- finished one.
--
-- Deferred so it can see the whole final state rather than a partially written
-- set of rows.
CREATE OR REPLACE FUNCTION kyc_addresses_check_same_flag() RETURNS TRIGGER AS $$
DECLARE
  v_current_same      BOOLEAN;
  v_current_completed TIMESTAMPTZ;
  v_current_count     INTEGER;
  v_permanent_count   INTEGER;
BEGIN
  SELECT is_same_as_current, completed_at, count(*) OVER ()
    INTO v_current_same, v_current_completed, v_current_count
    FROM kyc_addresses
   WHERE application_id = NEW.application_id AND kind = 'CURRENT';

  v_current_count := COALESCE(v_current_count, 0);

  -- Still being edited, or no current address captured yet: nothing to check.
  IF v_current_completed IS NULL OR v_current_count = 0 THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_permanent_count
    FROM kyc_addresses
   WHERE application_id = NEW.application_id AND kind = 'PERMANENT';

  -- Not answered yet: nothing to cross-check.
  IF v_current_same IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_current_same AND v_permanent_count > 0 THEN
    RAISE EXCEPTION
      'A separate permanent address cannot be recorded when it is marked the same as the current address.';
  END IF;

  IF NOT v_current_same AND v_permanent_count = 0 THEN
    RAISE EXCEPTION
      'A permanent address is required when the permanent address is not marked the same as the current address.';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kyc_addresses_same_flag ON kyc_addresses;
CREATE CONSTRAINT TRIGGER trg_kyc_addresses_same_flag
  AFTER INSERT OR UPDATE ON kyc_addresses
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION kyc_addresses_check_same_flag();

-- ------------------------------------------------------------
-- 5. kyc_contacts — Step 3
--
-- Numbers are stored once, in E.164 (+639XXXXXXXXX), and the local form is
-- derived. Two representations is how "one consistent normalized format" (§5)
-- is actually kept.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_contacts (
  application_id      TEXT PRIMARY KEY REFERENCES kyc_applications(id) ON DELETE CASCADE,
  mobile_e164         TEXT NOT NULL,
  mobile_local        TEXT,
  mobile_verified_at  TIMESTAMPTZ,
  alt_mobile_e164     TEXT,
  email               TEXT,
  email_verified_at   TIMESTAMPTZ,
  -- Which OTP challenge last verified the email, for traceability. A timestamp
  -- alone cannot answer "which code", so the challenge row is referenced; the
  -- foreign key is added below once kyc_verification_challenges exists.
  email_verification_id BIGINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_contacts_mobile_e164
    CHECK (mobile_e164 ~ '^\+639[0-9]{9}$'),
  CONSTRAINT kyc_contacts_alt_mobile_e164
    CHECK (alt_mobile_e164 IS NULL OR alt_mobile_e164 ~ '^\+639[0-9]{9}$'),
  CONSTRAINT kyc_contacts_email_shape
    CHECK (email IS NULL OR email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- ------------------------------------------------------------
-- 6. kyc_employment — Step 4
--
-- The employer and business branches are separate column groups rather than one
-- overloaded JSON blob, because which group is *required* depends on
-- employment_status — and that has to be answerable by a CHECK, not by reading
-- application code (§6).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_employment (
  application_id        TEXT PRIMARY KEY REFERENCES kyc_applications(id) ON DELETE CASCADE,
  employment_status     TEXT NOT NULL,
  occupation            TEXT,

  -- Employer branch: EMPLOYED / PRIVATE_EMPLOYEE / GOVERNMENT_EMPLOYEE
  employer_name         TEXT,
  job_position          TEXT,
  employment_type       TEXT,
  years_employed        NUMERIC(4,1),
  employer_region_code  CHAR(2) REFERENCES psgc_regions(code) ON DELETE RESTRICT,
  employer_province_code CHAR(4) REFERENCES psgc_provinces(code) ON DELETE RESTRICT,
  employer_city_code    CHAR(6) REFERENCES psgc_cities(code) ON DELETE RESTRICT,
  employer_address      TEXT,
  monthly_income        NUMERIC(14,2),

  -- Business branch: SELF_EMPLOYED / BUSINESS_OWNER
  business_name         TEXT,
  nature_of_business    TEXT,
  years_in_business     NUMERIC(4,1),
  business_region_code  CHAR(2) REFERENCES psgc_regions(code) ON DELETE RESTRICT,
  business_province_code CHAR(4) REFERENCES psgc_provinces(code) ON DELETE RESTRICT,
  business_city_code    CHAR(6) REFERENCES psgc_cities(code) ON DELETE RESTRICT,
  business_address      TEXT,
  estimated_income      NUMERIC(14,2),

  -- Other / student / retired / unemployed branch
  other_details         TEXT,
  is_student            BOOLEAN NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_employment_status_known CHECK (employment_status IN (
    'EMPLOYED', 'SELF_EMPLOYED', 'BUSINESS_OWNER', 'GOVERNMENT_EMPLOYEE',
    'PRIVATE_EMPLOYEE', 'STUDENT', 'RETIRED', 'UNEMPLOYED', 'OTHER'
  )),
  CONSTRAINT kyc_employment_years_non_negative
    CHECK ((years_employed IS NULL OR years_employed >= 0)
       AND (years_in_business IS NULL OR years_in_business >= 0)),
  CONSTRAINT kyc_employment_amounts_non_negative
    CHECK ((monthly_income IS NULL OR monthly_income >= 0)
       AND (estimated_income IS NULL OR estimated_income >= 0)),
  -- An employed applicant must name their employer; an employer with no name is
  -- not a KYC answer.
  CONSTRAINT kyc_employment_employer_required CHECK (
    employment_status NOT IN ('EMPLOYED', 'PRIVATE_EMPLOYEE', 'GOVERNMENT_EMPLOYEE')
    OR NULLIF(TRIM(employer_name), '') IS NOT NULL
  ),
  CONSTRAINT kyc_employment_business_required CHECK (
    employment_status NOT IN ('SELF_EMPLOYED', 'BUSINESS_OWNER')
    OR NULLIF(TRIM(business_name), '') IS NOT NULL
  ),
  CONSTRAINT kyc_employment_other_required CHECK (
    employment_status <> 'OTHER' OR NULLIF(TRIM(other_details), '') IS NOT NULL
  )
);

-- ------------------------------------------------------------
-- 7. kyc_financial_information — Step 4 (financial half)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_financial_information (
  application_id          TEXT PRIMARY KEY REFERENCES kyc_applications(id) ON DELETE CASCADE,
  estimated_monthly_income  NUMERIC(14,2) NOT NULL,
  estimated_monthly_expenses NUMERIC(14,2) NOT NULL,
  source_of_income         TEXT NOT NULL,
  source_of_funds          TEXT NOT NULL,
  source_of_funds_other    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- §6: numerical values must be validated, and negatives are not income.
  CONSTRAINT kyc_financial_income_non_negative  CHECK (estimated_monthly_income  >= 0),
  CONSTRAINT kyc_financial_expenses_non_negative CHECK (estimated_monthly_expenses >= 0),
  CONSTRAINT kyc_financial_source_of_funds_known CHECK (source_of_funds IN (
    'SALARY', 'BUSINESS', 'REMITTANCE', 'PENSION', 'ALLOWANCE',
    'FARMING', 'FISHING', 'SAVINGS', 'OTHER'
  )),
  CONSTRAINT kyc_financial_other_funds_required CHECK (
    source_of_funds <> 'OTHER' OR NULLIF(TRIM(source_of_funds_other), '') IS NOT NULL
  )
);

-- ------------------------------------------------------------
-- 8. kyc_identifications — Step 1, government ID
--
-- A client may present more than one ID (for example a primary passport plus a
-- secondary driver's licence), so the designated one is marked with is_primary
-- and a partial unique index keeps exactly one primary per application. The ID
-- number itself is masked at the edges; storing it whole is what turns a
-- breached table into an identity-theft kit.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_identifications (
  id                 BIGSERIAL PRIMARY KEY,
  application_id     TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  id_type_code       TEXT NOT NULL REFERENCES kyc_id_types(code) ON DELETE RESTRICT,
  id_number          TEXT NOT NULL,
  name_on_id         TEXT NOT NULL,
  date_of_birth_on_id DATE,
  issue_date         DATE,
  expiry_date        DATE,
  is_primary         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_identifications_expiry_after_issue
    CHECK (issue_date IS NULL OR expiry_date IS NULL OR expiry_date > issue_date),
  CONSTRAINT kyc_identifications_expiry_not_past
    CHECK (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
);

-- At most one primary ID per application: §5 requires a designated primary.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_identifications_primary
  ON kyc_identifications(application_id) WHERE is_primary;

-- ------------------------------------------------------------
-- 9. kyc_documents — Steps 5 and 6
--
-- `storage_path` is the durable location; a signed URL is minted on read and
-- never persisted, because a stored signed URL expires and silently becomes a
-- dead reference. Replacements keep `version` and point at what they replace,
-- so the previous file stays in the audit history (§13).
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_documents (
  id                  BIGSERIAL PRIMARY KEY,
  application_id      TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  borrower_id         TEXT NOT NULL REFERENCES borrowers(id) ON DELETE RESTRICT,
  document_type_code  TEXT NOT NULL REFERENCES kyc_document_types(code) ON DELETE RESTRICT,
  version             INTEGER NOT NULL DEFAULT 1,
  replaces_document_id BIGINT REFERENCES kyc_documents(id) ON DELETE SET NULL,
  is_current          BOOLEAN NOT NULL DEFAULT TRUE,

  status              kyc_document_status NOT NULL DEFAULT 'UPLOADED',
  storage_bucket      TEXT,
  storage_path        TEXT NOT NULL,
  original_filename   TEXT,
  mime_type           TEXT,
  size_bytes          INTEGER,
  checksum_sha256     TEXT,

  -- §9: what the automated check found, and what the client attested.
  quality_check       JSONB,
  quality_confirmed_at TIMESTAMPTZ,
  quality_confirmed_by TEXT,
  -- A client attestation is a claim, not a verification. It never changes
  -- `status` to ACCEPTED.
  quality_attested_text TEXT,

  -- Proof-of-address confirmation (§12)
  belongs_to_declared_address BOOLEAN,
  belongs_confirmed_at        TIMESTAMPTZ,

  reviewed_by         TEXT,
  reviewed_by_name    TEXT,
  reviewed_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  correction_reason   TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_documents_size_positive CHECK (size_bytes IS NULL OR size_bytes > 0),
  CONSTRAINT kyc_documents_path_present   CHECK (NULLIF(TRIM(storage_path), '') IS NOT NULL),
  CONSTRAINT kyc_documents_version_positive CHECK (version >= 1)
);

-- Only one current file per document type per application.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_documents_current
  ON kyc_documents(application_id, document_type_code) WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_kyc_documents_application ON kyc_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_borrower    ON kyc_documents(borrower_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_status      ON kyc_documents(status);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_type        ON kyc_documents(document_type_code);

-- ------------------------------------------------------------
-- 10. kyc_verifications — email OTP, mobile OTP, selfie
--
-- A verification row is created UNVERIFIED and only reaches PASSED by consuming
-- a correct challenge code. There is no route that sets it to PASSED directly,
-- which is what makes §29's "bypass required OTP" impossible rather than
-- merely discouraged.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id             BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  channel        kyc_verification_channel NOT NULL,
  target         TEXT NOT NULL,
  result         kyc_verification_result NOT NULL DEFAULT 'PENDING',
  provider       TEXT,
  provider_ref   TEXT,
  attempts       INTEGER NOT NULL DEFAULT 0,
  max_attempts   INTEGER NOT NULL DEFAULT 5,
  verified_at    TIMESTAMPTZ,
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_verifications_attempts_sane CHECK (attempts >= 0 AND max_attempts >= 1)
);

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_app     ON kyc_verifications(application_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_lookup  ON kyc_verifications(channel, target);

-- The actual codes live here, hashed, one row per challenge so a resend
-- invalidates the previous code.
CREATE TABLE IF NOT EXISTS kyc_verification_challenges (
  id              BIGSERIAL PRIMARY KEY,
  verification_id BIGINT NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
  code_hash       TEXT NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  attempts        INTEGER NOT NULL DEFAULT 0,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_challenges_verification ON kyc_verification_challenges(verification_id);
-- Only the newest unconsumed challenge for a verification is usable.
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_challenges_active
  ON kyc_verification_challenges(verification_id) WHERE consumed_at IS NULL;

-- ------------------------------------------------------------
-- 11. kyc_reviews / kyc_corrections — staff side (§19–23)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_reviews (
  id             BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  reviewer_id    TEXT NOT NULL,
  reviewer_name  TEXT NOT NULL,
  reviewer_role  TEXT,
  branch_id      TEXT,
  decision       kyc_decision NOT NULL,
  checklist      JSONB,
  notes          TEXT,
  -- Mandatory for REJECT and SUSPEND; enforced in 0022 by trigger.
  reason         TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_reviews_application ON kyc_reviews(application_id);
CREATE INDEX IF NOT EXISTS idx_kyc_reviews_reviewer    ON kyc_reviews(reviewer_id);

CREATE TABLE IF NOT EXISTS kyc_corrections (
  id              BIGSERIAL PRIMARY KEY,
  application_id  TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  review_id       BIGINT REFERENCES kyc_reviews(id) ON DELETE SET NULL,
  section_key     kyc_section_key NOT NULL,
  target_kind     TEXT NOT NULL CHECK (target_kind IN ('FIELD', 'DOCUMENT')),
  -- Column name for FIELD; document type code for DOCUMENT.
  target_ref      TEXT NOT NULL,
  reason          TEXT NOT NULL,
  required_action TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT,
  resolution_note TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_corrections_application ON kyc_corrections(application_id);
CREATE INDEX IF NOT EXISTS idx_kyc_corrections_open       ON kyc_corrections(application_id) WHERE status = 'OPEN';

-- ------------------------------------------------------------
-- 12. kyc_consents — the client's actual acceptances (§15)
--
-- A row is written only when the client acts. The templates carry the wording
-- and version; these rows carry the acceptance, timestamped, with request
-- metadata. "Do not pre-check these checkboxes" is enforced by there being no
-- API that can set is_accepted without a fresh, timestamped request.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_consents (
  id            BIGSERIAL PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES kyc_applications(id) ON DELETE CASCADE,
  consent_key   TEXT NOT NULL REFERENCES kyc_consent_templates(key) ON DELETE RESTRICT,
  version       INTEGER NOT NULL,
  label         TEXT NOT NULL,
  is_accepted   BOOLEAN NOT NULL,
  accepted_at   TIMESTAMPTZ,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (application_id, consent_key, version)
);

-- ------------------------------------------------------------
-- 13. kyc_audit_logs — append-only (§26)
--
-- Every meaningful action lands here. Enforced INSERT-only in 0022 by revoking
-- UPDATE and DELETE and adding a raising trigger, so neither a client nor a
-- staff account can rewrite or erase history.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_audit_logs (
  id              BIGSERIAL PRIMARY KEY,
  application_id  TEXT REFERENCES kyc_applications(id) ON DELETE SET NULL,
  borrower_id     TEXT NOT NULL,
  actor_id        TEXT,
  actor_role      TEXT,
  actor_name      TEXT,
  action          TEXT NOT NULL,
  previous_status kyc_status,
  new_status      kyc_status,
  target_kind     TEXT,
  target_ref      TEXT,
  reason          TEXT,
  metadata        JSONB,
  ip_address      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_borrower     ON kyc_audit_logs(borrower_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_application  ON kyc_audit_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_action      ON kyc_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_created     ON kyc_audit_logs(created_at DESC);

-- ------------------------------------------------------------
-- 14. Action vocabulary
--
-- Constraining `action` means an audit log cannot contain a typo'd or invented
-- action that a compliance query would silently miss.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_audit_actions (
  action      TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  actor       TEXT NOT NULL CHECK (actor IN ('CLIENT', 'STAFF', 'SYSTEM'))
);

INSERT INTO kyc_audit_actions (action, description, actor) VALUES
  ('KYC_STARTED',            'Client opened the KYC process',                      'CLIENT'),
  ('SECTION_SAVED',          'Client autosaved a step',                             'CLIENT'),
  ('SECTION_COMPLETED',      'A step passed validation and was marked complete',     'CLIENT'),
  ('CONTACT_VERIFICATION_SENT', 'An OTP challenge was dispatched',                   'SYSTEM'),
  ('CONTACT_VERIFIED',       'A contact channel was OTP-verified',                   'SYSTEM'),
  ('DOCUMENT_UPLOADED',      'Client uploaded a document',                          'CLIENT'),
  ('DOCUMENT_REPLACED',      'Client replaced a document in response to a correction','CLIENT'),
  ('DOCUMENT_REVIEWED',      'Staff accepted, rejected, or requested a correction',  'STAFF'),
  ('DECLARATIONS_ACCEPTED',  'Client accepted the required declarations',            'CLIENT'),
  ('KYC_SUBMITTED',          'KYC submitted for staff review',                      'CLIENT'),
  ('KYC_REVIEWED',           'Staff opened the application for review',             'STAFF'),
  ('CORRECTION_REQUESTED',   'Staff asked the client for a specific correction',     'STAFF'),
  ('CORRECTION_RESOLVED',    'The client resolved an open correction',               'CLIENT'),
  ('KYC_APPROVED',           'KYC approved; KYC-dependent services unlocked',        'STAFF'),
  ('KYC_REJECTED',           'KYC rejected with a recorded reason',                 'STAFF'),
  ('KYC_SUSPENDED',          'An approved KYC was suspended',                       'STAFF'),
  ('RESUBMISSION_GRANTED',   'Staff authorised resubmission after rejection',        'STAFF'),
  ('INFORMATION_UPDATED',    'A verified value changed, opening a change request',  'STAFF'),
  ('KYC_LOCKED',             'A reviewer claimed the application',                  'STAFF'),
    ('KYC_UNLOCKED',           'A reviewer released their claim',                     'STAFF'),
    ('KYC_MIGRATED',           'Legacy JSONB record backfilled into the normalised model', 'SYSTEM')
  ON CONFLICT (action) DO NOTHING;


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kyc_audit_logs_action_fk'
  ) THEN
    ALTER TABLE kyc_audit_logs
      ADD CONSTRAINT kyc_audit_logs_action_fk
      FOREIGN KEY (action) REFERENCES kyc_audit_actions(action) ON DELETE RESTRICT;
  END IF;
END
$$;

-- Declared inline on kyc_contacts as a bare BIGINT because the challenges table
-- is defined further down this file. Added here, where the dependency can be
-- satisfied.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'kyc_contacts_email_verification_fk'
  ) THEN
    ALTER TABLE kyc_contacts
      ADD CONSTRAINT kyc_contacts_email_verification_fk
      FOREIGN KEY (email_verification_id)
      REFERENCES kyc_verification_challenges(id) ON DELETE SET NULL;
  END IF;
END
$$;
