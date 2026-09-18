-- ========================================================
-- HOSCOMCO MICROFINANCE INSTITUTION
-- SUPABASE POSTGRESQL DATABASE SCHEMA & SEED SCRIPT
-- ========================================================
-- This script sets up all tables, indexes, Row Level Security (RLS) policies,
-- and seed data for the HOSCOMCO Client Services and Financial Transaction Management System.
--
-- Instructions:
-- 1. Open your Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Go to SQL Editor -> New Query
-- 3. Paste and run this complete SQL script.
-- ========================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    manager_email TEXT NOT NULL,
    active_disbursed_pool DOUBLE PRECISION DEFAULT 0,
    cash_vault_balance DOUBLE PRECISION DEFAULT 0,
    active_loans_count INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. STAFF TABLE
CREATE TABLE IF NOT EXISTS public.staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    assigned_branch_id TEXT NOT NULL,
    title TEXT NOT NULL,
    avatar TEXT NOT NULL,
    committee TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LOAN PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.loan_products (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    interest_rate DOUBLE PRECISION NOT NULL,
    interest_type TEXT NOT NULL,
    min_amount DOUBLE PRECISION NOT NULL,
    max_amount DOUBLE PRECISION NOT NULL,
    min_term_months INTEGER NOT NULL,
    max_term_months INTEGER NOT NULL,
    repayment_frequency TEXT DEFAULT 'Monthly',
    default_repayment_frequency TEXT DEFAULT 'Monthly',
    processing_fee_percentage DOUBLE PRECISION DEFAULT 2.0,
    late_penalty_rate DOUBLE PRECISION DEFAULT 3.0,
    early_settlement_rebate_rate DOUBLE PRECISION DEFAULT 100.0,
    requires_collateral BOOLEAN DEFAULT FALSE,
    requires_guarantor BOOLEAN DEFAULT FALSE,
    description TEXT,
    badge_color TEXT DEFAULT '#3B82F6',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BORROWERS / MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.borrowers (
    id TEXT PRIMARY KEY,
    borrower_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    id_number TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    gender TEXT NOT NULL,
    civil_status TEXT NOT NULL,
    address TEXT NOT NULL,
    facebook_account TEXT,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    employment_status TEXT NOT NULL,
    employer_or_business TEXT NOT NULL,
    occupation TEXT NOT NULL,
    monthly_income DOUBLE PRECISION NOT NULL,
    monthly_expenses DOUBLE PRECISION NOT NULL,
    credit_score INTEGER NOT NULL,
    credit_tier TEXT NOT NULL,
    kyc_status TEXT NOT NULL,
    member_status TEXT NOT NULL,
    membership_date TEXT NOT NULL,
    savings_balance DOUBLE PRECISION DEFAULT 1000,
    share_capital DOUBLE PRECISION DEFAULT 15000,
    active_loans_count INTEGER DEFAULT 0,
    total_borrowed DOUBLE PRECISION DEFAULT 0,
    total_repaid DOUBLE PRECISION DEFAULT 0,
    avatar TEXT NOT NULL,
    joined_date TEXT NOT NULL,
    last_activity_date TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Duplicate prevention on borrowers: unique phone and email
CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowers_phone ON public.borrowers (phone);
CREATE UNIQUE INDEX IF NOT EXISTS uq_borrowers_email_lower ON public.borrowers (LOWER(email));

-- 5. MEMBERSHIP APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.membership_applications (
    id TEXT PRIMARY KEY,
    application_number TEXT NOT NULL UNIQUE,
    applicant_name TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    civil_status TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    facebook_account TEXT,
    address TEXT NOT NULL,
    occupation TEXT NOT NULL,
    employer_or_business TEXT NOT NULL,
    monthly_income DOUBLE PRECISION NOT NULL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    submitted_date TEXT NOT NULL,
    current_step TEXT NOT NULL,
    valid_id_attached BOOLEAN DEFAULT TRUE,
    proof_of_income_attached BOOLEAN DEFAULT TRUE,
    two_by_two_photo_attached BOOLEAN DEFAULT TRUE,
    membership_fee_paid BOOLEAN DEFAULT FALSE,
    initial_share_capital DOUBLE PRECISION DEFAULT 2000,
    encoded_by TEXT,
    encoded_date TEXT,
    background_investigation JSONB,
    bod_review_date TEXT,
    bod_approved_by JSONB,
    bod_notes TEXT,
    rejection_reason TEXT,
    target_completion_date TEXT NOT NULL,
    created_borrower_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MEMBER UPDATE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.member_update_requests (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_number TEXT NOT NULL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    request_date TEXT NOT NULL,
    channel TEXT NOT NULL,
    field_to_update TEXT NOT NULL,
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    supporting_doc_type TEXT NOT NULL,
    supporting_doc_file_name TEXT,
    supporting_doc_verified BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'Pending',
    reviewed_by TEXT,
    review_date TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. MEMBER FOLLOW-UP LOGS TABLE
CREATE TABLE IF NOT EXISTS public.member_follow_up_logs (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    member_number TEXT NOT NULL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    date TEXT NOT NULL,
    contact_channel TEXT NOT NULL,
    conducted_by TEXT NOT NULL,
    has_outstanding_loan BOOLEAN DEFAULT FALSE,
    outstanding_loan_amount DOUBLE PRECISION DEFAULT 0,
    purpose TEXT NOT NULL,
    member_response TEXT NOT NULL,
    next_follow_up_date TEXT,
    action_taken TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. SAVINGS ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.savings_accounts (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    passbook_number TEXT NOT NULL UNIQUE,
    balance DOUBLE PRECISION DEFAULT 1000,
    maintaining_balance DOUBLE PRECISION DEFAULT 1000,
    interest_rate DOUBLE PRECISION DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. SAVINGS TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.savings_transactions (
    id TEXT PRIMARY KEY,
    savings_account_id TEXT NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    transaction_number TEXT NOT NULL UNIQUE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    balance_before DOUBLE PRECISION NOT NULL,
    balance_after DOUBLE PRECISION NOT NULL,
    processed_by TEXT NOT NULL,
    notes TEXT,
    official_receipt_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. SAVINGS WITHDRAWAL REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.savings_withdrawal_requests (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    current_balance DOUBLE PRECISION NOT NULL,
    requested_amount DOUBLE PRECISION NOT NULL,
    maintaining_balance DOUBLE PRECISION DEFAULT 1000,
    remaining_balance_after DOUBLE PRECISION NOT NULL,
    request_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    teller_name TEXT NOT NULL,
    teller_recorded_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending Approval',
    approved_by_manager TEXT,
    approval_date TEXT,
    disbursed_date TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. INTEREST CREDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.interest_credit_logs (
    id TEXT PRIMARY KEY,
    period_month TEXT NOT NULL,
    calculation_date TEXT NOT NULL,
    annual_rate DOUBLE PRECISION DEFAULT 1.0,
    total_members_credited INTEGER NOT NULL,
    total_interest_distributed DOUBLE PRECISION NOT NULL,
    executed_by TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. LOANS TABLE
CREATE TABLE IF NOT EXISTS public.loans (
    id TEXT PRIMARY KEY,
    loan_number TEXT NOT NULL UNIQUE,
    borrower_id TEXT NOT NULL REFERENCES public.borrowers(id) ON DELETE RESTRICT,
    borrower_name TEXT NOT NULL,
    borrower_phone TEXT NOT NULL,
    borrower_avatar TEXT,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    product_id TEXT NOT NULL REFERENCES public.loan_products(id) ON DELETE RESTRICT,
    product_name TEXT NOT NULL,
    principal_amount DOUBLE PRECISION NOT NULL,
    interest_rate DOUBLE PRECISION NOT NULL,
    interest_type TEXT NOT NULL,
    repayment_frequency TEXT NOT NULL,
    term_months INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    processing_fee DOUBLE PRECISION NOT NULL,
    total_interest DOUBLE PRECISION NOT NULL,
    total_payable DOUBLE PRECISION NOT NULL,
    total_paid DOUBLE PRECISION DEFAULT 0,
    remaining_balance DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL,
    coop_step TEXT NOT NULL,
    application_date TEXT NOT NULL,
    start_date TEXT,
    approval_date TEXT,
    disbursed_date TEXT,
    next_payment_date TEXT,
    maturity_date TEXT NOT NULL,
    loan_officer_id TEXT NOT NULL,
    loan_officer_name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    collateral JSONB,
    guarantors JSONB,
    schedule JSONB,
    underwriting_report JSONB,
    credit_committee_eval JSONB,
    disbursement_voucher JSONB,
    last_payment_date TEXT,
    days_in_arrears INTEGER DEFAULT 0,
    is_irregular_account BOOLEAN DEFAULT FALSE,
    total_late_penalties_charged DOUBLE PRECISION DEFAULT 0,
    total_rebates_awarded DOUBLE PRECISION DEFAULT 0,
    disbursement_method TEXT,
    disbursement_account TEXT,
    officer_in_charge TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. PAYMENTS & OFFICIAL RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    receipt_number TEXT NOT NULL UNIQUE,
    loan_id TEXT NOT NULL REFERENCES public.loans(id) ON DELETE RESTRICT,
    loan_number TEXT NOT NULL,
    borrower_id TEXT NOT NULL REFERENCES public.borrowers(id) ON DELETE RESTRICT,
    borrower_name TEXT NOT NULL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    amount DOUBLE PRECISION NOT NULL,
    payment_date TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_reference TEXT NOT NULL,
    collected_by TEXT NOT NULL,
    principal_portion DOUBLE PRECISION NOT NULL,
    interest_portion DOUBLE PRECISION NOT NULL,
    penalty_portion DOUBLE PRECISION DEFAULT 0,
    rebate_discount DOUBLE PRECISION DEFAULT 0,
    payment_schedule_type TEXT NOT NULL,
    is_advance_payment BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. SOLIDARITY GROUPS (GRAMEEN MODEL) TABLE
CREATE TABLE IF NOT EXISTS public.solidarity_groups (
    id TEXT PRIMARY KEY,
    group_code TEXT NOT NULL UNIQUE,
    group_name TEXT NOT NULL,
    center_name TEXT NOT NULL,
    branch_id TEXT NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
    formed_date TEXT NOT NULL,
    meeting_day TEXT NOT NULL,
    meeting_time TEXT NOT NULL,
    meeting_location TEXT NOT NULL,
    loan_officer_id TEXT NOT NULL,
    loan_officer_name TEXT NOT NULL,
    leader_borrower_id TEXT NOT NULL,
    leader_name TEXT NOT NULL,
    leader_phone TEXT NOT NULL,
    members JSONB NOT NULL,
    total_active_loans DOUBLE PRECISION DEFAULT 0,
    total_group_savings DOUBLE PRECISION DEFAULT 0,
    repayment_rate DOUBLE PRECISION DEFAULT 100,
    solidarity_fund_balance DOUBLE PRECISION DEFAULT 0,
    joint_liability_agreed BOOLEAN DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    performed_by TEXT NOT NULL,
    branchId TEXT NOT NULL,
    type TEXT NOT NULL,
    user_name TEXT,
    user_role TEXT,
    target_type TEXT,
    target_id TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. USERS TABLE (AUTHENTICATION - STAFF & CLIENT PORTAL ACCOUNTS)
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('STAFF', 'CLIENT')),
    staff_role TEXT,
    staff_id TEXT REFERENCES public.staff(id) ON DELETE SET NULL,
    borrower_id TEXT REFERENCES public.borrowers(id) ON DELETE SET NULL,
    phone TEXT,
    avatar TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_borrower ON public.users(borrower_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_branch ON public.borrowers(branch_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_kyc ON public.borrowers(kyc_status);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON public.loans(borrower_id);
CREATE INDEX IF NOT EXISTS idx_loans_branch ON public.loans(branch_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_payments_loan ON public.payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_borrower ON public.payments(borrower_id);
CREATE INDEX IF NOT EXISTS idx_savings_member ON public.savings_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_solidarity_branch ON public.solidarity_groups(branch_id);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_update_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_follow_up_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interest_credit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solidarity_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow full access for anon and authenticated API clients (Cooperative Intranet & Portal)
CREATE POLICY "Allow full access to branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to staff" ON public.staff FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to loan_products" ON public.loan_products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to borrowers" ON public.borrowers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to membership_applications" ON public.membership_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to member_update_requests" ON public.member_update_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to member_follow_up_logs" ON public.member_follow_up_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to savings_accounts" ON public.savings_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to savings_transactions" ON public.savings_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to savings_withdrawal_requests" ON public.savings_withdrawal_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to interest_credit_logs" ON public.interest_credit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to loans" ON public.loans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to payments" ON public.payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to solidarity_groups" ON public.solidarity_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ========================================================
-- SEED DATA FOR HOSCOMCO MICROFINANCE COOPERATIVE
-- ========================================================

-- 1. Insert Branches
INSERT INTO public.branches (id, code, name, city, address, phone, manager_name, manager_email, active_disbursed_pool, cash_vault_balance, active_loans_count, color)
VALUES
('b-1', 'HO-MAIN', 'HOSCOMCO Main Office', 'Tacloban City', 'Coop Bldg, Real St., Tacloban City', '+63 917 111 2222', 'Elena Rostata', 'elena.rostata@HOSCOMCO.coop', 2450000, 850000, 38, '#2563EB'),
('b-2', 'HO-PALO', 'Palo Community Center Branch', 'Palo, Leyte', 'Poblacion Commercial Complex, Palo', '+63 917 333 4444', 'Roberto Gualvez', 'roberto.g@HOSCOMCO.coop', 1680000, 420000, 24, '#059669'),
('b-3', 'HO-ORMOC', 'Ormoc Agri-Microfinance Unit', 'Ormoc City', 'Agri-Trade Center, Ormoc City', '+63 917 555 6666', 'Maria Carmela Tan', 'carmela.tan@HOSCOMCO.coop', 1920000, 610000, 29, '#D97706')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Staff
INSERT INTO public.staff (id, name, email, role, assigned_branch_id, title, avatar, committee)
VALUES
('s-1', 'Elena Rostata', 'elena.rostata@HOSCOMCO.coop', 'SUPER_ADMIN', 'all', 'General Manager & CEO', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', 'Management'),
('s-2', 'Roberto Gualvez', 'roberto.g@HOSCOMCO.coop', 'MANAGER', 'b-2', 'Branch Manager - Palo', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150', 'Credit Committee'),
('s-3', 'Maria Carmela Tan', 'carmela.tan@HOSCOMCO.coop', 'MANAGER', 'b-3', 'Branch Manager - Ormoc', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150', 'Credit Committee'),
('s-4', 'Grace Mendoza', 'grace.m@HOSCOMCO.coop', 'LOAN_PROCESSOR', 'b-1', 'Senior Microfinance Loan Officer', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', 'Operations'),
('s-5', 'Danilo Santos', 'danilo.s@HOSCOMCO.coop', 'TELLER', 'b-1', 'Head Teller & Cashier', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', 'Operations')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Loan Products
INSERT INTO public.loan_products (id, code, name, category, interest_rate, interest_type, min_amount, max_amount, min_term_months, max_term_months, repayment_frequency, default_repayment_frequency, processing_fee_percentage, late_penalty_rate, early_settlement_rebate_rate, requires_collateral, requires_guarantor, description, badge_color)
VALUES
('p-1', 'ML-MICRO', 'Kabuhayan Micro-Enterprise Loan', 'Livelihood & MSME', 12.0, 'Flat Rate', 5000, 100000, 3, 24, 'Weekly', 'Weekly', 2.0, 3.0, 100.0, false, true, 'Working capital for sari-sari stores, market vendors, and micro-entrepreneurs with solidarity group support.', '#2563EB'),
('p-2', 'AG-CROP', 'Bukid Agri-Crop Seasonal Loan', 'Agriculture & Fisheries', 10.0, 'Reducing Balance', 15000, 250000, 4, 12, 'Monthly', 'Monthly', 1.5, 2.5, 100.0, false, true, 'Financing for rice, corn, and vegetable seeds, fertilizers, and farm labor tied to harvest season.', '#059669'),
('p-3', 'EM-FAST', 'Emergency & Calamity Assistance Loan', 'Emergency Aid', 6.0, 'Flat Rate', 3000, 30000, 2, 6, 'Monthly', 'Monthly', 1.0, 2.0, 100.0, false, false, 'Rapid 24-hour emergency assistance for medical emergencies, school tuition, or typhoon repairs.', '#DC2626'),
('p-4', 'ED-STUDY', 'Edukasyon Youth Tuition Loan', 'Education', 8.0, 'Reducing Balance', 5000, 50000, 3, 10, 'Monthly', 'Monthly', 1.0, 2.0, 100.0, false, true, 'Semester tuition assistance for children of active cooperative members in good standing.', '#7C3AED')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Initial Borrowers / Members
INSERT INTO public.borrowers (id, borrower_number, full_name, id_number, phone, email, date_of_birth, gender, civil_status, address, facebook_account, branch_id, employment_status, employer_or_business, occupation, monthly_income, monthly_expenses, credit_score, credit_tier, kyc_status, member_status, membership_date, savings_balance, share_capital, active_loans_count, total_borrowed, total_repaid, avatar, joined_date, last_activity_date, notes)
VALUES
('b-1', 'MBR-2024-001', 'Teresa Alcantara', 'UMID-9821-4821', '+63 917 123 4567', 'teresa.alcantara@gmail.com', '1984-06-15', 'Female', 'Married', 'Brgy. 88 San Jose, Tacloban City', 'facebook.com/teresa.sarisari', 'b-1', 'Business Owner', 'Teresa Sari-Sari Store & Dry Goods', 'Store Proprietor', 42000, 24000, 780, 'Excellent', 'Verified', 'Active', '2021-03-15', 18500, 25000, 1, 80000, 48000, 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', '2021-03-15', '2026-08-15', 'Solidarity Group Leader for Tacloban Center 1. Consistently on time.'),
('b-2', 'MBR-2024-002', 'Rolando Dela Cruz', 'SSS-34-892184-1', '+63 918 234 5678', 'rolando.dcruz@gmail.com', '1979-11-20', 'Male', 'Married', 'Brgy. Cavite, Palo, Leyte', '', 'b-2', 'Farmer', 'Dela Cruz Organic Rice Farm', 'Smallholder Farmer', 35000, 18000, 720, 'Good', 'Verified', 'Active', '2022-01-10', 12400, 18000, 1, 50000, 25000, 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150', '2022-01-10', '2026-08-10', 'Harvest loan seasonal borrower with 100% historical repayment record.'),
('b-3', 'MBR-2024-003', 'Marivic Santos', 'PRC-0081294', '+63 919 345 6789', 'marivic.santos@gmail.com', '1988-03-08', 'Female', 'Single', 'Brgy. Cogon, Ormoc City', 'facebook.com/marivic.bakes', 'b-3', 'Self-Employed', 'Sweet Delights Pastry Shop', 'Baker & Owner', 58000, 29000, 810, 'Excellent', 'Verified', 'Active', '2020-07-22', 32000, 40000, 1, 120000, 95000, 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=150', '2020-07-22', '2026-08-18', 'High capital cooperative shareholder.')
ON CONFLICT (id) DO NOTHING;

-- 5. Insert Initial Savings Accounts
INSERT INTO public.savings_accounts (id, member_id, member_name, passbook_number, balance, maintaining_balance, interest_rate)
VALUES
('sav-b-1', 'b-1', 'Teresa Alcantara', 'PB-2024-001', 18500, 1000, 1.0),
('sav-b-2', 'b-2', 'Rolando Dela Cruz', 'PB-2024-002', 12400, 1000, 1.0),
('sav-b-3', 'b-3', 'Marivic Santos', 'PB-2024-003', 32000, 1000, 1.0)
ON CONFLICT (id) DO NOTHING;

-- 6. Insert Solidarity Groups
INSERT INTO public.solidarity_groups (id, group_code, group_name, center_name, branch_id, formed_date, meeting_day, meeting_time, meeting_location, loan_officer_id, loan_officer_name, leader_borrower_id, leader_name, leader_phone, members, total_active_loans, total_group_savings, repayment_rate, solidarity_fund_balance, joint_liability_agreed, status)
VALUES
(
    'grp-1',
    'SG-TAC-01',
    'Kauswagan Solidarity Circle 1',
    'Tacloban Downtown Center 01',
    'b-1',
    '2023-04-12',
    'Wednesday',
    '08:30 AM',
    'Brgy 88 Community Multi-Purpose Hall, Tacloban',
    's-4',
    'Grace Mendoza',
    'b-1',
    'Teresa Alcantara',
    '+63 917 123 4567',
    '[
        {"borrowerId": "b-1", "fullName": "Teresa Alcantara", "phone": "+63 917 123 4567", "role": "Leader", "activeLoanAmount": 50000, "remainingBalance": 32000, "savingsBalance": 18500, "status": "Good Standing", "weeklyDues": 1250, "isAttendingMeeting": true, "meetingPaymentPaid": true},
        {"borrowerId": "b-2", "fullName": "Rolando Dela Cruz", "phone": "+63 918 234 5678", "role": "Treasurer", "activeLoanAmount": 40000, "remainingBalance": 25000, "savingsBalance": 12400, "status": "Good Standing", "weeklyDues": 1000, "isAttendingMeeting": true, "meetingPaymentPaid": true}
    ]'::jsonb,
    90000,
    30900,
    99.2,
    14500,
    true,
    'Active'
)
ON CONFLICT (id) DO NOTHING;

-- ========================================================
-- DATABASE SCHEMA SETUP COMPLETED SUCCESSFULLY!
-- ========================================================
