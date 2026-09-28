-- ============================================================
-- 0003 — SAVINGS: PRODUCTS, ACCOUNTS, PASSBOOK TRANSACTIONS
-- Requires: 0002
-- ============================================================

-- ------------------------------------------------------------
-- SAVINGS PRODUCTS (Regular Savings template + Special Deposit Programs)
-- Financial settings live HERE — never hard-coded in application code.
-- ------------------------------------------------------------
CREATE TABLE savings_products (
  savings_product_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code         TEXT NOT NULL UNIQUE,
  product_name         TEXT NOT NULL,
  product_type         savings_product_type NOT NULL DEFAULT 'regular',
  description          TEXT,

  minimum_deposit      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (minimum_deposit >= 0),
  maintaining_balance  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (maintaining_balance >= 0),
  interest_rate        NUMERIC(5,3) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 100), -- % per annum
  interest_posting_frequency posting_frequency NOT NULL DEFAULT 'none',
  term_days            INTEGER CHECK (term_days IS NULL OR term_days > 0),
  withdrawal_lockup_days INTEGER CHECK (withdrawal_lockup_days IS NULL OR withdrawal_lockup_days >= 0),

  start_date           DATE,
  end_date             DATE,
  status               product_status NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT special_deposit_needs_term CHECK (
    product_type <> 'special_deposit' OR (term_days IS NOT NULL AND end_date IS NOT NULL)
  ),
  CONSTRAINT product_window_valid CHECK (
    start_date IS NULL OR end_date IS NULL OR start_date < end_date
  )
);

-- ------------------------------------------------------------
-- SAVINGS ACCOUNTS
-- ------------------------------------------------------------
CREATE TABLE savings_accounts (
  savings_account_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  savings_product_id  UUID NOT NULL REFERENCES savings_products (savings_product_id) ON DELETE RESTRICT,
  account_number      TEXT NOT NULL UNIQUE
                      DEFAULT 'SA-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                             LPAD(NEXTVAL('seq_account_number')::TEXT, 6, '0'),
  opening_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  balance             NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  status              account_status NOT NULL DEFAULT 'active',
  closed_at           TIMESTAMPTZ,
  closure_reason      TEXT,
  opened_by           UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT closed_account_has_context CHECK (
    status <> 'closed' OR (closed_at IS NOT NULL AND closure_reason IS NOT NULL)
  )
);

CREATE INDEX idx_savings_accounts_client  ON savings_accounts (client_id);
CREATE INDEX idx_savings_accounts_product ON savings_accounts (savings_product_id);
CREATE INDEX idx_savings_accounts_status  ON savings_accounts (status);

-- ------------------------------------------------------------
-- SAVINGS TRANSACTIONS (passbook ledger — append-only by design)
-- Balances are mutated ONLY inside backend DB transactions that
-- insert here and update savings_accounts.balance in one atomic step.
-- ------------------------------------------------------------
CREATE TABLE savings_transactions (
  savings_transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  savings_account_id     UUID NOT NULL REFERENCES savings_accounts (savings_account_id) ON DELETE RESTRICT,
  transaction_type       savings_txn_type NOT NULL,
  amount                 NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  balance_before         NUMERIC(14,2) NOT NULL CHECK (balance_before >= 0),
  balance_after          NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
  reference_number       TEXT NOT NULL UNIQUE
                         DEFAULT 'STX-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
                                LPAD(NEXTVAL('seq_savings_ref')::TEXT, 6, '0'),
  description            TEXT,
  transaction_date       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  performed_by           UUID REFERENCES profiles (id) ON DELETE SET NULL,  -- staff teller/officer
  financial_transaction_id UUID,                                             -- FK added in 0006
  status                 txn_status NOT NULL DEFAULT 'completed',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT stx_balance_chain CHECK (
    (transaction_type IN ('deposit', 'interest_credit', 'adjustment')
       AND balance_after = balance_before + amount)
    OR
    (transaction_type IN ('withdrawal', 'fee')
       AND balance_after = balance_before - amount)
  )
);

CREATE INDEX idx_stx_account ON savings_transactions (savings_account_id, transaction_date DESC);
CREATE INDEX idx_stx_type    ON savings_transactions (transaction_type);
