-- ============================================================
-- 0010 — CONFIGURATION SEED (settings only, NO fabricated
--        client/financial data — spec §27 rule 1)
-- Requires: 0006 (accounts FKs)
-- ============================================================

-- ------------------------------------------------------------
-- Chart of accounts stubs the module posts against.
-- (Owned by Financial Mgmt module; extend there.)
-- ------------------------------------------------------------
INSERT INTO accounts (account_code, account_name, account_type, normal_balance) VALUES
  ('1010', 'Cash on Hand',                'asset',   'debit'),
  ('1020', 'Cash in Bank',                'asset',   'debit'),
  ('1110', 'Loans Receivable',            'asset',   'debit'),
  ('1115', 'Interest Receivable',         'asset',   'debit'),
  ('1120', 'Allowance for Impairment',    'asset',   'credit'),
  ('2010', 'Savings Deposits Payable',    'liability','credit'),
  ('2020', 'Special Deposits Payable',    'liability','credit'),
  ('3010', 'Members Share Capital',       'equity',  'credit'),
  ('4010', 'Interest Income on Loans',    'income',  'credit'),
  ('4020', 'Penalty Income',              'income',  'credit'),
  ('4030', 'Service Fees Income',         'income',  'credit'),
  ('4040', 'Savings Interest Expense',    'expense', 'debit')
ON CONFLICT (account_code) DO NOTHING;

-- ------------------------------------------------------------
-- Default SAVINGS products (institution edits via UI later)
-- ------------------------------------------------------------
INSERT INTO savings_products
  (product_code, product_name, product_type, description,
   minimum_deposit, maintaining_balance, interest_rate, interest_posting_frequency,
   term_days, withdrawal_lockup_days, start_date, end_date)
VALUES
  ('SAV-REG-01', 'Regular Savings', 'regular',
   'Standard passbook savings with quarterly interest posting.',
   100.00, 500.00, 1.000, 'quarterly', NULL, NULL, NULL, NULL),
  ('SAV-SPEC-01', 'Special Time Deposit 6M', 'special_deposit',
   'Six-month special deposit program with preferential rate.',
   5000.00, 5000.00, 4.000, 'monthly',
   180, 180, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year')
ON CONFLICT (product_code) DO NOTHING;

-- ------------------------------------------------------------
-- Default LOAN products
-- ------------------------------------------------------------
INSERT INTO loan_products
  (product_code, product_name, loan_type, description,
   interest_rate, interest_method, minimum_amount, maximum_amount,
   min_term_months, max_term_months, payment_frequency,
   processing_fee_percent, late_penalty_rate, requires_collateral, requires_guarantor)
VALUES
  ('LNP-BIZ-01', 'Business Loan', 'business',
   'Working capital and expansion financing for micro-enterprises.',
   14.000, 'flat_rate', 10000.00, 300000.00, 3, 36, 'monthly',
   2.000, 2.000, false, true),
  ('LNP-PER-01', 'Personal Loan', 'personal',
   'Multi-purpose credit for members in good standing.',
   18.000, 'reducing_balance', 5000.00, 150000.00, 3, 24, 'monthly',
   1.500, 3.000, false, true)
ON CONFLICT (product_code) DO NOTHING;
