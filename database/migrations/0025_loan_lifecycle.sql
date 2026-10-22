-- ============================================================
-- 0025 - Loan products, applications and disbursement
--
-- Requires: 0001 (enums), 0002 (profiles), legacy tables from initDb,
--           0006/0010 on Supabase (the ledger is created here if missing).
--
-- 1. Money is exact: every amount on loan_products, loans and
--    financial_transactions becomes numeric(14,2); rates numeric(7,4).
-- 2. Products carry an interest method (FLAT / DIMINISHING), one repayment
--    frequency (WEEKLY / BI_WEEKLY / MONTHLY), a fee list, a monthly
--    penalty rate, a lending type (INDIVIDUAL / GROUP) and a status.
--    The single processing-fee percentage becomes a PROCESSING fee.
-- 3. Loan statuses are the canonical set enforced by the server
--    (shared/lending/workflow.ts); legacy spellings are rewritten.
-- 4. New tables: loan_schedule (stored installments), loan_status_history,
--    loan_disbursements, loan_approval_limits.
-- 5. The double-entry ledger (accounts / journal_entries /
--    journal_entry_lines with the deferred balance check) is ensured and
--    extended so legacy text-keyed records can post to it.
-- 6. The permissive "Allow full access" policies on loans and
--    loan_products are dropped; the API role keeps no direct access.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Spelling helpers (pg_temp: they vanish with the session)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION pg_temp.lending_method(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(regexp_replace(btrim(coalesce(v, '')), '[\s-]+', '_', 'g'))
    WHEN 'FLAT' THEN 'FLAT' WHEN 'FLAT_RATE' THEN 'FLAT'
    WHEN 'DIMINISHING' THEN 'DIMINISHING' WHEN 'DIMINISHING_BALANCE' THEN 'DIMINISHING'
    WHEN 'REDUCING_BALANCE' THEN 'DIMINISHING' WHEN 'DECLINING_BALANCE' THEN 'DIMINISHING'
    ELSE v END
$$;

CREATE OR REPLACE FUNCTION pg_temp.lending_frequency(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(regexp_replace(btrim(coalesce(v, '')), '[\s-]+', '_', 'g'))
    WHEN 'WEEKLY' THEN 'WEEKLY'
    WHEN 'BI_WEEKLY' THEN 'BI_WEEKLY' WHEN 'BIWEEKLY' THEN 'BI_WEEKLY' WHEN 'FORTNIGHTLY' THEN 'BI_WEEKLY'
    WHEN 'SEMI_MONTHLY' THEN 'BI_WEEKLY'
    WHEN 'MONTHLY' THEN 'MONTHLY'
    ELSE v END
$$;

CREATE OR REPLACE FUNCTION pg_temp.lending_status(v text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE upper(regexp_replace(btrim(coalesce(v, '')), '[\s-]+', '_', 'g'))
    WHEN 'DRAFT' THEN 'Draft'
    WHEN 'SUBMITTED' THEN 'Submitted' WHEN 'PENDING' THEN 'Submitted'
    WHEN 'UNDER_REVIEW' THEN 'Under Review' WHEN 'FOR_ASSESSMENT' THEN 'Under Review' WHEN 'RECOMMENDED' THEN 'Under Review'
    WHEN 'APPROVED' THEN 'Approved' WHEN 'FOR_DISBURSEMENT' THEN 'Approved'
    WHEN 'REJECTED' THEN 'Rejected' WHEN 'DECLINED' THEN 'Rejected'
    WHEN 'DISBURSED' THEN 'Active'
    WHEN 'ACTIVE' THEN 'Active' WHEN 'IN_ARREARS' THEN 'Active' WHEN 'OVERDUE' THEN 'Active' WHEN 'DEFAULTED' THEN 'Active'
    WHEN 'COMPLETED' THEN 'Closed' WHEN 'CLOSED' THEN 'Closed' WHEN 'PAID_OFF' THEN 'Closed'
    WHEN 'FULLY_PAID' THEN 'Closed' WHEN 'SETTLED' THEN 'Closed'
    WHEN 'WRITTEN_OFF' THEN 'Written Off'
    WHEN 'CANCELLED' THEN 'Cancelled' WHEN 'CANCELED' THEN 'Cancelled'
    ELSE v END
$$;

-- ------------------------------------------------------------
-- 1. Loan products
-- ------------------------------------------------------------

ALTER TABLE loan_products
  ALTER COLUMN interest_rate TYPE numeric(7,4) USING round(interest_rate::numeric, 4),
  ALTER COLUMN min_amount TYPE numeric(14,2) USING round(min_amount::numeric, 2),
  ALTER COLUMN max_amount TYPE numeric(14,2) USING round(max_amount::numeric, 2),
  ALTER COLUMN late_penalty_rate TYPE numeric(7,4) USING round(late_penalty_rate::numeric, 4),
  ALTER COLUMN early_settlement_rebate_rate TYPE numeric(7,4) USING round(early_settlement_rebate_rate::numeric, 4);

ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS fees JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS lending_type TEXT NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE loan_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_products' AND column_name = 'processing_fee_percentage') THEN
    UPDATE loan_products
       SET fees = jsonb_build_array(jsonb_build_object(
             'code', 'PROCESSING', 'label', 'Processing fee', 'kind', 'PERCENT',
             'value', to_char(round(processing_fee_percentage::numeric, 4), 'FM990.0000')))
     WHERE fees = '[]'::jsonb AND coalesce(processing_fee_percentage, 0) > 0;
  END IF;
  -- The frequency applications actually used was the default one.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_products' AND column_name = 'default_repayment_frequency') THEN
    UPDATE loan_products SET repayment_frequency = coalesce(default_repayment_frequency, repayment_frequency);
  END IF;
END
$$;

UPDATE loan_products
   SET interest_type = pg_temp.lending_method(interest_type),
       repayment_frequency = pg_temp.lending_frequency(repayment_frequency),
       late_penalty_rate = coalesce(late_penalty_rate, 0);

ALTER TABLE loan_products DROP COLUMN IF EXISTS processing_fee_percentage;
ALTER TABLE loan_products DROP COLUMN IF EXISTS default_repayment_frequency;
ALTER TABLE loan_products ALTER COLUMN repayment_frequency DROP DEFAULT;
ALTER TABLE loan_products ALTER COLUMN repayment_frequency SET NOT NULL;
ALTER TABLE loan_products ALTER COLUMN late_penalty_rate SET DEFAULT 0;
ALTER TABLE loan_products ALTER COLUMN late_penalty_rate SET NOT NULL;

ALTER TABLE loan_products DROP CONSTRAINT IF EXISTS loan_products_terms_valid;
ALTER TABLE loan_products ADD CONSTRAINT loan_products_terms_valid CHECK (
  interest_type IN ('FLAT', 'DIMINISHING')
  AND repayment_frequency IN ('WEEKLY', 'BI_WEEKLY', 'MONTHLY')
  AND lending_type IN ('INDIVIDUAL', 'GROUP')
  AND status IN ('ACTIVE', 'INACTIVE')
  AND interest_rate >= 0 AND interest_rate <= 100
  AND late_penalty_rate >= 0 AND late_penalty_rate <= 100
  AND min_amount > 0 AND max_amount >= min_amount
  AND min_term_months >= 1 AND max_term_months <= 120 AND max_term_months >= min_term_months
  AND jsonb_typeof(fees) = 'array'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loan_products_code ON loan_products (upper(code));

-- ------------------------------------------------------------
-- 2. Loans
-- ------------------------------------------------------------

ALTER TABLE loans
  ALTER COLUMN principal_amount TYPE numeric(14,2) USING round(principal_amount::numeric, 2),
  ALTER COLUMN interest_rate TYPE numeric(7,4) USING round(interest_rate::numeric, 4),
  ALTER COLUMN processing_fee TYPE numeric(14,2) USING round(processing_fee::numeric, 2),
  ALTER COLUMN total_interest TYPE numeric(14,2) USING round(total_interest::numeric, 2),
  ALTER COLUMN total_payable TYPE numeric(14,2) USING round(total_payable::numeric, 2),
  ALTER COLUMN total_paid TYPE numeric(14,2) USING round(coalesce(total_paid, 0)::numeric, 2),
  ALTER COLUMN remaining_balance TYPE numeric(14,2) USING round(remaining_balance::numeric, 2),
  ALTER COLUMN total_late_penalties_charged TYPE numeric(14,2) USING round(coalesce(total_late_penalties_charged, 0)::numeric, 2),
  ALTER COLUMN total_rebates_awarded TYPE numeric(14,2) USING round(coalesce(total_rebates_awarded, 0)::numeric, 2);

ALTER TABLE loans ALTER COLUMN total_paid SET DEFAULT 0;
ALTER TABLE loans ALTER COLUMN total_paid SET NOT NULL;

-- A member's own application has no officer until a reviewer takes it up.
ALTER TABLE loans ALTER COLUMN loan_officer_id DROP NOT NULL;
ALTER TABLE loans ALTER COLUMN loan_officer_name DROP NOT NULL;
UPDATE loans SET loan_officer_id = NULL, loan_officer_name = NULL WHERE loan_officer_id = 'staff-system';

UPDATE loans
   SET status = pg_temp.lending_status(status),
       interest_type = pg_temp.lending_method(interest_type),
       repayment_frequency = pg_temp.lending_frequency(repayment_frequency);

-- processing_fee holds the total of all fees deducted at release.
ALTER TABLE loans ADD COLUMN IF NOT EXISTS fees JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS net_proceeds NUMERIC(14,2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS installment_amount NUMERIC(14,2);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS penalty_rate NUMERIC(7,4);
ALTER TABLE loans ADD COLUMN IF NOT EXISTS lending_type TEXT NOT NULL DEFAULT 'INDIVIDUAL';
ALTER TABLE loans ADD COLUMN IF NOT EXISTS application_channel TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS request_key TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS decided_by TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS decided_by_name TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS decision_reason TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS returned_reason TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE loans SET penalty_rate = p.late_penalty_rate FROM loan_products p WHERE loans.penalty_rate IS NULL AND p.id = loans.product_id;
UPDATE loans SET net_proceeds = principal_amount - processing_fee WHERE net_proceeds IS NULL AND status IN ('Active', 'Closed', 'Written Off');
UPDATE loans
   SET fees = jsonb_build_array(jsonb_build_object('code', 'PROCESSING', 'label', 'Processing fee', 'amount', to_char(processing_fee, 'FM999999999990.00')))
 WHERE fees = '[]'::jsonb AND processing_fee > 0;

ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_status_canonical;
ALTER TABLE loans ADD CONSTRAINT loans_status_canonical CHECK (
  status IN ('Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Disbursed', 'Active', 'Closed', 'Written Off', 'Cancelled')
);
ALTER TABLE loans DROP CONSTRAINT IF EXISTS loans_terms_valid;
ALTER TABLE loans ADD CONSTRAINT loans_terms_valid CHECK (
  interest_type IN ('FLAT', 'DIMINISHING')
  AND repayment_frequency IN ('WEEKLY', 'BI_WEEKLY', 'MONTHLY')
  AND lending_type IN ('INDIVIDUAL', 'GROUP')
  AND (application_channel IS NULL OR application_channel IN ('PORTAL', 'BRANCH'))
  AND principal_amount > 0
  AND processing_fee >= 0 AND total_interest >= 0 AND total_paid >= 0 AND remaining_balance >= 0
  AND jsonb_typeof(fees) = 'array'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_loans_request_key ON loans (request_key) WHERE request_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_loans_borrower_status ON loans (borrower_id, status);
CREATE INDEX IF NOT EXISTS idx_loans_branch_status ON loans (branch_id, status);

CREATE SEQUENCE IF NOT EXISTS loan_number_seq;
CREATE SEQUENCE IF NOT EXISTS loan_receipt_seq;

-- ------------------------------------------------------------
-- 3. Stored installment schedule
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_schedule (
  id                 TEXT PRIMARY KEY DEFAULT ('ls-' || gen_random_uuid()::text),
  loan_id            TEXT NOT NULL REFERENCES loans (id) ON DELETE RESTRICT,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  due_date           DATE NOT NULL,
  principal_due      NUMERIC(14,2) NOT NULL CHECK (principal_due >= 0),
  interest_due       NUMERIC(14,2) NOT NULL CHECK (interest_due >= 0),
  total_due          NUMERIC(14,2) NOT NULL,
  principal_paid     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (principal_paid >= 0),
  interest_paid      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (interest_paid >= 0),
  penalty_paid       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (penalty_paid >= 0),
  amount_paid        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_after      NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
  status             TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID')),
  paid_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT loan_schedule_total CHECK (total_due = principal_due + interest_due),
  CONSTRAINT loan_schedule_paid_within_due CHECK (principal_paid <= principal_due AND interest_paid <= interest_due),
  UNIQUE (loan_id, installment_number)
);
CREATE INDEX IF NOT EXISTS idx_loan_schedule_due ON loan_schedule (due_date) WHERE status <> 'PAID';

-- Running and finished loans keep the schedule they were created with, but
-- only when that schedule repays exactly the loan's principal. Older rows
-- carry schedules copied from other loans; those are left out rather than
-- stored as if they were the member's obligation.
WITH consistent AS (
  SELECT l.id
    FROM loans l
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(l.schedule) = 'array' THEN l.schedule ELSE '[]'::jsonb END) e
   WHERE l.status IN ('Active', 'Closed', 'Written Off')
   GROUP BY l.id, l.principal_amount
  HAVING sum(round(coalesce((e->>'principal')::numeric, 0), 2)) = l.principal_amount
)
INSERT INTO loan_schedule (loan_id, installment_number, due_date, principal_due, interest_due, total_due,
                           amount_paid, balance_after, status)
SELECT l.id,
       (e->>'installmentNumber')::int,
       (e->>'dueDate')::date,
       round(coalesce((e->>'principal')::numeric, 0), 2),
       round(coalesce((e->>'interest')::numeric, 0), 2),
       round(coalesce((e->>'principal')::numeric, 0), 2) + round(coalesce((e->>'interest')::numeric, 0), 2),
       least(round(coalesce((e->>'amountPaid')::numeric, 0), 2),
             round(coalesce((e->>'principal')::numeric, 0), 2) + round(coalesce((e->>'interest')::numeric, 0), 2)),
       greatest(round(coalesce((e->>'remainingBalance')::numeric, 0), 2), 0),
       CASE
         WHEN round(coalesce((e->>'amountPaid')::numeric, 0), 2) >=
              round(coalesce((e->>'principal')::numeric, 0), 2) + round(coalesce((e->>'interest')::numeric, 0), 2) THEN 'PAID'
         WHEN coalesce((e->>'amountPaid')::numeric, 0) > 0 THEN 'PARTIAL'
         ELSE 'PENDING'
       END
  FROM loans l
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(l.schedule) = 'array' THEN l.schedule ELSE '[]'::jsonb END) e
 WHERE l.id IN (SELECT id FROM consistent)
   AND e ? 'installmentNumber' AND e ? 'dueDate'
ON CONFLICT (loan_id, installment_number) DO NOTHING;

-- ------------------------------------------------------------
-- 4. Status history
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_status_history (
  id          TEXT PRIMARY KEY,
  loan_id     TEXT NOT NULL REFERENCES loans (id) ON DELETE RESTRICT,
  from_status TEXT,
  to_status   TEXT NOT NULL,
  reason      TEXT,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('CLIENT', 'STAFF', 'SYSTEM')),
  actor_id    TEXT,
  actor_name  TEXT,
  actor_role  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loan_status_history_loan ON loan_status_history (loan_id, created_at);

-- ------------------------------------------------------------
-- 5. Approval limits by role (NULL max_amount = no limit; no row = cannot approve)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_approval_limits (
  role       TEXT PRIMARY KEY,
  max_amount NUMERIC(14,2) CHECK (max_amount IS NULL OR max_amount > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

INSERT INTO loan_approval_limits (role, max_amount) VALUES
  ('LOAN_OFFICER', 50000.00),
  ('LOAN_PROCESSOR', 50000.00),
  ('MANAGER', 250000.00),
  ('ADMINISTRATOR', NULL),
  ('SUPER_ADMIN', NULL)
ON CONFLICT (role) DO NOTHING;

-- ------------------------------------------------------------
-- 6. Double-entry ledger (same shape as 0006 where it already exists)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS accounts (
  account_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code   TEXT NOT NULL UNIQUE,
  account_name   TEXT NOT NULL,
  account_type   account_type NOT NULL,
  normal_balance normal_balance NOT NULL,
  status         product_status NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entries (
  journal_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  description      TEXT NOT NULL,
  reference_number TEXT,
  source_module    TEXT NOT NULL DEFAULT 'client_services',
  source_id        UUID,
  created_by       UUID REFERENCES profiles (id) ON DELETE SET NULL,
  status           journal_status NOT NULL DEFAULT 'posted',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  line_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES journal_entries (journal_entry_id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  account_id  UUID NOT NULL REFERENCES accounts (account_id) ON DELETE RESTRICT,
  debit       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0 AND (debit = 0 OR credit = 0)),
  credit      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0 AND (debit = 0 OR credit = 0)),
  CONSTRAINT line_moves_value CHECK (debit > 0 OR credit > 0),
  UNIQUE (entry_id, line_number)
);

CREATE OR REPLACE FUNCTION assert_entry_balanced() RETURNS trigger AS $$
DECLARE d NUMERIC; c NUMERIC;
BEGIN
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO d, c FROM journal_entry_lines WHERE entry_id = COALESCE(NEW.entry_id, OLD.entry_id);
  IF d <> c THEN
    RAISE EXCEPTION 'Journal entry % is unbalanced: debits=% credits=%', COALESCE(NEW.entry_id, OLD.entry_id), d, c;
  END IF;
  RETURN NULL;
END $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_entry_balanced') THEN
    CREATE CONSTRAINT TRIGGER trg_entry_balanced
      AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION assert_entry_balanced();
  END IF;
END
$$;

-- Records keyed by text ids (loans, payments) post with source_ref.
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_ref TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posted_by_name TEXT;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_entries_idempotency ON journal_entries (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_entries_source_ref ON journal_entries (source_module, source_ref);

ALTER TABLE journal_entry_lines ADD COLUMN IF NOT EXISTS memo TEXT;

-- Chart of accounts (identical to the 0010 seed; configuration, not demo data).
INSERT INTO accounts (account_code, account_name, account_type, normal_balance) VALUES
  ('1010', 'Cash on Hand',                'asset',   'debit'),
  ('1020', 'Cash in Bank',                'asset',   'debit'),
  ('1110', 'Loans Receivable',            'asset',   'debit'),
  ('1115', 'Interest Receivable',         'asset',   'debit'),
  ('1120', 'Allowance for Impairment',    'asset',   'credit'),
  ('2010', 'Savings Deposits Payable',    'liability','credit'),
  ('2020', 'Special Deposits Payable',    'liability','credit'),
  ('3010', 'Members Share Capital',       'equity',  'credit'),
  ('4010', 'Interest Income on Loans',    'income',  'credit'),
  ('4020', 'Penalty Income',              'income',  'credit'),
  ('4030', 'Service Fees Income',         'income',  'credit'),
  ('4040', 'Savings Interest Expense',    'expense', 'debit')
ON CONFLICT (account_code) DO NOTHING;

-- ------------------------------------------------------------
-- 7. Disbursements (one per loan)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS loan_disbursements (
  id                  TEXT PRIMARY KEY,
  loan_id             TEXT NOT NULL UNIQUE REFERENCES loans (id) ON DELETE RESTRICT,
  branch_id           TEXT NOT NULL,
  idempotency_key     TEXT NOT NULL UNIQUE,
  receipt_number      TEXT NOT NULL UNIQUE,
  method              TEXT NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER', 'E_WALLET')),
  reference_number    TEXT,
  destination_account TEXT,
  disbursement_date   DATE NOT NULL,
  gross_amount        NUMERIC(14,2) NOT NULL CHECK (gross_amount > 0),
  total_fees          NUMERIC(14,2) NOT NULL CHECK (total_fees >= 0),
  net_amount          NUMERIC(14,2) NOT NULL CHECK (net_amount > 0),
  fees                JSONB NOT NULL DEFAULT '[]'::jsonb,
  journal_entry_id    UUID NOT NULL REFERENCES journal_entries (journal_entry_id) ON DELETE RESTRICT,
  disbursed_by        TEXT NOT NULL,
  disbursed_by_name   TEXT NOT NULL,
  disbursed_by_role   TEXT NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT loan_disbursements_net CHECK (net_amount = gross_amount - total_fees),
  CONSTRAINT loan_disbursements_reference CHECK (method = 'CASH' OR (reference_number IS NOT NULL AND destination_account IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loan_disbursements_reference
  ON loan_disbursements (method, upper(reference_number)) WHERE reference_number IS NOT NULL;

-- ------------------------------------------------------------
-- 8. Transaction register amounts
-- ------------------------------------------------------------

ALTER TABLE financial_transactions
  ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);

-- ------------------------------------------------------------
-- 9. Access: server-side only
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "Allow full access to loans" ON loans;
DROP POLICY IF EXISTS "Allow full access to loan_products" ON loan_products;

ALTER TABLE loan_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_approval_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_disbursements ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r text;
  t text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      FOREACH t IN ARRAY ARRAY['loans', 'loan_products', 'loan_schedule', 'loan_status_history',
                               'loan_approval_limits', 'loan_disbursements', 'financial_transactions'] LOOP
        EXECUTE format('REVOKE ALL ON TABLE %I FROM %I', t, r);
      END LOOP;
      EXECUTE format('REVOKE ALL ON SEQUENCE loan_number_seq, loan_receipt_seq FROM %I', r);
    END IF;
  END LOOP;
END
$$;

COMMIT;
