-- ============================================================
-- 0006 — CENTRAL FINANCIAL TRANSACTIONS + FINMGMT INTEGRATION
--        (accounts / journal_entries / journal_entry_lines /
--         cash_transactions)
-- Requires: 0002..0005
-- ============================================================

-- ------------------------------------------------------------
-- ACCOUNTS (chart-of-accounts stub owned by Financial Mgmt module;
-- created here so client-services events can reference them)
-- ------------------------------------------------------------
CREATE TABLE accounts (
  account_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code   TEXT NOT NULL UNIQUE,
  account_name   TEXT NOT NULL,
  account_type   account_type NOT NULL,
  normal_balance normal_balance NOT NULL,
  status         product_status NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- JOURNAL ENTRIES + LINES (double-entry integration point)
-- ------------------------------------------------------------
CREATE TABLE journal_entries (
  journal_entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  description      TEXT NOT NULL,
  reference_number TEXT,
  source_module    TEXT NOT NULL DEFAULT 'client_services',
  source_id        UUID,                       -- e.g. savings_transaction_id / payment_id / loan_id
  created_by       UUID REFERENCES profiles (id) ON DELETE SET NULL,
  status           journal_status NOT NULL DEFAULT 'posted',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_entry_lines (
  line_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES journal_entries (journal_entry_id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL CHECK (line_number > 0),
  account_id  UUID NOT NULL REFERENCES accounts (account_id) ON DELETE RESTRICT,
  debit       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0 AND (debit = 0 OR credit = 0)),
  credit      NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (credit >= 0 AND (debit = 0 OR credit = 0)),

  -- A line must move something
  CONSTRAINT line_moves_value CHECK (debit > 0 OR credit > 0),
  UNIQUE (entry_id, line_number)
);

-- Entry-level double-entry balance check
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

CREATE CONSTRAINT TRIGGER trg_entry_balanced
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_entry_balanced();

CREATE INDEX idx_je_source ON journal_entries (source_module, source_id);

-- ------------------------------------------------------------
-- CASH TRANSACTIONS
-- ------------------------------------------------------------
CREATE TABLE cash_transactions (
  cash_transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id    UUID NOT NULL REFERENCES journal_entries (journal_entry_id) ON DELETE RESTRICT,
  transaction_code    TEXT NOT NULL UNIQUE
                      DEFAULT 'CSH-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
                             LPAD(NEXTVAL('seq_cash_txn')::TEXT, 6, '0'),
  transaction_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description         TEXT NOT NULL,
  transaction_type    fin_txn_type NOT NULL,
  amount              NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  source_module       TEXT NOT NULL DEFAULT 'client_services',
  source_id           UUID,
  created_by          UUID REFERENCES profiles (id) ON DELETE SET NULL,
  status              txn_status NOT NULL DEFAULT 'completed',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- FINANCIAL TRANSACTIONS (module-level ledger — the single
-- integration surface other modules consume)
-- Inserts happen ONLY via backend service role (no RLS insert
-- policy is granted to authenticated roles in 0009).
-- ------------------------------------------------------------
CREATE TABLE financial_transactions (
  transaction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT NOT NULL UNIQUE
                   DEFAULT 'TXN-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
                          LPAD(NEXTVAL('seq_fin_txn')::TEXT, 8, '0'),
  client_id        UUID REFERENCES clients (client_id) ON DELETE SET NULL,

  transaction_type fin_txn_type NOT NULL,
  direction        entry_direction NOT NULL,
  amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),

  description      TEXT NOT NULL,
  reference_number TEXT,

  source_module    TEXT NOT NULL DEFAULT 'client_services',
  source_table     TEXT NOT NULL,
  source_id        UUID NOT NULL,

  account_id       UUID REFERENCES accounts (account_id) ON DELETE SET NULL,
  journal_entry_id UUID REFERENCES journal_entries (journal_entry_id) ON DELETE SET NULL,

  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       UUID REFERENCES profiles (id) ON DELETE SET NULL,
  status           txn_status NOT NULL DEFAULT 'completed',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE savings_transactions
  ADD CONSTRAINT fk_stx_financial
  FOREIGN KEY (financial_transaction_id)
  REFERENCES financial_transactions (transaction_id) ON DELETE SET NULL;

ALTER TABLE loan_payments
  ADD CONSTRAINT fk_pay_financial
  FOREIGN KEY (financial_transaction_id)
  REFERENCES financial_transactions (transaction_id) ON DELETE SET NULL;

CREATE INDEX idx_ft_client   ON financial_transactions (client_id);
CREATE INDEX idx_ft_type     ON financial_transactions (transaction_type);
CREATE INDEX idx_ft_source   ON financial_transactions (source_table, source_id);
CREATE INDEX idx_ft_date     ON financial_transactions (transaction_date DESC);
