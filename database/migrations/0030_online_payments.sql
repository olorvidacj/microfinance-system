-- ============================================================
-- 0030 - Online savings deposits and instant withdrawals
--
-- Requires: 0027 (savings), 0029.
--
-- 1. payout_accounts: bank and e-wallet accounts a member is paid out to.
--    The holder name must be the member's own (checked by the server) and
--    branch staff verify each account once before money is sent to it. One
--    account number can be verified for one member only.
-- 2. online_deposits: one row per checkout. Credited at most once: the
--    savings transaction it created is unique, and CREDITED holds exactly
--    when that transaction exists.
-- 3. online_payouts: one row per instant withdrawal. Money leaves the
--    savings account only after the one-time code (status past AWAITING_OTP
--    holds exactly when the debit exists) and comes back at most once when
--    the provider fails or reverses the payout (REFUNDED holds exactly when
--    the refund exists).
-- 4. payment_events: every confirmation a provider sent, as received, and
--    what it did. Never changed or deleted.
-- 5. Ledger: 1030 Due from Payment Provider holds the money the provider has
--    collected for us (deposits in, payouts out). savings_transactions gains
--    the PAYOUT_REFUND kind for money returned from a failed payout.
--
-- Rollback: rollback/0030_online_payments.down.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Payout accounts
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payout_accounts (
  id                TEXT PRIMARY KEY,
  member_id         TEXT NOT NULL REFERENCES borrowers (id),
  branch_id         TEXT NOT NULL,
  channel_code      TEXT NOT NULL,
  channel_kind      TEXT NOT NULL CHECK (channel_kind IN ('E_WALLET', 'BANK')),
  account_number    TEXT NOT NULL CHECK (account_number ~ '^[0-9]{10,16}$'),
  account_name      TEXT NOT NULL CHECK (length(trim(account_name)) >= 3),
  status            TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION'
                    CHECK (status IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'REMOVED')),
  status_reason     TEXT,
  decided_by        TEXT,
  decided_by_name   TEXT,
  decided_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- A member lists an account once; an account number is verified for one member.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_accounts_member_number
  ON payout_accounts (member_id, channel_code, account_number) WHERE status IN ('PENDING_VERIFICATION', 'VERIFIED');
CREATE UNIQUE INDEX IF NOT EXISTS uq_payout_accounts_verified_number
  ON payout_accounts (channel_code, account_number) WHERE status = 'VERIFIED';
CREATE INDEX IF NOT EXISTS idx_payout_accounts_branch_status ON payout_accounts (branch_id, status);

