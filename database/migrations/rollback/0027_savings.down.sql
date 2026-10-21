-- Rollback for 0027_savings.sql
--
-- Not reversible:
-- - Withdrawal request statuses stay as codes (PENDING / APPROVED / ...).
-- - Journal entries already posted (including the opening-balance entry)
--   stay in the ledger; 0006 owns it.
-- - OPENING_BALANCE and other transaction rows stay; only the columns 0027
--   added are dropped, so the history keeps the carried-over row.
-- - Money columns return to double precision.

BEGIN;

-- Views that read the savings tables are set aside during the type changes
-- and recreated unchanged at the end (as in 0027).
CREATE TEMP TABLE _rb0027_views ON COMMIT DROP AS
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
  FOR v IN SELECT name FROM _rb0027_views LOOP
    EXECUTE format('DROP VIEW %s', v.name);
  END LOOP;
END
$$;

ALTER TABLE savings_withdrawal_requests DROP CONSTRAINT IF EXISTS savings_withdrawal_requests_valid;
ALTER TABLE savings_withdrawal_requests
  DROP COLUMN IF EXISTS transaction_id,
  DROP COLUMN IF EXISTS decided_at,
  DROP COLUMN IF EXISTS decided_by,
  DROP COLUMN IF EXISTS destination_account,
  DROP COLUMN IF EXISTS destination;
ALTER TABLE savings_withdrawal_requests ALTER COLUMN status SET DEFAULT 'Pending Approval';
ALTER TABLE savings_withdrawal_requests
  ALTER COLUMN current_balance TYPE double precision USING current_balance::double precision,
  ALTER COLUMN account_balance_before TYPE double precision USING account_balance_before::double precision,
  ALTER COLUMN requested_amount TYPE double precision USING requested_amount::double precision,
  ALTER COLUMN maintaining_balance TYPE double precision USING maintaining_balance::double precision,
  ALTER COLUMN remaining_balance_after TYPE double precision USING remaining_balance_after::double precision;

DROP TRIGGER IF EXISTS trg_savings_transactions_no_delete ON savings_transactions;
DROP FUNCTION IF EXISTS savings_transactions_no_delete();
DROP INDEX IF EXISTS idx_savings_txn_account;
DROP INDEX IF EXISTS uq_savings_txn_interest;
DROP INDEX IF EXISTS uq_savings_txn_idempotency;
ALTER TABLE savings_transactions DROP CONSTRAINT IF EXISTS savings_transactions_valid;
ALTER TABLE savings_transactions
  DROP COLUMN IF EXISTS sequence,
  DROP COLUMN IF EXISTS withdrawal_request_id,
  DROP COLUMN IF EXISTS posted_by,
  DROP COLUMN IF EXISTS branch_id,
  DROP COLUMN IF EXISTS interest_period,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS journal_entry_id,
  DROP COLUMN IF EXISTS destination_account,
  DROP COLUMN IF EXISTS reference,
  DROP COLUMN IF EXISTS method,
  DROP COLUMN IF EXISTS signed_amount,
  DROP COLUMN IF EXISTS kind;
ALTER TABLE savings_transactions
  ALTER COLUMN amount TYPE double precision USING amount::double precision,
  ALTER COLUMN balance_before TYPE double precision USING balance_before::double precision,
  ALTER COLUMN balance_after TYPE double precision USING balance_after::double precision;
DROP SEQUENCE IF EXISTS savings_account_seq;
DROP SEQUENCE IF EXISTS savings_txn_seq;

DROP INDEX IF EXISTS idx_savings_accounts_member;
DROP INDEX IF EXISTS uq_savings_accounts_passbook;
ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS savings_accounts_valid;
ALTER TABLE savings_accounts
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS maturity_date,
  DROP COLUMN IF EXISTS last_activity_date,
  DROP COLUMN IF EXISTS status_reason,
  DROP COLUMN IF EXISTS closed_at,
  DROP COLUMN IF EXISTS opened_at,
  DROP COLUMN IF EXISTS branch_id,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS product_id;
ALTER TABLE savings_accounts ALTER COLUMN balance DROP NOT NULL;
ALTER TABLE savings_accounts
  ALTER COLUMN balance TYPE double precision USING balance::double precision,
  ALTER COLUMN maintaining_balance TYPE double precision USING maintaining_balance::double precision,
  ALTER COLUMN interest_rate TYPE double precision USING interest_rate::double precision;

DROP TABLE IF EXISTS savings_products;

-- The older table 0027 set aside gets its name back.
DO $$
DECLARE
  c record;
BEGIN
  IF to_regclass('public.legacy_savings_products') IS NOT NULL AND to_regclass('public.savings_products') IS NULL THEN
    ALTER TABLE public.legacy_savings_products RENAME TO savings_products;
    FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.savings_products'::regclass AND conname LIKE 'legacy_savings_products%' LOOP
      EXECUTE format('ALTER TABLE public.savings_products RENAME CONSTRAINT %I TO %I', c.conname, substr(c.conname, 8));
    END LOOP;
  END IF;
END
$$;

-- Views set aside at the top, recreated unchanged.
DO $$
DECLARE
  v record;
  g record;
BEGIN
  FOR v IN SELECT * FROM _rb0027_views LOOP
    EXECUTE format('CREATE VIEW %s%s AS %s', v.name, CASE WHEN v.opts IS NULL THEN '' ELSE ' WITH (' || array_to_string(v.opts, ', ') || ')' END, v.def);
    FOR g IN SELECT a.privilege_type, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(a.grantee)) END AS who
               FROM aclexplode(v.acl) a LOOP
      EXECUTE format('GRANT %s ON %s TO %s', g.privilege_type, v.name, g.who);
    END LOOP;
  END LOOP;
END
$$;

COMMIT;
