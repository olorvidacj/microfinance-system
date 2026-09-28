-- 0012_borrower_profile_and_income.sql
-- Phase 5 ✓ (server/client signup → complete-profile):
-- Adds the client profile-completion fields, existing-member link, address parts,
-- and income-source tag to the borrowers table, idempotently for existing rows.

ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS profile_completed_at TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS existing_member_id TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS barangay TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS city_municipality TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS source_of_income TEXT;

CREATE INDEX IF NOT EXISTS idx_borrowers_profile_completed ON borrowers (profile_completed);
CREATE INDEX IF NOT EXISTS idx_borrowers_member_status ON borrowers (member_status);
