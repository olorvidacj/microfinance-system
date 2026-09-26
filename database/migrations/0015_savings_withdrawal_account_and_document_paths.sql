-- ============================================================
-- 0015 - SAVINGS WITHDRAWAL ACCOUNT TARGET + DOCUMENT STORAGE PATH
--        (requires: legacy schema already present)
--
-- Idempotent. Safe to re-run. Additive only: no column is
-- dropped, renamed, retyped or made NOT NULL, and no row is
-- deleted. Existing readers keep working because every new
-- column is nullable.
--
-- Why:
--   1. savings_withdrawal_requests has no record of WHICH
--      savings account a withdrawal came from. The debit is
--      applied to the correct account at request time, but an
--      auditor (or the approval workflow) cannot tell which
--      account a pending request refers to, and a member with
--      two passbooks is indistinguishable in the queue.
--      account_balance_before additionally preserves the
--      account-level balance; current_balance is the MEMBER
--      TOTAL, not the account balance, so the two must not be
--      conflated.
--   2. documents.fileUrl is overloaded: it holds a durable
--      Supabase Storage OBJECT PATH for new uploads but a
--      public/signed URL for anything seeded earlier. A
--      dedicated storage_path removes the ambiguity, and
--      file_name lets the UI show a real filename instead of
--      parsing it back out of the path.
--
-- NOTE ON BACKFILL: documents is currently empty, so
-- storage_path/file_name start NULL and are populated by
-- src/db/documentStorage.ts from here on. The one existing
-- savings_withdrawal_requests row is backfilled only when the
-- member has exactly one account, because guessing between
-- several accounts would write a false audit record - and
-- leaving it NULL is honest, whereas a wrong id is not.
-- ============================================================

-- ------------------------------------------------------------
-- 1) savings_withdrawal_requests: which account, and from what balance
-- ------------------------------------------------------------
ALTER TABLE savings_withdrawal_requests ADD COLUMN IF NOT EXISTS account_id text;
ALTER TABLE savings_withdrawal_requests ADD COLUMN IF NOT EXISTS account_balance_before double precision;

COMMENT ON COLUMN savings_withdrawal_requests.account_id IS
  'Savings account (savings_accounts.id) the withdrawal was requested against. Null only for pre-0015 rows.';
COMMENT ON COLUMN savings_withdrawal_requests.account_balance_before IS
  'Balance of that specific account before the debit. Distinct from current_balance, which is the member-wide total.';

-- Backfill account_id ONLY where the member has exactly one account.
-- A member with 2+ accounts is left NULL on purpose: an ambiguous
-- guess is worse than an explicit unknown.
UPDATE savings_withdrawal_requests swr
   SET account_id = sa.id
  FROM (SELECT member_id, min(id) AS id
          FROM savings_accounts
         GROUP BY member_id
        HAVING count(*) = 1) sa
 WHERE swr.account_id IS NULL
   AND swr.member_id = sa.member_id;

-- Backfill account_balance_before only for rows we just resolved to a
-- single account. NOT current_balance: that is the member total.
UPDATE savings_withdrawal_requests swr
   SET account_balance_before = swr.current_balance - swr.requested_amount
 WHERE swr.account_id IS NOT NULL
   AND swr.account_balance_before IS NULL;

-- ------------------------------------------------------------
-- 2) documents: durable storage path + original filename
-- ------------------------------------------------------------
ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_path text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name text;

COMMENT ON COLUMN documents.storage_path IS
  'Durable path of the object inside the private kyc-documents bucket. fileUrl may be a signed/public URL; storage_path never expires.';
COMMENT ON COLUMN documents.file_name IS
  'Original uploaded filename, for display. Not derivable from doc_name, which is the human label.';

-- Seeded rows (if any) predate this migration. Copy a fileUrl into
-- storage_path only when it is a bare object path, never an http(s)
-- URL - signing those is what storage_path exists to avoid.
UPDATE documents
   SET storage_path = file_url
 WHERE storage_path IS NULL
   AND file_url IS NOT NULL
   AND file_url NOT LIKE 'http://%'
   AND file_url NOT LIKE 'https://%';

-- ------------------------------------------------------------
-- 3) VERIFICATION (read-only; safe to run any time)
-- ------------------------------------------------------------
-- Expect 4 columns to exist, and no row to claim an account that
-- does not exist in savings_accounts.
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public'
--      AND table_name = 'savings_withdrawal_requests'
--      AND column_name IN ('account_id','account_balance_before');
--
--   SELECT count(*) AS dangling
--     FROM savings_withdrawal_requests swr
--     LEFT JOIN savings_accounts sa ON sa.id = swr.account_id
--    WHERE swr.account_id IS NOT NULL AND sa.id IS NULL;   -- expect 0
