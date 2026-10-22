-- ============================================================
-- 0023 - KYC WORKFLOW HARDENING
--
-- Idempotent. Safe to re-run. Additive: no column, table or row is dropped.
-- Rollback: database/migrations/rollback/0023_kyc_workflow_hardening.down.sql
--
-- Builds on the tables the application actually uses (kyc_submissions,
-- kyc_documents, kyc_audit_log, kyc_required_documents; see initDb.ts). It does
-- NOT depend on 0019-0022, which describe an alternative normalised model that
-- has never been applied to the live database and conflicts with these tables
-- (0020 renames kyc_documents). Do not apply 0019-0022 on top of this.
--
-- What it does:
--   1. Adds the columns the hardened KYC service writes (reference number,
--      confirmed ID details, machine-read results, consent records, reviewer
--      claim, correction sections, ...), and an append-only table of frozen
--      submission snapshots so every version a reviewer saw is kept.
--   2. Enforces the status graph from shared/kyc/status.ts in the database:
--      a status can only change through the KYC service (which sets
--      hoscomo.kyc_actor per transaction), along an allowed edge, with the
--      reviewer, timestamp and reason recorded. A reviewer cannot decide an
--      application linked to their own account. Application data is frozen
--      while a reviewer has it and after a decision.
--   3. Makes kyc_audit_log and kyc_submission_snapshots append-only.
--   4. Turns on row level security with no policies on the KYC tables and
--      revokes the Supabase anon/authenticated grants, so the public API key
--      cannot read or write KYC data through PostgREST or Realtime. The
--      backend connects as the table owner and is unaffected.
--   5. Makes the 'kyc-documents' storage bucket private again and drops the
--      "Public and authenticated can upload to kyc-documents" policy, which
--      granted anonymous read/write/delete on every object. initDb.ts had been
--      re-creating both on every boot, silently undoing 0018.
--
-- Deployment order: deploy the application code that ships with this file
-- first, then apply this migration. The previous KYC routes changed statuses
-- without setting hoscomo.kyc_actor and are refused by the guard in step 2.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Columns and tables
-- ------------------------------------------------------------

-- Columns initDb.ts self-heals; repeated here so this file also applies to a
-- database built from migrations alone.
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS contact_info JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS government_id JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS declarations JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS correction_details JSONB;

ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS submission_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS id_type TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS id_details JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS ocr_result JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS face_check JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS discrepancies JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS discrepancy_note TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS consents JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS correction_sections JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS documents_requested JSONB;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS resubmission_allowed BOOLEAN;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS appeal_allowed BOOLEAN;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS decision_reason TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS claimed_by TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS claimed_by_name TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS claimed_at TEXT;
ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS last_idempotency_key TEXT;

ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS file_size TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS document_kind TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS side TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS sha256 TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS quality JSONB;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS storage_backend TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS width INTEGER;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE kyc_documents ADD COLUMN IF NOT EXISTS superseded_at TEXT;

