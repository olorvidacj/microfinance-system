-- ============================================================
-- 0019 — KYC CORE: enums, configuration tables, geography
--
-- First half of the normalised KYC schema. This file creates:
--   * the 8 KYC status values from the specification as a real enum
--   * the Philippine administrative geography tables (PSGC)
--
-- Requires: 0018
-- The data tables (applications, sections, documents, reviews, …) follow in
-- 0020, and the legacy JSONB backfill + status remap in 0021.
-- ============================================================

-- ------------------------------------------------------------
-- 1. KYC status enum
--
-- The specification defines exactly eight client-visible states. The previous
-- schema stored status as unconstrained TEXT, which allowed any string and let
-- the code drift into three incompatible vocabularies across the web portal,
-- the branch desk and the mobile app. A real enum makes an illegal state
-- unrepresentable.
--
-- 0001 already created a lowercase kyc_status ('pending','verified','rejected',
-- 'expired') used solely by client_kyc.verification_status. client_kyc is the
-- modern-generation schema that no code path writes to, so we retire its enum
-- rather than build the live model on a name that means something else. The
-- dead tables are left in place; see docs/KYC_FLOW.md for the removal ticket.
-- ------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
    -- Only rename the lowercase legacy enum. If it already has uppercase
    -- members it is the live one and must be left alone.
    IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
                WHERE t.typname = 'kyc_status' AND e.enumlabel = 'verified') THEN
      EXECUTE 'ALTER TYPE kyc_status RENAME TO legacy_kyc_status';
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'legacy_kyc_status') THEN
        EXECUTE 'COMMENT ON TYPE legacy_kyc_status IS
          ''Retired: was client_kyc.verification_status in the unused modern-generation schema (migrations 0001-0010). Superseded by kyc_status in 0019.''';
      END IF;
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_status') THEN
    CREATE TYPE kyc_status AS ENUM (
      'NOT_STARTED',    -- account exists, KYC never opened
      'IN_PROGRESS',    -- client is working through the steps
      'SUBMITTED',      -- client submitted; awaiting staff
      'UNDER_REVIEW',   -- staff picked it up
      'CORRECTION_REQUIRED', -- staff asked for specific fixes
      'APPROVED',       -- verified; unlocks KYC-dependent services
      'REJECTED',       -- refused; reason recorded
      'SUSPENDED'       -- previously approved, now held
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_document_status') THEN
    CREATE TYPE kyc_document_status AS ENUM (
      'NOT_UPLOADED',
      'UPLOADED',
      'UNDER_REVIEW',
      'ACCEPTED',
      'REJECTED',
      'CORRECTION_REQUIRED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_verification_result') THEN
    CREATE TYPE kyc_verification_result AS ENUM (
      'PENDING',
      'PASSED',
      'FAILED',
      'MANUAL_REVIEW'   -- no automated verdict; a human must decide (§10)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_verification_channel') THEN
    CREATE TYPE kyc_verification_channel AS ENUM (
      'EMAIL',
      'MOBILE',
      'SELFIE',
      'DOCUMENT'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_decision') THEN
    CREATE TYPE kyc_decision AS ENUM (
      'UNDER_REVIEW',
      'APPROVE',
      'REJECT',
      'SUSPEND'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kyc_section_key') THEN
    CREATE TYPE kyc_section_key AS ENUM (
      'PERSONAL',
      'ADDRESS',
      'CONTACT',
      'FINANCIAL',
      'IDENTIFICATION',
      'DOCUMENTS',
      'DECLARATIONS'
    );
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 2. Philippine geography (PSGC)
--
-- Sourced from database/data/psgc/PSGC_*.json — see that directory's README.
-- These tables are the authority for the address cascade (§4, §32). They hold
-- no client data; they are reference data, replaced wholesale on re-import.
--
-- NCR is modelled honestly: it has no provinces. Its 17 LGUs sit in
-- psgc_cities with province_code NULL, and the address form hides the Province
-- field for exactly those rows. Two administratively independent cities
-- (Isabela, Cotabato) are likewise province-less.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS psgc_regions (
  code        CHAR(2) PRIMARY KEY,           -- PSA 01..17, 40, 41, 42
  name        TEXT NOT NULL,
  long_name   TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS psgc_provinces (
  code        CHAR(4) PRIMARY KEY,           -- PSA 4-digit province code
  region_code CHAR(2) NOT NULL REFERENCES psgc_regions(code) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  long_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psgc_provinces_region
  ON psgc_provinces(region_code);

CREATE TABLE IF NOT EXISTS psgc_cities (
  code                CHAR(6) PRIMARY KEY,   -- PSA 6-digit city/municipality code
  region_code         CHAR(2) NOT NULL REFERENCES psgc_regions(code) ON DELETE CASCADE,
  province_code       CHAR(4) REFERENCES psgc_provinces(code) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  long_name           TEXT,
  short_name          TEXT,
  is_city             BOOLEAN NOT NULL DEFAULT FALSE,
  is_capital          BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE for LGUs that sit directly under a region (NCR's 17 LGUs, Isabela,
  -- Cotabato). The address form suppresses Province for these.
  is_regional_district BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- An LGU with a province must belong to that province's region, so the address
-- cascade Region -> Province -> City -> Barangay is always coherent and a bad
-- import cannot produce an unhierarchical tree.
--
-- This has to be a trigger, not a CHECK: PostgreSQL forbids subqueries in CHECK
-- constraints, and the cross-row lookup is the whole point. The alternative --
-- trusting the importer to pass region/province pairs that agree -- is exactly
-- the sort of invariant that erodes once a second importer is added.
CREATE OR REPLACE FUNCTION psgc_cities_enforce_region_province()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_province_region CHAR(2);
BEGIN
  IF NEW.province_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.region_code INTO v_province_region
    FROM psgc_provinces p
   WHERE p.code = NEW.province_code;

  IF v_province_region IS NULL THEN
    RAISE EXCEPTION
      'psgc_cities.province_code % does not exist in psgc_provinces', NEW.province_code
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF btrim(v_province_region) IS DISTINCT FROM btrim(NEW.region_code) THEN
    RAISE EXCEPTION
      'psgc_cities % (region %) has province_code % which belongs to region %, not %',
      NEW.code, btrim(NEW.region_code), NEW.province_code, btrim(v_province_region), btrim(NEW.region_code)
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psgc_cities_region_province ON psgc_cities;
CREATE TRIGGER trg_psgc_cities_region_province
  BEFORE INSERT OR UPDATE OF region_code, province_code ON psgc_cities
  FOR EACH ROW EXECUTE FUNCTION psgc_cities_enforce_region_province();

CREATE INDEX IF NOT EXISTS idx_psgc_cities_region   ON psgc_cities(region_code);
CREATE INDEX IF NOT EXISTS idx_psgc_cities_province ON psgc_cities(province_code);
CREATE INDEX IF NOT EXISTS idx_psgc_cities_name     ON psgc_cities(lower(name));

CREATE TABLE IF NOT EXISTS psgc_barangays (
  code        CHAR(9) PRIMARY KEY,           -- PSA 9-digit barangay code
  city_code   CHAR(6) NOT NULL REFERENCES psgc_cities(code) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  search_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psgc_barangays_city ON psgc_barangays(city_code);
CREATE INDEX IF NOT EXISTS idx_psgc_barangays_name ON psgc_barangays(lower(name));

-- Postal codes are resolved to barangay level, but a few LGUs share one code.
-- Both columns are therefore nullable keys rather than a single owner.
CREATE TABLE IF NOT EXISTS psgc_postal_codes (
  id            BIGSERIAL PRIMARY KEY,
  postal_code   CHAR(4) NOT NULL,
  region_code   CHAR(2) REFERENCES psgc_regions(code) ON DELETE CASCADE,
  province_code CHAR(4) REFERENCES psgc_provinces(code) ON DELETE CASCADE,
  city_code     CHAR(6) REFERENCES psgc_cities(code) ON DELETE CASCADE,
  barangay_code CHAR(9) REFERENCES psgc_barangays(code) ON DELETE CASCADE,
  area_name     TEXT,
  UNIQUE (postal_code, city_code, barangay_code)
);

CREATE INDEX IF NOT EXISTS idx_psgc_postal_barangay ON psgc_postal_codes(barangay_code);
CREATE INDEX IF NOT EXISTS idx_psgc_postal_city     ON psgc_postal_codes(city_code);
CREATE INDEX IF NOT EXISTS idx_psgc_postal_region   ON psgc_postal_codes(region_code);
CREATE INDEX IF NOT EXISTS idx_psgc_postal_value    ON psgc_postal_codes(postal_code);

-- ------------------------------------------------------------
-- 3. Staff-configurable requirement tables
--
-- §7: the accepted government ID list must be configurable by authorised staff.
-- §11: supporting-document requirements depend on the client's declared
--      situation, hence applies_when.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_id_types (
  code                  TEXT PRIMARY KEY,
  label                 TEXT NOT NULL,
  description           TEXT,
  requires_issue_date   BOOLEAN NOT NULL DEFAULT FALSE,
  requires_expiry_date  BOOLEAN NOT NULL DEFAULT FALSE,
  requires_birth_date   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Philippine IDs carry a pattern; the server validates the shape so a
  -- mistyped number is caught before it reaches a reviewer.
  number_pattern        TEXT,
  pattern_hint          TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_document_types (
  code            TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  description     TEXT,
  requirement     TEXT NOT NULL DEFAULT 'REQUIRED'
                    CHECK (requirement IN ('REQUIRED', 'OPTIONAL')),
  -- JSON predicate evaluated server-side against the saved sections. Example:
  --   {"all":[{"section":"EMPLOYMENT","field":"employmentStatus",
  --             "in":["EMPLOYED","PRIVATE_EMPLOYEE","GOVERNMENT_EMPLOYEE"]}]}
  -- An empty/absent object means the document is always required.
  applies_when    JSONB,
  accepts_pdf     BOOLEAN NOT NULL DEFAULT FALSE,
  max_size_bytes  INTEGER NOT NULL DEFAULT 10485760,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kyc_config (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §5 / §16: whether an unverified contact blocks submission. Default-on for
-- email (the delivery channel that actually exists); mobile stays off until an
-- SMS provider is configured, so the completeness check never asserts a
-- verification that was never performed.
INSERT INTO kyc_config (key, value, description) VALUES
  ('require_email_verification', 'true'::jsonb,
   'Block KYC submission until the declared email address is OTP-verified.'),
  ('require_mobile_verification', 'false'::jsonb,
   'Block KYC submission until the mobile number is OTP-verified. Kept false until an SMS provider is configured.'),
  ('require_selfie', 'true'::jsonb,
   'Require a selfie. Without a liveness vendor the result is MANUAL_REVIEW, never PASSED.'),
  ('require_proof_of_address', 'true'::jsonb,
   'Require a supporting document evidencing the declared current address.'),
  ('require_proof_of_income', 'true'::jsonb,
   'Require a supporting document evidencing the declared income.'),
  ('resubmission_after_rejection', 'true'::jsonb,
   'Allow a client to correct and resubmit after a rejection (§23).'),
  ('lock_ttl_minutes', '30'::jsonb,
   'How long a reviewer claim on an application blocks other reviewers (§17.8).')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Default requirement catalogues
--
-- Seeded so a fresh environment has a working policy; staff can edit every row
-- from the admin screen, and the client flow reads whatever is active.
-- ------------------------------------------------------------

INSERT INTO kyc_id_types (code, label, description, requires_issue_date, requires_expiry_date, requires_birth_date, number_pattern, pattern_hint, sort_order)
VALUES
  ('PHILSYS_ID',   'Philippine National ID (PhilSys / PhilID)',
   'The 12-digit PhilSys identification number issued to Filipino citizens.',
   FALSE, FALSE, TRUE, '^[0-9]{4}-?[0-9]{4}-?[0-9]{4}-?[0-9]{4}$',
   '12 digits, e.g. 1234-5678-9012-3456', 1),
  ('PASSPORT',     'Passport',
   'Philippine passport. Validity must extend at least six months past the loan term.',
   TRUE, TRUE, TRUE, '^[A-Za-z]{1,2}[0-9]{7}[A-Za-z]?$',
   'e.g. P1234567A', 2),
  ('DRIVERS_LICENSE', 'Driver''s License',
   'LTO-issued licence, preferably with a photo and signature.',
   FALSE, TRUE, TRUE, '^[A-Za-z0-9]{9,13}$',
   '9 to 13 alphanumeric characters', 3),
  ('UMID',         'UMID (Unified Multi-Purpose ID)',
   'SSS-issued Unified Multi-Purpose ID card.',
   FALSE, FALSE, TRUE, '^[0-9]{14}$',
   '14 digits', 4),
  ('OTHER_GOVT_ID','Other Accepted Government-Issued ID',
   'Any other government-issued ID accepted by HOSCOMO policy. Staff decide on review.',
   FALSE, FALSE, FALSE, NULL,
   'Enter the number exactly as printed', 5)
ON CONFLICT (code) DO NOTHING;

INSERT INTO kyc_document_types (code, label, description, requirement, applies_when, accepts_pdf, sort_order)
VALUES
  ('PROOF_OF_ADDRESS', 'Proof of Address',
   'Barangay clearance, utility bill, or lease agreement dated within the last three months and showing your complete current address.',
   'REQUIRED', NULL, TRUE, 10),
  ('PROOF_OF_INCOME', 'Proof of Income',
   'Recent payslip, ITR, or bank statement evidencing your regular income.',
   'REQUIRED',
   '{"any":[{"section":"EMPLOYMENT","field":"employmentStatus","in":["EMPLOYED","PRIVATE_EMPLOYEE","GOVERNMENT_EMPLOYEE"]}]}'::jsonb,
   TRUE, 20),
  ('BUSINESS_PERMIT', 'Business Permit / Registration',
   'DTI or LGU business permit, or the BIR registration certificate, evidencing your registered business.',
   'REQUIRED',
   '{"any":[{"section":"EMPLOYMENT","field":"employmentStatus","in":["SELF_EMPLOYED","BUSINESS_OWNER"]}]}'::jsonb,
   TRUE, 30),
  ('SELFIE', 'Selfie with Government ID',
   'A clear, well-lit photo of your face. Held beside your government ID. Reviewed by staff.',
   'REQUIRED', NULL, FALSE, 40)
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 5. Consent catalogue
--
-- §15: five declarations plus the statutory privacy notice under RA 10173.
-- Stored as rows so wording and version are auditable — a client accepted
-- version 1 of the privacy notice, not an unversioned string.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_consent_templates (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  body        TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO kyc_consent_templates (key, label, body, version, is_required, sort_order)
VALUES
  ('TRUTHFUL_INFORMATION',
   'Information is true and accurate',
   'I declare that the information I have provided is true, complete, and accurate, and that I have not withheld or falsified any part of it.',
   1, TRUE, 1),
  ('DOCUMENT_OWNERSHIP',
   'Documents belong to me',
   'I declare that every document I have submitted is mine, or is legitimately related to me and submitted with my consent.',
   1, TRUE, 2),
  ('AUTHORISED_REVIEW',
   'Authorised staff may review my information',
   'I understand that HOSCOMO Microfinance Cooperative personnel, and any authority it is required to report to, may review the information and documents I have submitted.',
   1, TRUE, 3),
  ('PRIVACY_NOTICE',
   'Privacy and data-processing notice',
   'I have read and understood HOSCOMCO''s privacy and data-processing notice, and I consent to the collection, use, retention, and processing of my personal data for the purpose of verification, credit assessment, and regulatory compliance, in accordance with the Data Privacy Act of 2012 (RA 10173).',
   1, TRUE, 4),
  ('FALSE_INFO_PENALTY',
   'Consequences of false information',
   'I understand that providing false or misleading information may result in rejection of this application, suspension of my membership, and any further action HOSCOMCO is entitled to take under its policies and applicable law.',
   1, TRUE, 5)
ON CONFLICT (key) DO UPDATE SET
  label  = EXCLUDED.label,
  body   = EXCLUDED.body,
  version= EXCLUDED.version;
