-- Rollback for 0026_loan_repayment.sql
--
-- Not reversible:
-- - Payment method labels became codes (CASH / BANK_TRANSFER / E_WALLET).
-- - The interest-first split of carried-over installment payments stays.
-- - Penalty rows are deleted with loan_penalties; their journal entries stay
--   in the ledger (0006 owns it), and installments keep penalty amounts only
--   until penalty_due is dropped here.
-- - Reversed payments stay in the table; only the columns describing the
--   reversal are dropped, so check them before rolling back.
-- - Money columns return to double precision.

BEGIN;

DROP TABLE IF EXISTS loan_penalties;
ALTER TABLE loans DROP COLUMN IF EXISTS closed_at;

ALTER TABLE loan_schedule DROP CONSTRAINT IF EXISTS loan_schedule_paid_within_due;
ALTER TABLE loan_schedule ADD CONSTRAINT loan_schedule_paid_within_due CHECK (principal_paid <= principal_due AND interest_paid <= interest_due);
UPDATE loan_schedule SET status = 'PENDING' WHERE status = 'OVERDUE' AND amount_paid = 0;
UPDATE loan_schedule SET status = 'PARTIAL' WHERE status = 'OVERDUE';
ALTER TABLE loan_schedule DROP CONSTRAINT IF EXISTS loan_schedule_status_check;
ALTER TABLE loan_schedule ADD CONSTRAINT loan_schedule_status_check CHECK (status IN ('PENDING', 'PARTIAL', 'PAID'));
ALTER TABLE loan_schedule DROP COLUMN IF EXISTS penalty_due;

ALTER TABLE payment_proofs ALTER COLUMN amount TYPE double precision USING amount::double precision;

DROP SEQUENCE IF EXISTS payment_reversal_seq;
DROP SEQUENCE IF EXISTS payment_receipt_seq;
DROP TRIGGER IF EXISTS trg_payments_no_delete ON payments;
DROP FUNCTION IF EXISTS payments_no_delete();
DROP INDEX IF EXISTS idx_payments_loan;
DROP INDEX IF EXISTS uq_payments_reference;
DROP INDEX IF EXISTS uq_payments_proof;
DROP INDEX IF EXISTS uq_payments_idempotency;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_split_adds_up;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_valid;
ALTER TABLE payments
  DROP COLUMN IF EXISTS reversal_reason,
  DROP COLUMN IF EXISTS reversed_by_name,
  DROP COLUMN IF EXISTS reversed_by,
  DROP COLUMN IF EXISTS reversed_at,
  DROP COLUMN IF EXISTS reversal_journal_entry_id,
  DROP COLUMN IF EXISTS reversal_reference,
  DROP COLUMN IF EXISTS posted_at,
  DROP COLUMN IF EXISTS posted_by,
  DROP COLUMN IF EXISTS proof_id,
  DROP COLUMN IF EXISTS journal_entry_id,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS allocation,
  DROP COLUMN IF EXISTS excess_amount,
  DROP COLUMN IF EXISTS payment_kind,
  DROP COLUMN IF EXISTS status;
ALTER TABLE payments ALTER COLUMN penalty_portion DROP NOT NULL;
ALTER TABLE payments ALTER COLUMN rebate_discount DROP NOT NULL;
ALTER TABLE payments
  ALTER COLUMN amount TYPE double precision USING amount::double precision,
  ALTER COLUMN principal_portion TYPE double precision USING principal_portion::double precision,
  ALTER COLUMN interest_portion TYPE double precision USING interest_portion::double precision,
  ALTER COLUMN penalty_portion TYPE double precision USING penalty_portion::double precision,
  ALTER COLUMN rebate_discount TYPE double precision USING rebate_discount::double precision;

COMMIT;
