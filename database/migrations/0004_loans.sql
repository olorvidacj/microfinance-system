-- ============================================================
-- 0004 — LOANS: PRODUCTS, APPLICATIONS, CONTRACTS,
--        INSTALLMENT SCHEDULE, PAYMENTS
-- Requires: 0002
-- ============================================================

-- ------------------------------------------------------------
-- LOAN PRODUCTS (configurable — no hard-coded rates)
-- ------------------------------------------------------------
CREATE TABLE loan_products (
  loan_product_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code         TEXT NOT NULL UNIQUE,
  product_name         TEXT NOT NULL,
  loan_type            loan_type NOT NULL DEFAULT 'personal',
  description          TEXT,

  interest_rate        NUMERIC(5,3) NOT NULL CHECK (interest_rate >= 0 AND interest_rate <= 100), -- % per annum
  interest_method      interest_method NOT NULL DEFAULT 'flat_rate',
  minimum_amount       NUMERIC(14,2) NOT NULL CHECK (minimum_amount > 0),
  maximum_amount       NUMERIC(14,2) NOT NULL CHECK (maximum_amount >= minimum_amount),
  min_term_months      INTEGER NOT NULL CHECK (min_term_months > 0),
  max_term_months      INTEGER NOT NULL CHECK (max_term_months >= min_term_months),
  payment_frequency    payment_frequency NOT NULL DEFAULT 'monthly',

  processing_fee_percent NUMERIC(5,3) NOT NULL DEFAULT 0
                         CHECK (processing_fee_percent BETWEEN 0 AND 100),
  late_penalty_rate    NUMERIC(5,3) NOT NULL DEFAULT 0
                         CHECK (late_penalty_rate BETWEEN 0 AND 100),   -- % per month on overdue amount

  requires_collateral  BOOLEAN NOT NULL DEFAULT false,
  requires_guarantor   BOOLEAN NOT NULL DEFAULT false,
  status               product_status NOT NULL DEFAULT 'active',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- LOAN APPLICATIONS
-- ------------------------------------------------------------
CREATE TABLE loan_applications (
  loan_application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number  TEXT NOT NULL UNIQUE
                      DEFAULT 'LAP-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                             LPAD(NEXTVAL('seq_application_number')::TEXT, 5, '0'),
  client_id           UUID NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  loan_product_id     UUID NOT NULL REFERENCES loan_products (loan_product_id) ON DELETE RESTRICT,

  requested_amount    NUMERIC(14,2) NOT NULL CHECK (requested_amount > 0),
  term_months         INTEGER NOT NULL CHECK (term_months > 0),
  payment_frequency   payment_frequency NOT NULL,
  purpose             TEXT NOT NULL,

  status              application_status NOT NULL DEFAULT 'submitted',
  approved_amount     NUMERIC(14,2) CHECK (approved_amount IS NULL OR approved_amount > 0),
  reviewed_by         UUID REFERENCES profiles (id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  review_remarks      TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT app_terminal_state_valid CHECK (
    status <> 'approved' OR (approved_amount IS NOT NULL AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT app_reject_requires_remarks CHECK (
    status <> 'rejected' OR review_remarks IS NOT NULL
  )
);

CREATE INDEX idx_app_client  ON loan_applications (client_id);
CREATE INDEX idx_app_status  ON loan_applications (status);
CREATE INDEX idx_app_product ON loan_applications (loan_product_id);

-- ------------------------------------------------------------
-- LOANS (contracts created from APPROVED applications)
-- ------------------------------------------------------------
CREATE TABLE loans (
  loan_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number          TEXT NOT NULL UNIQUE
                       DEFAULT 'LN-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                              LPAD(NEXTVAL('seq_loan_number')::TEXT, 5, '0'),
  loan_application_id  UUID UNIQUE REFERENCES loan_applications (loan_application_id) ON DELETE RESTRICT,
  client_id            UUID NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  loan_product_id      UUID NOT NULL REFERENCES loan_products (loan_product_id) ON DELETE RESTRICT,
  group_id             UUID,                    -- FK added in 0005 (group loans)

  principal_amount     NUMERIC(14,2) NOT NULL CHECK (principal_amount > 0),
  interest_rate        NUMERIC(5,3)  NOT NULL CHECK (interest_rate >= 0),
  interest_method      interest_method NOT NULL,
  term_months          INTEGER NOT NULL CHECK (term_months > 0),
  payment_frequency    payment_frequency NOT NULL,
  number_of_installments INTEGER NOT NULL CHECK (number_of_installments > 0),

  total_interest       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_interest >= 0),
  total_payable        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total_payable >= 0),
  outstanding_balance  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (outstanding_balance >= 0),

  maturity_date        DATE,
  next_due_date        DATE,                    -- denormalized accelerator, maintained by backend txns
  days_in_arrears      INTEGER NOT NULL DEFAULT 0 CHECK (days_in_arrears >= 0),

  status               loan_status NOT NULL DEFAULT 'draft',
  disbursed_at         TIMESTAMPTZ,
  disbursed_by         UUID REFERENCES profiles (id) ON DELETE SET NULL,
  disbursement_reference TEXT,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT loan_disbursed_fields CHECK (
    status NOT IN ('disbursed', 'active', 'fully_paid', 'defaulted')
    OR (disbursed_at IS NOT NULL AND disbursed_by IS NOT NULL)
  )
);

CREATE INDEX idx_loans_client     ON loans (client_id);
CREATE INDEX idx_loans_status     ON loans (status);
CREATE INDEX idx_loans_product    ON loans (loan_product_id);
CREATE INDEX idx_loans_group      ON loans (group_id);
CREATE INDEX idx_loans_next_due   ON loans (next_due_date) WHERE status IN ('active', 'disbursed');

-- ------------------------------------------------------------
-- LOAN INSTALLMENTS (amortization schedule)
-- ------------------------------------------------------------
CREATE TABLE loan_installments (
  installment_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id           UUID NOT NULL REFERENCES loans (loan_id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  due_date          DATE NOT NULL,

  principal_amount  NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (principal_amount >= 0),
  interest_amount   NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (interest_amount >= 0),
  penalty_amount    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (penalty_amount >= 0),

  total_due         NUMERIC(14,2) GENERATED ALWAYS AS
                    (principal_amount + interest_amount + penalty_amount) STORED,
  amount_paid       NUMERIC(14,2) NOT NULL DEFAULT 0
                    CHECK (amount_paid >= 0 AND amount_paid <= principal_amount + interest_amount + penalty_amount),
  status            installment_status NOT NULL DEFAULT 'pending',
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT paid_needs_timestamp CHECK (status NOT IN ('paid') OR paid_at IS NOT NULL),
  CONSTRAINT paid_consistency CHECK (
    (status = 'paid') = (amount_paid = principal_amount + interest_amount + penalty_amount)
    OR (status IN ('pending', 'partially_paid', 'overdue')
        AND amount_paid < principal_amount + interest_amount + penalty_amount)
  ),
  UNIQUE (loan_id, installment_number)
);

CREATE INDEX idx_inst_loan  ON loan_installments (loan_id, installment_number);
CREATE INDEX idx_inst_due   ON loan_installments (due_date) WHERE status IN ('pending', 'partially_paid');
CREATE INDEX idx_inst_status ON loan_installments (status);

-- ------------------------------------------------------------
-- LOAN PAYMENTS
-- ------------------------------------------------------------
CREATE TABLE loan_payments (
  payment_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL UNIQUE
                 DEFAULT 'PAY-' || TO_CHAR(NOW(), 'YYYYMM') || '-' ||
                        LPAD(NEXTVAL('seq_payment_number')::TEXT, 6, '0'),
  loan_id        UUID NOT NULL REFERENCES loans (loan_id) ON DELETE RESTRICT,
  installment_id UUID REFERENCES loan_installments (installment_id) ON DELETE SET NULL, -- NULL = spans installments
  client_id      UUID NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,

  amount         NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method payment_method NOT NULL,
  reference_number TEXT,
  notes          TEXT,
  received_by    UUID NOT NULL REFERENCES profiles (id) ON DELETE RESTRICT,
  financial_transaction_id UUID,                -- FK added in 0006
  status         txn_status NOT NULL DEFAULT 'completed',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_loan  ON loan_payments (loan_id, payment_date DESC);
CREATE INDEX idx_pay_client ON loan_payments (client_id);
