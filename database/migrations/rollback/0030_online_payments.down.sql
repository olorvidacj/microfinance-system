-- Rollback of 0030_online_payments.sql.
--
-- Refuses once online money has moved: the payments, their journal lines on
-- 1030 and any PAYOUT_REFUND transactions are records of real money and are
-- not thrown away. Before any online payment it removes everything 0030 added.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM online_deposits WHERE status = 'CREDITED')
     OR EXISTS (SELECT 1 FROM online_payouts WHERE debit_transaction_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM savings_transactions WHERE kind = 'PAYOUT_REFUND')
     OR EXISTS (SELECT 1 FROM journal_entry_lines l JOIN accounts a ON a.account_id = l.account_id WHERE a.account_code = '1030') THEN
    RAISE EXCEPTION '0030 rollback refused: online payments have been posted. Keep 0030.';
  END IF;
END
$$;

DROP TABLE IF EXISTS payment_events;
DROP FUNCTION IF EXISTS payment_events_append_only();
DROP TABLE IF EXISTS online_payouts;
DROP TABLE IF EXISTS online_deposits;
DROP TABLE IF EXISTS payout_accounts;

DELETE FROM accounts WHERE account_code = '1030';

ALTER TABLE savings_transactions DROP CONSTRAINT IF EXISTS savings_transactions_valid;
ALTER TABLE savings_transactions ADD CONSTRAINT savings_transactions_valid CHECK (
  kind IN ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'OPENING_BALANCE', 'TRANSFER_IN', 'TRANSFER_OUT')
  AND balance_after = balance_before + signed_amount
  AND amount = abs(signed_amount)
  AND (kind <> 'INTEREST' OR interest_period ~ '^[0-9]{4}-[0-9]{2}$')
) NOT VALID;

COMMIT;
