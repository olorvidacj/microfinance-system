-- ============================================================
-- 0027 - Savings products, account lifecycle, ledgered transactions
--
-- Requires: 0025 (ledger tables), 0026.
--
-- 1. savings_products: regular, compulsory/group and time deposit, each
--    with a rate, accrual method, minimum balance and withdrawal limits.
--    One REGULAR product (sp-regular) is created so existing accounts have
--    one; its terms are the ones the code applied before (1%, PHP 1,000).
-- 2. savings_accounts: product, status (ACTIVE / DORMANT / FROZEN / CLOSED),
--    branch, exact balance. The balance column is a cache of the account's
--    transactions and is only written together with them.
-- 3. savings_transactions: signed exact amounts, kind, journal entry,
--    idempotency key, one INTEREST row per account and month. Never deleted.
-- 4. Existing balances are brought into the ledger: where an account's
--    history does not add up to its balance an OPENING_BALANCE row makes up
--    the difference, and one journal entry credits Savings Deposits Payable
--    against 3900 Opening Balance Equity for the total.
-- 5. Withdrawal requests record where the money goes (0015 recorded which
--    account); statuses become PENDING / APPROVED / REJECTED / CANCELLED.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0. Live-database compatibility
-- ------------------------------------------------------------

-- Views that read the savings tables (production has oversight_savings_summary_v1)
-- would block the column type changes below. They are set aside here and
-- recreated unchanged, with their options and grants, at the end.
CREATE TEMP TABLE _mig0027_views ON COMMIT DROP AS
SELECT v.oid::regclass::text AS name, rtrim(pg_get_viewdef(v.oid, true), '; ') AS def, v.reloptions AS opts, v.relacl AS acl
  FROM pg_class v
 WHERE v.relkind = 'v'
   AND v.oid IN (SELECT r.ev_class
                   FROM pg_depend d JOIN pg_rewrite r ON r.oid = d.objid
                  WHERE d.refobjid IN (SELECT c.oid FROM pg_class c
                                        WHERE c.oid IN (to_regclass('public.savings_accounts'), to_regclass('public.savings_transactions'),
                                                        to_regclass('public.savings_withdrawal_requests')))
                    AND r.ev_class <> d.refobjid);
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT name FROM _mig0027_views LOOP
    EXECUTE format('DROP VIEW %s', v.name);
  END LOOP;
END
$$;

