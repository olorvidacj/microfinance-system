-- Rollback for 0028_group_lending.sql
--
-- Not reversible:
-- - Journal entries already posted (fund opening, contributions, covers,
--   repayments) stay in the ledger; 0006 owns it. Account 2040 stays.
-- - Payments made from the solidarity fund stay (method SOLIDARITY_FUND);
--   the restored payment check is NOT VALID so those rows are kept.
-- - The members jsonb is rebuilt from group_members (active members only);
--   consents, meetings, attendance, covers and fund history are dropped.
-- - Group statuses go back to the old words (Forming, Active, Suspended,
--   Dissolved); the fund balance returns to double precision.

BEGIN;

-- members jsonb from group_members
UPDATE solidarity_groups g
   SET members = coalesce((
         SELECT jsonb_agg(jsonb_build_object(
                  'borrowerId', b.id, 'borrowerNumber', coalesce(b.borrower_number, ''), 'fullName', b.full_name, 'phone', coalesce(b.phone, ''),
                  'role', initcap(m.role), 'status', 'Good Standing', 'activeLoanAmount', 0, 'remainingBalance', 0, 'savingsBalance', 0, 'weeklyDues', 0)
                  ORDER BY m.joined_at, m.id)
           FROM group_members m JOIN borrowers b ON b.id = m.borrower_id
          WHERE m.group_id = g.id AND m.status = 'ACTIVE'), '[]'::jsonb);

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_split_adds_up;
ALTER TABLE payments ADD CONSTRAINT payments_split_adds_up CHECK (
  allocation IS NULL OR (amount = principal_portion + interest_portion + penalty_portion + excess_amount
                         AND payment_method IN ('CASH', 'BANK_TRANSFER', 'E_WALLET'))
) NOT VALID;

DROP TRIGGER IF EXISTS trg_group_fund_transactions_no_delete ON group_fund_transactions;
DROP FUNCTION IF EXISTS group_fund_transactions_no_delete();
DROP TABLE IF EXISTS group_overdue_alerts;
DROP TABLE IF EXISTS group_fund_transactions;
DROP TABLE IF EXISTS group_collections;
DROP TABLE IF EXISTS solidarity_covers;
DROP TABLE IF EXISTS group_attendance;
DROP TABLE IF EXISTS group_meetings;
DROP TABLE IF EXISTS group_loan_consents;
DROP INDEX IF EXISTS idx_loans_group;
ALTER TABLE loans DROP COLUMN IF EXISTS group_id;
DROP TABLE IF EXISTS group_members;
DROP SEQUENCE IF EXISTS group_fund_txn_seq;
DROP SEQUENCE IF EXISTS group_cover_seq;
DROP SEQUENCE IF EXISTS group_collection_seq;
DROP SEQUENCE IF EXISTS group_code_seq;

ALTER TABLE solidarity_groups DROP CONSTRAINT IF EXISTS solidarity_groups_valid;
UPDATE solidarity_groups SET status = initcap(lower(status)) WHERE status IN ('FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED');
ALTER TABLE solidarity_groups ALTER COLUMN status SET DEFAULT 'Active';
UPDATE solidarity_groups SET leader_borrower_id = coalesce(leader_borrower_id, ''), leader_name = coalesce(leader_name, ''), leader_phone = coalesce(leader_phone, '');
ALTER TABLE solidarity_groups ALTER COLUMN leader_borrower_id SET NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN leader_name SET NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN leader_phone SET NOT NULL;
UPDATE solidarity_groups SET members = '[]'::jsonb WHERE members IS NULL;
ALTER TABLE solidarity_groups ALTER COLUMN members DROP DEFAULT;
ALTER TABLE solidarity_groups ALTER COLUMN members SET NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN solidarity_fund_balance DROP NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN solidarity_fund_balance TYPE DOUBLE PRECISION USING solidarity_fund_balance::double precision;
ALTER TABLE solidarity_groups
  DROP COLUMN IF EXISTS dissolved_at,
  DROP COLUMN IF EXISTS updated_at,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS status_reason,
  DROP COLUMN IF EXISTS arrears_threshold_days,
  DROP COLUMN IF EXISTS meeting_frequency;

COMMIT;