ALTER TABLE kyc_audit_log ADD COLUMN IF NOT EXISTS actor_type TEXT;
ALTER TABLE kyc_audit_log ADD COLUMN IF NOT EXISTS actor_user_id TEXT;
ALTER TABLE kyc_audit_log ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Every submission freezes a copy of exactly what the reviewer will see.
CREATE TABLE IF NOT EXISTS kyc_submission_snapshots (
  id                TEXT PRIMARY KEY,
  submission_id     TEXT NOT NULL,
  borrower_id       TEXT NOT NULL,
  version           INTEGER NOT NULL,
  reference_number  TEXT,
  snapshot          JSONB NOT NULL,
  sha256            TEXT NOT NULL,
  submitted_at      TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  CONSTRAINT kyc_submission_snapshots_version_uniq UNIQUE (submission_id, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_submissions_reference
  ON kyc_submissions (reference_number) WHERE reference_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_queue ON kyc_submissions (status, submitted_at);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_current ON kyc_documents (borrower_id, superseded_at);
CREATE INDEX IF NOT EXISTS idx_kyc_audit_submission ON kyc_audit_log (kyc_submission_id);
CREATE INDEX IF NOT EXISTS idx_kyc_snapshots_borrower ON kyc_submission_snapshots (borrower_id);

-- ------------------------------------------------------------
-- 2. Status graph
-- ------------------------------------------------------------

-- Mirrors normaliseKycStatus in shared/kyc/status.ts. Unknown -> NOT_STARTED,
-- never APPROVED.
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

-- The actor for the current transaction, set by the KYC service with
-- set_config('hoscomo.kyc_actor', ..., true). An unset (or reset-to-empty)
-- variable means "nobody", never "allowed".
CREATE OR REPLACE FUNCTION kyc_current_actor()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('hoscomo.kyc_actor', true), '')
$$;

-- Mirrors KYC_TRANSITIONS in shared/kyc/status.ts.
CREATE OR REPLACE FUNCTION kyc_transition_allowed(p_from text, p_to text, p_actor text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_actor = 'client' THEN
      (p_from, p_to) IN (('NOT_STARTED','IN_PROGRESS'), ('IN_PROGRESS','SUBMITTED'),
                         ('CORRECTION_REQUIRED','SUBMITTED'), ('REJECTED','IN_PROGRESS'))
    WHEN p_actor IN ('staff', 'staff_sensitive') THEN
      (p_from, p_to) IN (('SUBMITTED','UNDER_REVIEW'), ('UNDER_REVIEW','SUBMITTED'),
                         ('UNDER_REVIEW','APPROVED'), ('UNDER_REVIEW','REJECTED'),
                         ('UNDER_REVIEW','CORRECTION_REQUIRED'))
      OR (p_actor = 'staff_sensitive' AND
          (p_from, p_to) IN (('APPROVED','SUSPENDED'), ('SUSPENDED','APPROVED'),
                             ('SUSPENDED','CORRECTION_REQUIRED')))
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION kyc_blank(p text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p IS NULL OR btrim(p) = ''
$$;

CREATE OR REPLACE FUNCTION kyc_submissions_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_actor  text := kyc_current_actor();
  v_from   text;
  v_member text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM kyc_normalize_status(NEW.status) THEN
      RAISE EXCEPTION 'KYC status "%" is not canonical', NEW.status USING ERRCODE = 'check_violation';
    END IF;
    -- Registration seeds an empty application; the member creates a draft.
    IF NEW.status = 'NOT_STARTED' THEN RETURN NEW; END IF;
    IF NEW.status = 'IN_PROGRESS' AND v_actor = 'client' THEN RETURN NEW; END IF;
    -- Copying a decision that already exists on the member record (legacy
    -- in-person verification) so the workflow can act on it.
    IF v_actor = 'reconcile' AND NEW.status IN ('APPROVED','SUSPENDED','REJECTED') THEN
      SELECT kyc_normalize_status(kyc_status) INTO v_member FROM borrowers WHERE id = NEW.borrower_id;
      IF v_member = NEW.status THEN RETURN NEW; END IF;
    END IF;
    RAISE EXCEPTION 'A new KYC application cannot start as % (actor %)', NEW.status, coalesce(v_actor, '<unset>')
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_from := kyc_normalize_status(OLD.status);

  -- Application data is frozen while a reviewer has it and after a decision,
  -- unless this same update returns it to the member for editing.
  IF v_from IN ('SUBMITTED','UNDER_REVIEW','APPROVED','SUSPENDED','REJECTED')
     AND kyc_normalize_status(NEW.status) NOT IN ('IN_PROGRESS','CORRECTION_REQUIRED')
     AND (NEW.personal_info   IS DISTINCT FROM OLD.personal_info
       OR NEW.address         IS DISTINCT FROM OLD.address
       OR NEW.contact_info    IS DISTINCT FROM OLD.contact_info
       OR NEW.employment      IS DISTINCT FROM OLD.employment
       OR NEW.government_id   IS DISTINCT FROM OLD.government_id
       OR NEW.declarations    IS DISTINCT FROM OLD.declarations
       OR NEW.id_type         IS DISTINCT FROM OLD.id_type
       OR NEW.id_details      IS DISTINCT FROM OLD.id_details
       OR NEW.ocr_result      IS DISTINCT FROM OLD.ocr_result
       OR NEW.face_check      IS DISTINCT FROM OLD.face_check
       OR NEW.consents        IS DISTINCT FROM OLD.consents
       OR NEW.discrepancy_note IS DISTINCT FROM OLD.discrepancy_note) THEN
    RAISE EXCEPTION 'KYC application data cannot change while it is %', v_from
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM kyc_normalize_status(NEW.status) THEN
    RAISE EXCEPTION 'KYC status "%" is not canonical', NEW.status USING ERRCODE = 'check_violation';
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'KYC status changes must go through the KYC service (hoscomo.kyc_actor is not set)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A spelling-only rewrite (e.g. VERIFIED -> APPROVED) changes no meaning.
  IF v_from = NEW.status THEN
    RETURN NEW;
  END IF;

  IF v_actor = 'reconcile' THEN
    IF NEW.status = 'NOT_STARTED' THEN RETURN NEW; END IF;
    IF NEW.status IN ('APPROVED','SUSPENDED','REJECTED') THEN
      SELECT kyc_normalize_status(kyc_status) INTO v_member FROM borrowers WHERE id = NEW.borrower_id;
      IF v_member = NEW.status THEN RETURN NEW; END IF;
    END IF;
    RAISE EXCEPTION 'Reconciliation may only reset an application or copy a decision already on the member record'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT kyc_transition_allowed(v_from, NEW.status, v_actor) THEN
    RAISE EXCEPTION 'Illegal KYC status transition % -> % for actor %', v_from, NEW.status, v_actor
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_actor IN ('staff', 'staff_sensitive') THEN
    IF NEW.status = 'UNDER_REVIEW' AND kyc_blank(NEW.claimed_by) THEN
      RAISE EXCEPTION 'A review claim must record the reviewer' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IN ('APPROVED','REJECTED','CORRECTION_REQUIRED','SUSPENDED')
       AND (kyc_blank(NEW.reviewed_by) OR kyc_blank(NEW.reviewed_at)) THEN
      RAISE EXCEPTION 'A KYC decision must record who made it and when' USING ERRCODE = 'check_violation';
    END IF;
    -- Nobody reviews or decides an application linked to their own login.
    IF EXISTS (
      SELECT 1 FROM users u
       WHERE u.borrower_id = NEW.borrower_id
         AND (u.id IN (NEW.reviewed_by, NEW.claimed_by) OR u.staff_id IN (NEW.reviewed_by, NEW.claimed_by))
    ) THEN
      RAISE EXCEPTION 'A reviewer cannot act on their own KYC application' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF NEW.status = 'APPROVED' AND kyc_blank(NEW.decision_reason) THEN
    RAISE EXCEPTION 'An approval must record a reason' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'REJECTED' AND kyc_blank(NEW.rejection_reason) THEN
    RAISE EXCEPTION 'A rejection must record a reason' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'CORRECTION_REQUIRED' AND kyc_blank(NEW.correction_reason) THEN
    RAISE EXCEPTION 'A request for information must say what is needed' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'SUSPENDED' AND kyc_blank(NEW.suspension_reason) THEN
    RAISE EXCEPTION 'A suspension must record a reason' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = 'SUBMITTED' AND v_actor = 'client' AND kyc_blank(NEW.submitted_at) THEN
    RAISE EXCEPTION 'A submission must record when it was submitted' USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_submissions_guard ON kyc_submissions;
CREATE TRIGGER trg_kyc_submissions_guard
  BEFORE INSERT OR UPDATE ON kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION kyc_submissions_guard();

-- ------------------------------------------------------------
-- 3. Append-only audit trail and snapshots
-- ------------------------------------------------------------

-- Deletion is possible only as a deliberate, attributable retention purge
-- (set hoscomo.kyc_actor = 'retention_purge' in the purging transaction).
-- Rows are never updated.
CREATE OR REPLACE FUNCTION kyc_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND kyc_current_actor() = 'retention_purge' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_kyc_audit_log_append_only ON kyc_audit_log;
CREATE TRIGGER trg_kyc_audit_log_append_only
  BEFORE UPDATE OR DELETE ON kyc_audit_log
  FOR EACH ROW EXECUTE FUNCTION kyc_append_only();

DROP TRIGGER IF EXISTS trg_kyc_audit_log_no_truncate ON kyc_audit_log;
CREATE TRIGGER trg_kyc_audit_log_no_truncate
  BEFORE TRUNCATE ON kyc_audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION kyc_append_only();

DROP TRIGGER IF EXISTS trg_kyc_snapshots_append_only ON kyc_submission_snapshots;
CREATE TRIGGER trg_kyc_snapshots_append_only
  BEFORE UPDATE OR DELETE ON kyc_submission_snapshots
  FOR EACH ROW EXECUTE FUNCTION kyc_append_only();

DROP TRIGGER IF EXISTS trg_kyc_snapshots_no_truncate ON kyc_submission_snapshots;
CREATE TRIGGER trg_kyc_snapshots_no_truncate
  BEFORE TRUNCATE ON kyc_submission_snapshots
  FOR EACH STATEMENT EXECUTE FUNCTION kyc_append_only();

-- ------------------------------------------------------------
-- 4. Row level security: deny direct access through the public API
-- ------------------------------------------------------------
-- No policies are created, so roles other than the owner see no rows. The
-- backend connects as the owner (RLS is enabled, not FORCEd) and enforces
-- per-member and per-branch access itself.

ALTER TABLE kyc_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_audit_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_required_documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_submission_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE kyc_submissions, kyc_documents, kyc_audit_log, '
        'kyc_required_documents, kyc_submission_snapshots FROM %I', r);
    END IF;
  END LOOP;
END
$$;

-- ------------------------------------------------------------
-- 5. Storage (Supabase only; skipped on plain Postgres)
-- ------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('kyc-documents', 'kyc-documents', false, 10485760,
            ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
    ON CONFLICT (id) DO UPDATE SET public = false;
  END IF;

  IF to_regclass('storage.objects') IS NOT NULL THEN
    -- Granted anonymous SELECT/INSERT/UPDATE/DELETE on both 'kyc-documents'
    -- and 'documents'. The backend uses the service-role key and signed URLs,
    -- so no client needs direct bucket access. ('documents' held no objects
    -- when this was written; its public flag is left unchanged.)
    DROP POLICY IF EXISTS "Public and authenticated can upload to kyc-documents" ON storage.objects;
  END IF;
END
$$;

DO $$
DECLARE
  v_public boolean;
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    SELECT public INTO v_public FROM storage.buckets WHERE id = 'kyc-documents';
    IF v_public IS DISTINCT FROM false THEN
      RAISE EXCEPTION '0023: kyc-documents is still public (public = %). Aborting.', coalesce(v_public::text, 'NULL');
    END IF;
  END IF;
END
$$;

COMMIT;
