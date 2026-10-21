-- Rollback for 0025_loan_lifecycle.sql
--
-- Not reversible:
-- - Loan status spellings stay canonical (for example 'Completed' became
--   'Closed', 'PENDING' became 'Submitted'); the old code reads them.
-- - 'Semi-monthly' products and loans became BI_WEEKLY and come back as
--   'Bi-Weekly'.
-- - Products' extra fees beyond PROCESSING are lost; PROCESSING becomes
--   processing_fee_percentage again.
-- - Rows in loan_schedule, loan_status_history and loan_disbursements are
--   deleted with their tables. Journal entries already posted stay in the
--   ledger (0006 owns those tables); only the columns 0025 added are removed.
-- - Money columns return to double precision.

BEGIN;

DROP TABLE IF EXISTS loan_disbursements;
DROP TABLE IF EXISTS loan_approval_limits;
DROP TABLE IF EXISTS loan_status_history;
DROP TABLE IF EXISTS loan_schedule;
DROP SEQUENCE IF EXISTS loan_receipt_seq;
DROP SEQUENCE IF EXISTS loan_number_seq;

DROP INDEX IF EXISTS idx_journal_entries_source_ref;
DROP INDEX IF EXISTS uq_journal_entries_idempotency;
ALTER TABLE journal_entry_lines DROP COLUMN IF EXISTS memo;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS idempotency_key;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS posted_by_name;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS posted_by;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS branch_id;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS source_ref;

ALTER TABLE financial_transactions ALTER COLUMN amount TYPE double precision USING amount::double precision;

-- Loans
DROP INDEX IF EXISTS idx_loans_branch_status;
DROP INDEX IF EXISTS idx_loans_borrower_status;
DROP INDEX IF EXISTS uq_loans_request_key;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_terms_valid;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_canonical;
ALTER TABLE loans
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS cancellation_reason,
  DROP COLUMN IF EXISTS returned_reason,
  DROP COLUMN IF EXISTS decision_reason,
  DROP COLUMN IF EXISTS decided_at,
  DROP COLUMN IF EXISTS decided_by_name,
  DROP COLUMN IF EXISTS decided_by,
  DROP COLUMN IF EXISTS review_started_at,
  DROP COLUMN IF EXISTS reviewed_by_name,
  DROP COLUMN IF EXISTS reviewed_by,
  DROP COLUMN IF EXISTS submitted_at,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS request_key,
  DROP COLUMN IF EXISTS application_channel,
  DROP COLUMN IF EXISTS lending_type,
  DROP COLUMN IF EXISTS penalty_rate,
  DROP COLUMN IF EXISTS installment_amount,
  DROP COLUMN IF EXISTS net_proceeds,
  DROP COLUMN IF EXISTS fees;

UPDATE loans
   SET interest_type = CASE interest_type WHEN 'FLAT' THEN 'Flat Rate' WHEN 'DIMINISHING' THEN 'Reducing Balance' ELSE interest_type END,
       repayment_frequency = CASE repayment_frequency WHEN 'WEEKLY' THEN 'Weekly' WHEN 'BI_WEEKLY' THEN 'Bi-Weekly' WHEN 'MONTHLY' THEN 'Monthly' ELSE repayment_frequency END;

ALTER TABLE loans ALTER COLUMN total_paid DROP NOT NULL;
UPDATE loans SET loan_officer_id = 'staff-system', loan_officer_name = 'Loan Processing Team' WHERE loan_officer_id IS NULL;
ALTER TABLE loans ALTER COLUMN loan_officer_id SET NOT NULL;
ALTER TABLE loans ALTER COLUMN loan_officer_name SET NOT NULL;
ALTER TABLE loans
  ALTER COLUMN principal_amount TYPE double precision USING principal_amount::double precision,
  ALTER COLUMN interest_rate TYPE double precision USING interest_rate::double precision,
  ALTER COLUMN processing_fee TYPE double precision USING processing_fee::double precision,
  ALTER COLUMN total_interest TYPE double precision USING total_interest::double precision,
  ALTER COLUMN total_payable TYPE double precision USING total_payable::double precision,
  ALTER COLUMN total_paid TYPE double precision USING total_paid::double precision,
  ALTER COLUMN remaining_balance TYPE double precision USING remaining_balance::double precision,
  ALTER COLUMN total_late_penalties_charged TYPE double precision USING total_late_penalties_charged::double precision,
  ALTER COLUMN total_rebates_awarded TYPE double precision USING total_rebates_awarded::double precision;

-- Loan products
DROP INDEX IF EXISTS uq_loan_products_code;
ALTER TABLE loan_products DROP CONSTRAINT IF EXISTS loan_products_terms_valid;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS processing_fee_percentage double precision DEFAULT 2;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS default_repayment_frequency text DEFAULT 'Monthly';

UPDATE loan_products
   SET processing_fee_percentage = coalesce((
         SELECT (f->>'value')::double precision FROM jsonb_array_elements(fees) f
          WHERE f->>'code' = 'PROCESSING' AND f->>'kind' = 'PERCENT' LIMIT 1), 0),
       interest_type = CASE interest_type WHEN 'FLAT' THEN 'Flat Rate' WHEN 'DIMINISHING' THEN 'Reducing Balance' ELSE interest_type END,
       repayment_frequency = CASE repayment_frequency WHEN 'WEEKLY' THEN 'Weekly' WHEN 'BI_WEEKLY' THEN 'Bi-Weekly' WHEN 'MONTHLY' THEN 'Monthly' ELSE repayment_frequency END;
UPDATE loan_products SET default_repayment_frequency = repayment_frequency;

ALTER TABLE loan_products ALTER COLUMN repayment_frequency DROP NOT NULL;
ALTER TABLE loan_products ALTER COLUMN repayment_frequency SET DEFAULT 'Monthly';
ALTER TABLE loan_products ALTER COLUMN late_penalty_rate DROP NOT NULL;
ALTER TABLE loan_products ALTER COLUMN late_penalty_rate SET DEFAULT 3;
ALTER TABLE loan_products
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS lending_type,
  DROP COLUMN IF EXISTS fees;
ALTER TABLE loan_products
  ALTER COLUMN interest_rate TYPE double precision USING interest_rate::double precision,
  ALTER COLUMN min_amount TYPE double precision USING min_amount::double precision,
  ALTER COLUMN max_amount TYPE double precision USING max_amount::double precision,
  ALTER COLUMN late_penalty_rate TYPE double precision USING late_penalty_rate::double precision,
  ALTER COLUMN early_settlement_rebate_rate TYPE double precision USING early_settlement_rebate_rate::double precision;

-- The policies 0025 dropped allowed every role full access. They are restored
-- only to return to the previous state; the API roles still have no grants.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loans' AND policyname = 'Allow full access to loans') THEN
    CREATE POLICY "Allow full access to loans" ON loans AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'loan_products' AND policyname = 'Allow full access to loan_products') THEN
    CREATE POLICY "Allow full access to loan_products" ON loan_products AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
  END IF;
END
$$;

COMMIT;
