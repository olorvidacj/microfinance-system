-- 0013: Borrower email verification columns
-- Adds email_verified / email_verified_at to support the native Supabase
-- email-OTP verification flow (register -> 6-digit code -> verify -> complete profile).

ALTER TABLE borrowers
  ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_borrowers_email_verified ON borrowers (email_verified);
