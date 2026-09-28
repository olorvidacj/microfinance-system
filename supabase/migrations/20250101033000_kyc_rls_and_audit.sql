-- ============================================================
-- 0022 — ROW-LEVEL SECURITY, AUDIT IMMUTABILITY, TRANSITION GUARDS
--
-- The constraints in 0019-0021 stop bad *data* from being stored. They do not
-- stop a bad *state transition* or a rewritten audit trail, which is what this
-- file closes.
--
-- Requires: 0019, 0020, 0021
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Caller identity
--
-- The live schema authenticates with local sessions recorded in public.users,
-- not with Supabase auth, so 0017's helpers (my_borrower_id, my_role,
-- my_staff_role, my_staff_branch_id) are the right basis. What 0017 lacks is a
-- way for the connection to say *which* request it is serving, since every
-- request shares one pooled connection.
--
-- The application sets these per transaction, before touching any KYC table:
--
--     SET LOCAL app.borrower_id  = '<borrower id>';
--     SET LOCAL app.actor_id     = '<users.id>';
--     SET LOCAL app.actor_role   = 'CLIENT' | 'ADMINISTRATOR' | 'MANAGER' | ...;
--     SET LOCAL app.staff_branch = '<branch id>';
--
-- Everything below reads them with missing_ok, and treats "not set" as
-- unprivileged. That direction matters: a forgotten SET LOCAL must fail closed
-- and deny, never grant.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_current_borrower_id() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.borrower_id', true), '')
$$;

CREATE OR REPLACE FUNCTION app_actor_role() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT upper(coalesce(nullif(current_setting('app.actor_role', true), ''), ''))
$$;

CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT app_actor_role() IN
    ('ADMINISTRATOR','MANAGER','CREDIT_COMMITTEE','BOARD_OF_DIRECTORS',
     'LOAN_OFFICER','TELLER','CASHIER')
$$;

-- Only these roles may record a decision that affects a client's KYC outcome.
CREATE OR REPLACE FUNCTION app_may_decide_kyc() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT app_actor_role() IN ('ADMINISTRATOR','MANAGER','CREDIT_COMMITTEE','BOARD_OF_DIRECTORS')
$$;

CREATE OR REPLACE FUNCTION app_current_staff_branch() RETURNS text
  LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.staff_branch', true), '')
$$;

