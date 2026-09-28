-- ============================================================
-- 0011 — KYC FULL SCHEMA + SECURE STORAGE
-- Creates the four KYC tables used by the Express/Drizzle API
-- and provisions a private Supabase Storage bucket for
-- government-issued ID images, selfies, and proofs.
--
-- Requires: 0010
-- ============================================================

-- ------------------------------------------------------------
-- 1. KYC tables (matching src/db/schema.ts Drizzle definitions)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kyc_submissions (
  id                TEXT PRIMARY KEY,
  borrower_id       TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'NOT_STARTED',
  personal_info     JSONB,
  address           JSONB,
  employment        JSONB,
  submitted_at      TEXT,
  reviewed_at       TEXT,
  reviewed_by       TEXT,
  reviewed_by_name  TEXT,
  correction_reason TEXT,
  rejection_reason  TEXT,
  verified_at       TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_borrower
  ON kyc_submissions(borrower_id);

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status
  ON kyc_submissions(status);

CREATE TABLE IF NOT EXISTS kyc_documents (
  id                  TEXT PRIMARY KEY,
  kyc_submission_id   TEXT NOT NULL,
  borrower_id         TEXT NOT NULL,
  document_type       TEXT NOT NULL,
  document_name       TEXT NOT NULL,
  file_name           TEXT,
  file_url            TEXT,
  status              TEXT NOT NULL DEFAULT 'PENDING',
  rejection_reason    TEXT,
  verified_by         TEXT,
  verified_at         TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_borrower
  ON kyc_documents(borrower_id);

CREATE INDEX IF NOT EXISTS idx_kyc_documents_submission
  ON kyc_documents(kyc_submission_id);

CREATE TABLE IF NOT EXISTS kyc_audit_log (
  id                  TEXT PRIMARY KEY,
  borrower_id         TEXT NOT NULL,
  kyc_submission_id   TEXT,
  staff_user_id       TEXT,
  staff_name          TEXT,
  action              TEXT NOT NULL,
  previous_status     TEXT,
  new_status          TEXT,
  reason              TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kyc_audit_borrower
  ON kyc_audit_log(borrower_id);

CREATE TABLE IF NOT EXISTS kyc_required_documents (
  id                  TEXT PRIMARY KEY,
  document_type       TEXT NOT NULL,
  document_name       TEXT NOT NULL,
  description         TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order          INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 2. Seed default required document types
-- ------------------------------------------------------------

INSERT INTO kyc_required_documents (id, document_type, document_name, description, is_active, sort_order, created_at)
VALUES
  ('KRD-001', 'VALID_ID',        'Government-Issued Photo ID',        'A valid, unexpired government-issued photo ID (PhilID, Passport, Driver License, UMID, SSS, PRC).',  true, 1,  NOW()::text),
  ('KRD-002', 'PROOF_OF_ADDRESS','Barangay Clearance or Utility Bill','Recent proof of residence within the last 3 months.',                                                         true, 2,  NOW()::text),
  ('KRD-003', 'PROOF_OF_INCOME', 'Payslip / Business Permit / Bank Statement','Evidence of regular income or business operations.',                                                     true, 3,  NOW()::text),
  ('KRD-004', 'PHOTO_2X2',       'Recent 2x2 ID Photo',              'A recent photograph with white background.',                                                                 true, 4,  NOW()::text)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 3. Private Supabase Storage bucket for KYC documents
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  FALSE,          -- never public
  10485760,       -- 10 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------------
-- 4. Storage RLS policies (Supabase Auth-aware)
--
--    We use auth.uid() to scope client uploads to their own
--    folder: kyc/{clientUUID}/...
--    Staff (backend service-role key) bypasses RLS entirely.
-- ------------------------------------------------------------

-- Clients may INSERT files into their own folder
CREATE POLICY "kyc_client_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = 'kyc'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Clients may SELECT (view) their own uploaded files
CREATE POLICY "kyc_client_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = 'kyc'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Staff may SELECT all files (for review)
CREATE POLICY "kyc_staff_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'loan_officer', 'teller')
    )
  );

-- Staff may INSERT/UPDATE/DELETE files (for corrections)
CREATE POLICY "kyc_staff_manage" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager', 'loan_officer')
    )
  );

-- Admin may DELETE any file
CREATE POLICY "kyc_admin_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
