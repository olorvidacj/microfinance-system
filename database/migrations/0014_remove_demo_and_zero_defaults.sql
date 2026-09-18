-- ============================================================
-- 0014 — REMOVE DEMO/FABRICATED DATA + ZERO DEFAULT BALANCES
--        (spec: no fabricated client/financial data anywhere)
--
-- Idempotent. Safe to re-run. Never drops tables. Never touches
-- configuration (branches, staff, loan products, KYC document
-- requirements, chart of accounts).
--
-- What it does:
--   1. Sets monetary column defaults to 0 on legacy tables so new
--      rows start from a real zero balance.
--   2. Purges fabricated member/financial rows.
--
-- DELETION SAFETY: the only rows this ever removes are
--   a) borrowers whose id matches the legacy demo patterns
--      (`bor-<digits>` / `b-<digits>`, or the old CLI-2023 /
--      MBR-2024 demo member numbers), and
--   b) every child/financial row that references them.
-- The application now generates UUID-suffixed ids (bor-<uuid>,
-- sav-<uuid>, grp-<uuid>) and real member numbers (CLI-<year>-NNNN,
-- LLN/LA/LN-APP loan numbers), so genuine records are never matched.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ZERO DEFAULTS (idempotent ALTER TABLE ... SET DEFAULT)
-- ------------------------------------------------------------
ALTER TABLE borrowers            ALTER COLUMN savings_balance     SET DEFAULT 0;
ALTER TABLE borrowers            ALTER COLUMN share_capital       SET DEFAULT 0;
ALTER TABLE borrowers            ALTER COLUMN active_loans_count  SET DEFAULT 0;
ALTER TABLE borrowers            ALTER COLUMN total_borrowed      SET DEFAULT 0;
ALTER TABLE borrowers            ALTER COLUMN total_repaid        SET DEFAULT 0;
ALTER TABLE savings_accounts     ALTER COLUMN balance             SET DEFAULT 0;
ALTER TABLE membership_applications ALTER COLUMN initial_share_capital SET DEFAULT 0;
ALTER TABLE loans                ALTER COLUMN total_paid          SET DEFAULT 0;

-- ------------------------------------------------------------
-- 2) CAPTURE DEMO BORROWER IDS
--    (legacy demo constants only: bor-01..N and b-1..N ids,
--     plus the fabricated CLI-2023/MBR-2024 demo member numbers)
-- ------------------------------------------------------------
CREATE TEMP TABLE _demo_borrower_ids (id text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _demo_borrower_ids (id)
SELECT id FROM borrowers
WHERE id ~ '^bor-[0-9]+$'          -- bor-01 ... bor-99 (demo)
   OR id ~ '^b-[0-9]+$'            -- b-1 ... b-99 (demo)
   OR borrower_number ~ '^CLI-2023-'   -- fabricated 2023 member numbers
   OR borrower_number ~ '^MBR-2024-';  -- fabricated MBR member numbers

-- ------------------------------------------------------------
-- 3) DEMO SAVINGS ACCOUNT IDS (old seed created sav-<digits> /
--    sav-bor-<digits> and PB-<demo member number> passbooks)
-- ------------------------------------------------------------
CREATE TEMP TABLE _demo_savings_ids (id text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _demo_savings_ids (id)
SELECT id FROM savings_accounts
WHERE member_id IN (SELECT id FROM _demo_borrower_ids)
   OR id ~ '^sav-[0-9]+$'
   OR id ~ '^sav-bor-[0-9]+$'
   OR passbook_number ~ '^PB-(CLI-2023|MBR-2024)';

-- ------------------------------------------------------------
-- 4) DEMO LOAN IDS (demo loans always belonged to demo borrowers;
--    real loans are LA-<year>-NNNN / LN-APP-NNNNN / LLN-. The
--    fabricated LN-2025/LN-2026 demo numbers are excluded directly.)
-- ------------------------------------------------------------
CREATE TEMP TABLE _demo_loan_ids (id text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _demo_loan_ids (id)
SELECT id FROM loans
WHERE borrower_id IN (SELECT id FROM _demo_borrower_ids)
   OR loan_number ~ '^LN-202[0-9]-';

-- children first, then the records themselves
DELETE FROM payments WHERE loan_id IN (SELECT id FROM _demo_loan_ids);
DELETE FROM savings_transactions
  WHERE savings_account_id IN (SELECT id FROM _demo_savings_ids)
     OR member_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM financial_transactions
  WHERE client_id IN (SELECT id FROM _demo_borrower_ids)
     OR account_or_loan_id IN (SELECT id FROM _demo_loan_ids);
DELETE FROM kyc_documents  WHERE borrower_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM kyc_submissions  WHERE borrower_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM kyc_audit_log  WHERE borrower_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM documents      WHERE client_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM savings_withdrawal_requests
  WHERE member_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM member_update_requests
  WHERE member_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM member_follow_up_logs
  WHERE member_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM membership_applications
  WHERE created_borrower_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM branch_notifications
  WHERE related_id IN (SELECT id FROM _demo_borrower_ids);
DELETE FROM solidarity_groups
  WHERE leader_borrower_id IN (SELECT id FROM _demo_borrower_ids)
     OR id ~ '^grp-[0-9]+$';
DELETE FROM loans WHERE id IN (SELECT id FROM _demo_loan_ids);
DELETE FROM savings_accounts WHERE id IN (SELECT id FROM _demo_savings_ids);

-- ------------------------------------------------------------
-- 5) DEMO BORROWERS LAST
-- ------------------------------------------------------------
DELETE FROM borrowers WHERE id IN (SELECT id FROM _demo_borrower_ids);