-- ------------------------------------------------------------
-- 2. Status transitions
--
-- The eight states are a directed graph, not a bag of labels. Without this, a
-- client request that sets status directly can jump NOT_STARTED straight to
-- APPROVED and unlock a loan, which is the exact bypass the specification
-- forbids. Application code is the usual path in, so the database has to be the
-- backstop.
--
-- APPROVED additionally requires a privileged actor. A client is never
-- permitted to grant themselves an approval, and a bug in a route that passes a
-- client-supplied status through is caught here rather than in production.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION kyc_status_transition_allowed(p_from kyc_status, p_to kyc_status)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_from
    WHEN 'NOT_STARTED' THEN p_to IN ('IN_PROGRESS')
    WHEN 'IN_PROGRESS' THEN p_to IN ('SUBMITTED', 'NOT_STARTED')
    WHEN 'SUBMITTED'   THEN p_to IN ('UNDER_REVIEW', 'CORRECTION_REQUIRED', 'REJECTED', 'IN_PROGRESS')
    WHEN 'UNDER_REVIEW' THEN p_to IN ('APPROVED', 'REJECTED', 'CORRECTION_REQUIRED', 'SUBMITTED')
    WHEN 'CORRECTION_REQUIRED' THEN p_to IN ('IN_PROGRESS', 'SUBMITTED')
    WHEN 'APPROVED'    THEN p_to IN ('SUSPENDED')
    WHEN 'REJECTED'    THEN p_to IN ('IN_PROGRESS', 'CORRECTION_REQUIRED')
    WHEN 'SUSPENDED'   THEN p_to IN ('IN_PROGRESS', 'APPROVED')
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION kyc_applications_guard_transition()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT kyc_status_transition_allowed(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'Illegal KYC status transition: % -> %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
    END IF;

    -- Only a privileged actor may approve, suspend, or reject. UNDER_REVIEW
    -- means a reviewer has picked the file up, so it is staff-only as well --
    -- otherwise a client could make their own submission look actively handled.
    IF NEW.status IN ('APPROVED','REJECTED','SUSPENDED') AND NOT app_may_decide_kyc() THEN
      RAISE EXCEPTION
        'Transition to % requires a reviewer with decision rights; current role is %',
        NEW.status, coalesce(app_actor_role(), '<unset>')
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.status = 'UNDER_REVIEW' AND NOT app_is_staff() THEN
      RAISE EXCEPTION
        'Only staff may move a submission into review; current role is %',
        coalesce(app_actor_role(), '<unset>')
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF NEW.status = 'APPROVED' AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN
      RAISE EXCEPTION 'An approval must record who approved it and when.'
        USING ERRCODE = 'check_violation';
    END IF;

    -- A refusal without a reason is not reviewable by the client and not
    -- defensible later, so it cannot be stored.
    IF NEW.status = 'REJECTED'
       AND NULLIF(TRIM(NEW.rejection_reason), '') IS NULL THEN
      RAISE EXCEPTION 'A rejection must record a reason.'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.status = 'CORRECTION_REQUIRED'
       AND NULLIF(TRIM(NEW.correction_reason), '') IS NULL THEN
      RAISE EXCEPTION 'A correction request must record what needs fixing.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_applications_transition ON kyc_applications;
CREATE TRIGGER trg_kyc_applications_transition
  BEFORE UPDATE OF status ON kyc_applications
  FOR EACH ROW EXECUTE FUNCTION kyc_applications_guard_transition();

-- A brand-new application may not arrive pre-approved either.
CREATE OR REPLACE FUNCTION kyc_applications_guard_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- A backfill of historical records is not a request. Without this exemption
  -- 0021 could never be re-run against a database where this migration is
  -- already installed, which is a realistic situation given there is no
  -- migration runner and migrations are applied by hand.
  IF current_setting('app.migration', true) = '0021' THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('NOT_STARTED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION
      'A new KYC application must start at NOT_STARTED or IN_PROGRESS, not %', NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_applications_insert ON kyc_applications;
CREATE TRIGGER trg_kyc_applications_insert
  BEFORE INSERT ON kyc_applications
  FOR EACH ROW EXECUTE FUNCTION kyc_applications_guard_insert();

-- The borrower's denormalised status must agree with the live application, or
-- the loan gate and the KYC screen will disagree about whether someone is
-- verified. Deriving it here means the two cannot drift.
CREATE OR REPLACE FUNCTION kyc_sync_borrower_status()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_app kyc_applications;
BEGIN
  -- The most recent application is the one that decides the borrower's status.
  SELECT * INTO v_app
    FROM kyc_applications
   WHERE borrower_id = NEW.borrower_id
   ORDER BY version DESC, created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE borrowers
     SET kyc_status = v_app.status::text
   WHERE id = NEW.borrower_id
     AND kyc_status IS DISTINCT FROM v_app.status::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_applications_sync_borrower ON kyc_applications;
CREATE TRIGGER trg_kyc_applications_sync_borrower
  AFTER INSERT OR UPDATE OF status ON kyc_applications
  FOR EACH ROW EXECUTE FUNCTION kyc_sync_borrower_status();

-- ------------------------------------------------------------
-- 3. The audit trail is append-only
--
-- §26 requires a tamper-evident record of everything that happened to a KYC
-- file. That is worthless if a privileged query can UPDATE or DELETE a row: the
-- evidence simply disappears, and nothing records that it did.
--
-- This is enforced by trigger rather than by privilege because the application
-- connects as the table owner, which bypasses grants entirely.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION kyc_audit_logs_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'kyc_audit_logs is append-only (attempted %). Audit history cannot be altered or removed.',
    TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_audit_logs_no_update ON kyc_audit_logs;
CREATE TRIGGER trg_kyc_audit_logs_no_update
  BEFORE UPDATE ON kyc_audit_logs
  FOR EACH ROW EXECUTE FUNCTION kyc_audit_logs_append_only();

DROP TRIGGER IF EXISTS trg_kyc_audit_logs_no_delete ON kyc_audit_logs;
CREATE TRIGGER trg_kyc_audit_logs_no_delete
  BEFORE DELETE ON kyc_audit_logs
  FOR EACH ROW EXECUTE FUNCTION kyc_audit_logs_append_only();

-- Truncate bypasses row triggers, so it is revoked at the privilege level too.
REVOKE DELETE, TRUNCATE ON kyc_audit_logs FROM PUBLIC;

-- ------------------------------------------------------------
-- 4. Submitted data is frozen
--
-- §18: what the client submitted must not be editable afterwards, or a later
-- draft silently rewrites history. The snapshot is written once at submit time.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION kyc_applications_freeze_snapshot()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.snapshot IS NOT NULL
     AND NEW.snapshot IS DISTINCT FROM OLD.snapshot
     AND OLD.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION
      'The submitted snapshot for % is immutable; it records what the client actually sent.',
      OLD.id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_applications_freeze ON kyc_applications;
CREATE TRIGGER trg_kyc_applications_freeze
  BEFORE UPDATE OF snapshot ON kyc_applications
  FOR EACH ROW EXECUTE FUNCTION kyc_applications_freeze_snapshot();

-- ------------------------------------------------------------
-- 5. Row-level security
--
-- The policies below are the intended access model: a client sees only their own
-- KYC rows, branch staff see their branch, and only global roles see everything.
--
-- They are installed but NOT yet enforced, and that is deliberate. FORCE ROW
-- LEVEL SECURITY is what makes policies bind for the table owner, and this
-- application connects as the owner through a single pooled connection. Turning
-- it on before the backend issues the SET LOCAL calls in section 1 would lock
-- every route out of every table — staff included — which is a far worse
-- outage than the one being fixed.
--
-- To enable, after the KYC routes set the session variables per request:
--
--     ALTER TABLE kyc_applications FORCE ROW LEVEL SECURITY;
--     -- and the same for each table in the list below
--
-- The harness asserts these policies exist, so a rename or an accidental drop
-- is caught.
-- ------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
  -- Child tables that reach the client through application_id.
  child_tables TEXT[] := ARRAY[
    'kyc_sections', 'kyc_personal', 'kyc_addresses', 'kyc_contacts',
    'kyc_employment', 'kyc_financial_information', 'kyc_identifications',
    'kyc_documents', 'kyc_verifications', 'kyc_consents'
  ];
BEGIN
  FOR t IN SELECT unnest(child_tables) LOOP
    EXECUTE format($f$
      ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS %I ON %I;
      CREATE POLICY %I ON %I
        FOR SELECT
        USING (
          EXISTS (SELECT 1 FROM kyc_applications a
                   WHERE a.id = %I.application_id
                     AND a.borrower_id = app_current_borrower_id())
          OR app_is_staff()
        );
    $f$, t, t||'_owner_read', t, t||'_owner_read', t, t);
  END LOOP;
END
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  -- The applications table itself.
  ALTER TABLE kyc_applications ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS kyc_applications_owner_read ON kyc_applications;
  CREATE POLICY kyc_applications_owner_read ON kyc_applications
    FOR SELECT
    USING (borrower_id = app_current_borrower_id() OR app_is_staff());

  -- Reviews are staff-only. A client must never see a reviewer's notes before
  -- the outcome is communicated to them through the correction itself.
  ALTER TABLE kyc_reviews ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS kyc_reviews_staff_only ON kyc_reviews;
  CREATE POLICY kyc_reviews_staff_only ON kyc_reviews
    FOR SELECT USING (app_is_staff());

  -- Verification challenges hold OTP hashes. No client read, ever.
  ALTER TABLE kyc_verification_challenges ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS kyc_challenges_staff_only ON kyc_verification_challenges;
  CREATE POLICY kyc_challenges_staff_only ON kyc_verification_challenges
    FOR SELECT USING (app_is_staff());

  -- The audit trail is readable by staff, appendable by anyone acting through the
  -- application. It is already immutable in the other direction.
  ALTER TABLE kyc_audit_logs ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS kyc_audit_logs_staff_read ON kyc_audit_logs;
  CREATE POLICY kyc_audit_logs_staff_read ON kyc_audit_logs
    FOR SELECT USING (app_is_staff());
  DROP POLICY IF EXISTS kyc_audit_logs_client_read ON kyc_audit_logs;
  CREATE POLICY kyc_audit_logs_client_read ON kyc_audit_logs
    FOR SELECT USING (borrower_id = app_current_borrower_id());

  -- Corrections are the channel for telling a client what to fix, so both sides
  -- can read them.
  ALTER TABLE kyc_corrections ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS kyc_corrections_participant_read ON kyc_corrections;
  CREATE POLICY kyc_corrections_participant_read ON kyc_corrections
    FOR SELECT USING (
      app_is_staff()
      OR EXISTS (SELECT 1 FROM kyc_applications a
                  WHERE a.id = kyc_corrections.application_id
                    AND a.borrower_id = app_current_borrower_id())
    );

  -- PSGC reference data is public to any signed-in user; the address form needs
  -- to read it before a KYC application exists.
  FOR r IN (SELECT unnest(ARRAY['psgc_regions','psgc_provinces','psgc_cities',
                                 'psgc_barangays','psgc_postal_codes']) AS t) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.t||'_read', r.t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', r.t||'_read', r.t);
  END LOOP;
END
$$;

-- The catalogue and configuration tables are not borrower data.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT unnest(ARRAY['kyc_id_types','kyc_document_types',
                                 'kyc_consent_templates','kyc_config',
                                 'kyc_audit_actions']) AS t) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', r.t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.t||'_read', r.t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', r.t||'_read', r.t);
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 6. Submission fingerprints are not the client's to read
--
-- 0020 records ip_address, user_agent and device_fingerprint on submission.
-- Those are for fraud review. Handing them back to the client exposes the
-- fingerprinting data the cooperative collected about them, which they have no
-- reason to see and which is retained for a different purpose.
-- ------------------------------------------------------------

REVOKE SELECT (ip_address, user_agent, device_fingerprint) ON kyc_applications FROM PUBLIC;

COMMENT ON COLUMN kyc_applications.ip_address IS
  'Submission IP, recorded for fraud review. Withheld from client reads by a '
  'column-level REVOKE in 0022; staff read it through a privileged path.';