-- Production also has an older, unused savings_products table (the 0001-0009
-- model: savings_product_id, product_code, ...). It is kept, renamed, with its
-- rows and policies; its constraint names move aside so the new table can use them.
DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.savings_products') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'savings_products' AND column_name = 'id') THEN
    ALTER TABLE public.savings_products RENAME TO legacy_savings_products;
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.legacy_savings_products'::regclass AND conname LIKE 'savings_products%' LOOP
      EXECUTE format('ALTER TABLE public.legacy_savings_products RENAME CONSTRAINT %I TO %I', c.conname, 'legacy_' || c.conname);
    END LOOP;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1. Products
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS savings_products (
  id                        TEXT PRIMARY KEY,
  code                      TEXT NOT NULL,
  name                      TEXT NOT NULL,
  kind                      TEXT NOT NULL CHECK (kind IN ('REGULAR', 'COMPULSORY', 'TIME_DEPOSIT')),
  annual_rate               NUMERIC(7,4) NOT NULL CHECK (annual_rate >= 0 AND annual_rate <= 100),
  accrual_method            TEXT NOT NULL CHECK (accrual_method IN ('AVERAGE_DAILY_BALANCE', 'MINIMUM_BALANCE')),
  minimum_balance           NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (minimum_balance >= 0),
  minimum_opening_deposit   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (minimum_opening_deposit >= 0),
  max_withdrawal_amount     NUMERIC(14,2) CHECK (max_withdrawal_amount IS NULL OR max_withdrawal_amount > 0),
  max_withdrawals_per_month INTEGER CHECK (max_withdrawals_per_month IS NULL OR max_withdrawals_per_month >= 0),
  term_months               INTEGER CHECK (term_months IS NULL OR term_months BETWEEN 1 AND 120),
  status                    TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT savings_products_term CHECK ((kind = 'TIME_DEPOSIT') = (term_months IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_savings_products_code ON savings_products (upper(code));

INSERT INTO savings_products (id, code, name, kind, annual_rate, accrual_method, minimum_balance, minimum_opening_deposit)
VALUES ('sp-regular', 'SAV-REGULAR', 'Regular savings', 'REGULAR', 1.0000, 'AVERAGE_DAILY_BALANCE', 1000.00, 0)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Accounts
-- ------------------------------------------------------------

ALTER TABLE savings_accounts
  ALTER COLUMN balance TYPE numeric(14,2) USING round(coalesce(balance, 0)::numeric, 2),
  ALTER COLUMN maintaining_balance TYPE numeric(14,2) USING round(coalesce(maintaining_balance, 0)::numeric, 2),
  ALTER COLUMN interest_rate TYPE numeric(7,4) USING round(coalesce(interest_rate, 0)::numeric, 4);
ALTER TABLE savings_accounts ALTER COLUMN balance SET DEFAULT 0;
ALTER TABLE savings_accounts ALTER COLUMN balance SET NOT NULL;

ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS product_id TEXT REFERENCES savings_products (id) ON DELETE RESTRICT;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS maturity_date DATE;
ALTER TABLE savings_accounts ADD COLUMN IF NOT EXISTS group_id TEXT;

UPDATE savings_accounts SET product_id = 'sp-regular' WHERE product_id IS NULL;
UPDATE savings_accounts sa SET branch_id = b.branch_id FROM borrowers b WHERE sa.branch_id IS NULL AND b.id = sa.member_id;
UPDATE savings_accounts SET opened_at = coalesce(created_at, now()) WHERE opened_at IS NULL;
ALTER TABLE savings_accounts ALTER COLUMN product_id SET NOT NULL;

ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS savings_accounts_valid;
ALTER TABLE savings_accounts ADD CONSTRAINT savings_accounts_valid CHECK (
  status IN ('ACTIVE', 'DORMANT', 'FROZEN', 'CLOSED')
  AND balance >= 0
  AND (status <> 'CLOSED' OR (balance = 0 AND closed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_savings_accounts_passbook ON savings_accounts (passbook_number);
CREATE INDEX IF NOT EXISTS idx_savings_accounts_member ON savings_accounts (member_id);

-- ------------------------------------------------------------
-- 3. Transactions
-- ------------------------------------------------------------

ALTER TABLE savings_transactions
  ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2),
  ALTER COLUMN balance_before TYPE numeric(14,2) USING round(balance_before::numeric, 2),
  ALTER COLUMN balance_after TYPE numeric(14,2) USING round(balance_after::numeric, 2);

ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS kind TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS signed_amount NUMERIC(14,2);
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS method TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS destination_account TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries (journal_entry_id) ON DELETE RESTRICT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS interest_period TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS posted_by TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS withdrawal_request_id TEXT;
ALTER TABLE savings_transactions ADD COLUMN IF NOT EXISTS sequence BIGINT;

UPDATE savings_transactions
   SET kind = CASE WHEN type ILIKE '%withdraw%' THEN 'WITHDRAWAL'
                   WHEN type ILIKE '%interest%' THEN 'INTEREST'
                   ELSE 'DEPOSIT' END
 WHERE kind IS NULL;
UPDATE savings_transactions SET signed_amount = CASE WHEN kind = 'WITHDRAWAL' THEN -amount ELSE amount END WHERE signed_amount IS NULL;

CREATE SEQUENCE IF NOT EXISTS savings_txn_seq;
CREATE SEQUENCE IF NOT EXISTS savings_account_seq;

-- History order for running balances: by date, then creation.
WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY date, created_at, id) AS rn FROM savings_transactions WHERE sequence IS NULL
)
UPDATE savings_transactions t SET sequence = o.rn FROM ordered o WHERE t.id = o.id;
SELECT setval('savings_txn_seq', greatest((SELECT coalesce(max(sequence), 0) FROM savings_transactions), 1));

-- Opening balance rows where the history does not add up to the balance.
INSERT INTO savings_transactions (id, savings_account_id, member_id, member_name, transaction_number, date, type, amount,
                                  balance_before, balance_after, processed_by, notes, kind, signed_amount, branch_id, sequence)
SELECT 'stx-open-' || sa.id, sa.id, sa.member_id, sa.member_name, 'OPEN-' || sa.passbook_number, current_date::text,
       'Opening balance', abs(sa.balance - coalesce(h.total, 0)),
       coalesce(h.total, 0), sa.balance, 'Migration 0027',
       'Balance carried over from before transactions were ledgered.',
       'OPENING_BALANCE', sa.balance - coalesce(h.total, 0), sa.branch_id, nextval('savings_txn_seq')
  FROM savings_accounts sa
  LEFT JOIN (SELECT savings_account_id, sum(signed_amount) AS total FROM savings_transactions GROUP BY 1) h
         ON h.savings_account_id = sa.id
 WHERE sa.balance <> coalesce(h.total, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE savings_transactions ALTER COLUMN kind SET NOT NULL;
ALTER TABLE savings_transactions ALTER COLUMN signed_amount SET NOT NULL;
ALTER TABLE savings_transactions ALTER COLUMN sequence SET DEFAULT nextval('savings_txn_seq');
ALTER TABLE savings_transactions ALTER COLUMN sequence SET NOT NULL;
ALTER TABLE savings_transactions DROP CONSTRAINT IF EXISTS savings_transactions_valid;
ALTER TABLE savings_transactions ADD CONSTRAINT savings_transactions_valid CHECK (
  kind IN ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'OPENING_BALANCE', 'TRANSFER_IN', 'TRANSFER_OUT')
  AND balance_after = balance_before + signed_amount
  AND amount = abs(signed_amount)
  AND (kind <> 'INTEREST' OR interest_period ~ '^[0-9]{4}-[0-9]{2}$')
) NOT VALID; -- older rows may not chain; every new row must
CREATE UNIQUE INDEX IF NOT EXISTS uq_savings_txn_idempotency ON savings_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_savings_txn_interest ON savings_transactions (savings_account_id, interest_period) WHERE interest_period IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_savings_txn_account ON savings_transactions (savings_account_id, sequence);

CREATE OR REPLACE FUNCTION savings_transactions_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Savings transactions are never deleted; post a correcting transaction instead.' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS trg_savings_transactions_no_delete ON savings_transactions;
CREATE TRIGGER trg_savings_transactions_no_delete BEFORE DELETE ON savings_transactions FOR EACH ROW EXECUTE FUNCTION savings_transactions_no_delete();

-- ------------------------------------------------------------
-- 4. Existing balances into the general ledger
-- ------------------------------------------------------------

INSERT INTO accounts (account_code, account_name, account_type, normal_balance) VALUES
  ('3900', 'Opening Balance Equity', 'equity', 'credit')
ON CONFLICT (account_code) DO NOTHING;

DO $$
DECLARE
  total NUMERIC;
  entry UUID;
BEGIN
  SELECT coalesce(sum(balance), 0) INTO total FROM savings_accounts;
  IF total > 0 AND NOT EXISTS (SELECT 1 FROM journal_entries WHERE idempotency_key = 'savings-opening-0027') THEN
    INSERT INTO journal_entries (entry_date, description, reference_number, source_module, source_ref, posted_by, posted_by_name, idempotency_key, status)
    VALUES (current_date, 'Savings balances carried into the ledger (0027)', 'MIG-0027', 'savings_migration', 'all', 'migration', 'Migration 0027', 'savings-opening-0027', 'posted')
    RETURNING journal_entry_id INTO entry;
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, memo)
    SELECT entry, 1, account_id, total, 0, 'Opening balance equity' FROM accounts WHERE account_code = '3900';
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, memo)
    SELECT entry, 2, account_id, 0, total, 'Savings balances carried over' FROM accounts WHERE account_code = '2010';
    UPDATE savings_transactions SET journal_entry_id = entry WHERE kind = 'OPENING_BALANCE' AND journal_entry_id IS NULL;
  END IF;
END
$$;

-- The member-wide total stays the sum of the member's accounts.
UPDATE borrowers b SET savings_balance = s.total
  FROM (SELECT member_id, sum(balance) AS total FROM savings_accounts GROUP BY 1) s
 WHERE b.id = s.member_id;

-- ------------------------------------------------------------
-- 5. Withdrawal requests
-- ------------------------------------------------------------

ALTER TABLE savings_withdrawal_requests
  ALTER COLUMN current_balance TYPE numeric(14,2) USING round(current_balance::numeric, 2),
  ALTER COLUMN account_balance_before TYPE numeric(14,2) USING round(account_balance_before::numeric, 2),
  ALTER COLUMN requested_amount TYPE numeric(14,2) USING round(requested_amount::numeric, 2),
  ALTER COLUMN maintaining_balance TYPE numeric(14,2) USING round(coalesce(maintaining_balance, 0)::numeric, 2),
  ALTER COLUMN remaining_balance_after TYPE numeric(14,2) USING round(remaining_balance_after::numeric, 2);

ALTER TABLE savings_withdrawal_requests ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE savings_withdrawal_requests ADD COLUMN IF NOT EXISTS destination_account TEXT;
ALTER TABLE savings_withdrawal_requests ADD COLUMN IF NOT EXISTS decided_by TEXT;
ALTER TABLE savings_withdrawal_requests ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE savings_withdrawal_requests ADD COLUMN IF NOT EXISTS transaction_id TEXT;

UPDATE savings_withdrawal_requests
   SET status = CASE
         WHEN status ILIKE 'pending%' THEN 'PENDING'
         WHEN status ILIKE ANY (ARRAY['approved%', 'disbursed%', 'completed%', 'released%']) THEN 'APPROVED'
         WHEN status ILIKE 'rejected%' THEN 'REJECTED'
         WHEN status ILIKE 'cancel%' THEN 'CANCELLED'
         ELSE status END,
       destination = coalesce(destination, 'CASH_PICKUP');
ALTER TABLE savings_withdrawal_requests ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE savings_withdrawal_requests DROP CONSTRAINT IF EXISTS savings_withdrawal_requests_valid;
ALTER TABLE savings_withdrawal_requests ADD CONSTRAINT savings_withdrawal_requests_valid CHECK (
  status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
  AND (destination IS NULL OR destination IN ('CASH_PICKUP', 'BANK_TRANSFER', 'E_WALLET'))
  AND requested_amount > 0
);

-- ------------------------------------------------------------
-- 6. Access: server-side only
-- ------------------------------------------------------------

ALTER TABLE savings_products ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE savings_products, savings_accounts, savings_transactions, savings_withdrawal_requests FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE savings_txn_seq, savings_account_seq FROM %I', r);
    END IF;
  END LOOP;
END
$$;

-- The views set aside in section 0, as they were.
DO $$
DECLARE
  v record;
  g record;
BEGIN
  FOR v IN SELECT * FROM _mig0027_views LOOP
    EXECUTE format('CREATE VIEW %s%s AS %s', v.name, CASE WHEN v.opts IS NULL THEN '' ELSE ' WITH (' || array_to_string(v.opts, ', ') || ')' END, v.def);
    FOR g IN SELECT a.privilege_type, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS who
               FROM aclexplode(v.acl) a LOOP
      EXECUTE format('GRANT %s ON %s TO %s', g.privilege_type, v.name, g.who);
    END LOOP;
  END LOOP;
END
$$;

COMMIT;
