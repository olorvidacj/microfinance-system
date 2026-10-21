-- ============================================================
-- 0026 - Loan repayment, penalties and reversals
--
-- Requires: 0025.
--
-- 1. payments and payment_proofs amounts become numeric(14,2). A payment
--    records its method code, kind, allocation, journal entry and an
--    idempotency key, and is never deleted: a reversal marks it REVERSED
--    and posts a mirror entry.
-- 2. Installments carry the penalties charged on them and can be OVERDUE.
--    loan_penalties holds one row per (installment, month), so the overdue
--    check charges each month exactly once however often it runs.
-- 3. Chart of accounts: 1116 Penalties Receivable, 2030 Member Overpayments
--    Payable.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Payments
-- ------------------------------------------------------------

ALTER TABLE payments
  ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2),
  ALTER COLUMN principal_portion TYPE numeric(14,2) USING round(principal_portion::numeric, 2),
  ALTER COLUMN interest_portion TYPE numeric(14,2) USING round(interest_portion::numeric, 2),
  ALTER COLUMN penalty_portion TYPE numeric(14,2) USING round(coalesce(penalty_portion, 0)::numeric, 2),
  ALTER COLUMN rebate_discount TYPE numeric(14,2) USING round(coalesce(rebate_discount, 0)::numeric, 2);

ALTER TABLE payments ALTER COLUMN penalty_portion SET NOT NULL;
ALTER TABLE payments ALTER COLUMN rebate_discount SET NOT NULL;

-- Method codes as used by shared/lending (CASH / BANK_TRANSFER / E_WALLET).
UPDATE payments
   SET payment_method = CASE
         WHEN payment_method ILIKE '%cash%' THEN 'CASH'
         WHEN payment_method ILIKE ANY (ARRAY['%gcash%', '%maya%', '%wallet%', '%paymaya%']) THEN 'E_WALLET'
         WHEN payment_method ILIKE '%bank%' THEN 'BANK_TRANSFER'
         ELSE payment_method END;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'POSTED';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_kind TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS excess_amount NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS allocation JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries (journal_entry_id) ON DELETE RESTRICT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS posted_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_journal_entry_id UUID REFERENCES journal_entries (journal_entry_id) ON DELETE RESTRICT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversed_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversed_by_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_valid;
ALTER TABLE payments ADD CONSTRAINT payments_valid CHECK (
  status IN ('POSTED', 'REVERSED')
  AND amount > 0 AND principal_portion >= 0 AND interest_portion >= 0 AND penalty_portion >= 0 AND excess_amount >= 0
  AND (payment_kind IS NULL OR payment_kind IN ('PARTIAL', 'FULL', 'ADVANCE', 'OVERPAYMENT'))
  AND (status = 'POSTED' OR (reversed_at IS NOT NULL AND reversal_reason IS NOT NULL))
);
-- New rows only: the split must add up and the method must be a known code.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_split_adds_up;
ALTER TABLE payments ADD CONSTRAINT payments_split_adds_up CHECK (
  allocation IS NULL OR (amount = principal_portion + interest_portion + penalty_portion + excess_amount
                         AND payment_method IN ('CASH', 'BANK_TRANSFER', 'E_WALLET'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_idempotency ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_proof ON payments (proof_id) WHERE proof_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_reference
  ON payments (payment_method, upper(transaction_reference))
  WHERE status = 'POSTED' AND allocation IS NOT NULL AND payment_method <> 'CASH' AND transaction_reference <> '';
CREATE INDEX IF NOT EXISTS idx_payments_loan ON payments (loan_id, created_at);

-- Payments are never deleted.
CREATE OR REPLACE FUNCTION payments_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Payments are never deleted; reverse the payment instead.' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS trg_payments_no_delete ON payments;
CREATE TRIGGER trg_payments_no_delete BEFORE DELETE ON payments FOR EACH ROW EXECUTE FUNCTION payments_no_delete();

CREATE SEQUENCE IF NOT EXISTS payment_receipt_seq;
CREATE SEQUENCE IF NOT EXISTS payment_reversal_seq;

ALTER TABLE payment_proofs ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);

-- ------------------------------------------------------------
-- 2. Installments and penalties
-- ------------------------------------------------------------

ALTER TABLE loan_schedule ADD COLUMN IF NOT EXISTS penalty_due NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE loan_schedule DROP CONSTRAINT IF EXISTS loan_schedule_status_check;
ALTER TABLE loan_schedule ADD CONSTRAINT loan_schedule_status_check CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE'));
-- Schedules carried over from older loans only knew the amount paid; split it
-- interest first, as the allocation rule does.
UPDATE loan_schedule
   SET interest_paid = least(amount_paid, interest_due),
       principal_paid = least(amount_paid - least(amount_paid, interest_due), principal_due),
       amount_paid = least(amount_paid, interest_due) + least(amount_paid - least(amount_paid, interest_due), principal_due)
 WHERE amount_paid > 0 AND principal_paid = 0 AND interest_paid = 0 AND penalty_paid = 0;

ALTER TABLE loan_schedule DROP CONSTRAINT IF EXISTS loan_schedule_paid_within_due;
ALTER TABLE loan_schedule ADD CONSTRAINT loan_schedule_paid_within_due CHECK (
  principal_paid <= principal_due AND interest_paid <= interest_due
  AND penalty_due >= 0 AND penalty_paid <= penalty_due
  AND amount_paid = principal_paid + interest_paid + penalty_paid
);

CREATE TABLE IF NOT EXISTS loan_penalties (
  id                 TEXT PRIMARY KEY,
  loan_id            TEXT NOT NULL REFERENCES loans (id) ON DELETE RESTRICT,
  schedule_id        TEXT NOT NULL REFERENCES loan_schedule (id) ON DELETE RESTRICT,
  installment_number INTEGER NOT NULL,
  period             INTEGER NOT NULL CHECK (period > 0),
  assessed_on        DATE NOT NULL,
  base_amount        NUMERIC(14,2) NOT NULL CHECK (base_amount > 0),
  rate               NUMERIC(7,4) NOT NULL CHECK (rate > 0),
  amount             NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  journal_entry_id   UUID NOT NULL REFERENCES journal_entries (journal_entry_id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, period)
);
CREATE INDEX IF NOT EXISTS idx_loan_penalties_loan ON loan_penalties (loan_id);

ALTER TABLE loans ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

-- ------------------------------------------------------------
-- 3. Chart of accounts
-- ------------------------------------------------------------

INSERT INTO accounts (account_code, account_name, account_type, normal_balance) VALUES
  ('1116', 'Penalties Receivable',           'asset',     'debit'),
  ('2030', 'Member Overpayments Payable',    'liability', 'credit')
ON CONFLICT (account_code) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Access: server-side only
-- ------------------------------------------------------------

ALTER TABLE loan_penalties ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE payments, loan_penalties FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE payment_receipt_seq, payment_reversal_seq FROM %I', r);
    END IF;
  END LOOP;
END
$$;

COMMIT;