-- ------------------------------------------------------------
-- 2. Online deposits
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS online_deposits (
  id                      TEXT PRIMARY KEY,
  reference               TEXT NOT NULL UNIQUE,
  provider                TEXT NOT NULL CHECK (provider IN ('mock', 'xendit')),
  provider_ref            TEXT,
  checkout_url            TEXT,
  member_id               TEXT NOT NULL REFERENCES borrowers (id),
  account_id              TEXT NOT NULL REFERENCES savings_accounts (id),
  branch_id               TEXT NOT NULL,
  amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  paid_amount             NUMERIC(14,2) CHECK (paid_amount IS NULL OR paid_amount >= 0),
  fee                     NUMERIC(14,2) CHECK (fee IS NULL OR fee >= 0),
  status                  TEXT NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'CREDITED', 'EXPIRED', 'FAILED', 'NEEDS_REVIEW', 'DISMISSED')),
  review_reason           TEXT,
  savings_transaction_id  TEXT REFERENCES savings_transactions (id),
  expires_at              TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ,
  credited_at             TIMESTAMPTZ,
  resolved_by             TEXT,
  resolved_by_name        TEXT,
  resolved_at             TIMESTAMPTZ,
  resolution_note         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_deposits_credit CHECK ((status = 'CREDITED') = (savings_transaction_id IS NOT NULL)),
  CONSTRAINT online_deposits_review CHECK (status NOT IN ('NEEDS_REVIEW', 'DISMISSED') OR review_reason IS NOT NULL),
  CONSTRAINT online_deposits_dismissed CHECK (status <> 'DISMISSED' OR resolution_note IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_deposits_provider_ref ON online_deposits (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_deposits_txn ON online_deposits (savings_transaction_id) WHERE savings_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_online_deposits_member ON online_deposits (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_online_deposits_status ON online_deposits (status, branch_id);

-- ------------------------------------------------------------
-- 3. Instant withdrawals (payouts)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS online_payouts (
  id                      TEXT PRIMARY KEY,
  reference               TEXT NOT NULL UNIQUE,
  provider                TEXT NOT NULL CHECK (provider IN ('mock', 'xendit')),
  provider_ref            TEXT,
  member_id               TEXT NOT NULL REFERENCES borrowers (id),
  account_id              TEXT NOT NULL REFERENCES savings_accounts (id),
  branch_id               TEXT NOT NULL,
  payout_account_id       TEXT NOT NULL REFERENCES payout_accounts (id),
  channel_code            TEXT NOT NULL,
  account_number          TEXT NOT NULL,
  account_name            TEXT NOT NULL,
  amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  business_date           TEXT NOT NULL CHECK (business_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  status                  TEXT NOT NULL DEFAULT 'AWAITING_OTP'
                          CHECK (status IN ('AWAITING_OTP', 'CANCELLED', 'SUBMITTING', 'PROCESSING', 'PAID', 'REFUNDED', 'NEEDS_REVIEW')),
  otp_hash                TEXT,
  otp_expires_at          TIMESTAMPTZ,
  otp_attempts            INTEGER NOT NULL DEFAULT 0 CHECK (otp_attempts >= 0),
  debit_transaction_id    TEXT REFERENCES savings_transactions (id),
  refund_transaction_id   TEXT REFERENCES savings_transactions (id),
  failure_reason          TEXT,
  review_reason           TEXT,
  submitted_at            TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ,
  refunded_at             TIMESTAMPTZ,
  resolved_by             TEXT,
  resolved_by_name        TEXT,
  resolved_at             TIMESTAMPTZ,
  resolution_note         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT online_payouts_debit CHECK ((status IN ('AWAITING_OTP', 'CANCELLED')) = (debit_transaction_id IS NULL)),
  CONSTRAINT online_payouts_refund CHECK ((status = 'REFUNDED') = (refund_transaction_id IS NOT NULL)),
  CONSTRAINT online_payouts_review CHECK (status <> 'NEEDS_REVIEW' OR review_reason IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_payouts_provider_ref ON online_payouts (provider, provider_ref) WHERE provider_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_payouts_debit ON online_payouts (debit_transaction_id) WHERE debit_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_payouts_refund ON online_payouts (refund_transaction_id) WHERE refund_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_online_payouts_member_day ON online_payouts (member_id, business_date);
CREATE INDEX IF NOT EXISTS idx_online_payouts_status ON online_payouts (status, branch_id);

-- ------------------------------------------------------------
-- 4. Provider confirmations, as received
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payment_events (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('checkout', 'payout', 'unknown')),
  provider_ref  TEXT,
  reference     TEXT,
  verified      BOOLEAN NOT NULL,
  outcome       TEXT NOT NULL,
  payload       JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_ref ON payment_events (provider, provider_ref);

CREATE OR REPLACE FUNCTION payment_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Provider confirmations are kept as received (% on payment_events).', TG_OP USING ERRCODE = 'restrict_violation';
END
$$;
DROP TRIGGER IF EXISTS trg_payment_events_append_only ON payment_events;
CREATE TRIGGER trg_payment_events_append_only BEFORE UPDATE OR DELETE ON payment_events
  FOR EACH ROW EXECUTE FUNCTION payment_events_append_only();

-- ------------------------------------------------------------
-- 5. Ledger
-- ------------------------------------------------------------

INSERT INTO accounts (account_code, account_name, account_type, normal_balance) VALUES
  ('1030', 'Due from Payment Provider', 'asset', 'debit')
ON CONFLICT (account_code) DO NOTHING;

ALTER TABLE savings_transactions DROP CONSTRAINT IF EXISTS savings_transactions_valid;
ALTER TABLE savings_transactions ADD CONSTRAINT savings_transactions_valid CHECK (
  kind IN ('DEPOSIT', 'WITHDRAWAL', 'INTEREST', 'OPENING_BALANCE', 'TRANSFER_IN', 'TRANSFER_OUT', 'PAYOUT_REFUND')
  AND balance_after = balance_before + signed_amount
  AND amount = abs(signed_amount)
  AND (kind <> 'INTEREST' OR interest_period ~ '^[0-9]{4}-[0-9]{2}$')
  AND (kind <> 'PAYOUT_REFUND' OR signed_amount > 0)
) NOT VALID; -- as in 0027: older rows may not chain; every new row must

-- ------------------------------------------------------------
-- 6. Access: server-side only
-- ------------------------------------------------------------

ALTER TABLE payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE payout_accounts, online_deposits, online_payouts, payment_events FROM %I', r);
    END IF;
  END LOOP;
END
$$;

COMMIT;
