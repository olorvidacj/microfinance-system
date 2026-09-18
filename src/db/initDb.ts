import { getPool, markConnectionStringFailed } from './index';

export async function initDbSchema(): Promise<boolean> {
  const pool = getPool();
  if (!pool) {
    return false;
  }

  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
    markConnectionStringFailed();
    console.warn('[Database] Could not connect to database pool:', err.message);
    return false;
  }

  try {
    // Create tables in correct dependency order
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL,
        staff_role TEXT,
        staff_id TEXT,
        borrower_id TEXT,
        phone TEXT,
        avatar TEXT,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS id_sequences (
        name TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        last_value INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS branches (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
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
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS staff (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        role TEXT NOT NULL,
        assigned_branch_id TEXT NOT NULL,
        title TEXT NOT NULL,
        avatar TEXT NOT NULL,
        committee TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS loan_products (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
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
        processing_fee_percentage DOUBLE PRECISION DEFAULT 2,
        late_penalty_rate DOUBLE PRECISION DEFAULT 3,
        early_settlement_rebate_rate DOUBLE PRECISION DEFAULT 100,
        requires_collateral BOOLEAN DEFAULT false,
        requires_guarantor BOOLEAN DEFAULT false,
        description TEXT,
        badge_color TEXT DEFAULT '#3B82F6',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS borrowers (
        id TEXT PRIMARY KEY,
        borrower_number TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        id_number TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        email_verified INTEGER DEFAULT 0,
        email_verified_at TEXT,
        date_of_birth TEXT NOT NULL,
        gender TEXT NOT NULL,
        civil_status TEXT NOT NULL,
        address TEXT NOT NULL,
        facebook_account TEXT,
        branch_id TEXT NOT NULL,
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
        profile_completed BOOLEAN DEFAULT FALSE,
        profile_completed_at TEXT,
        existing_member_id TEXT,
        barangay TEXT,
        city_municipality TEXT,
        province TEXT,
        source_of_income TEXT,
        savings_balance DOUBLE PRECISION DEFAULT 0,
        share_capital DOUBLE PRECISION DEFAULT 0,
        active_loans_count INTEGER DEFAULT 0,
        total_borrowed DOUBLE PRECISION DEFAULT 0,
        total_repaid DOUBLE PRECISION DEFAULT 0,
        avatar TEXT NOT NULL,
        joined_date TEXT NOT NULL,
        last_activity_date TEXT NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS membership_applications (
        id TEXT PRIMARY KEY,
        application_number TEXT NOT NULL,
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
        branch_id TEXT NOT NULL,
        submitted_date TEXT NOT NULL,
        current_step TEXT NOT NULL,
        valid_id_attached BOOLEAN DEFAULT true,
        proof_of_income_attached BOOLEAN DEFAULT true,
        two_by_two_photo_attached BOOLEAN DEFAULT true,
        membership_fee_paid BOOLEAN DEFAULT false,
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
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS member_update_requests (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        member_number TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        request_date TEXT NOT NULL,
        channel TEXT NOT NULL,
        field_to_update TEXT NOT NULL,
        old_value TEXT NOT NULL,
        new_value TEXT NOT NULL,
        reason TEXT NOT NULL,
        supporting_doc_type TEXT NOT NULL,
        supporting_doc_file_name TEXT,
        supporting_doc_verified BOOLEAN DEFAULT false,
        status TEXT NOT NULL DEFAULT 'Pending',
        reviewed_by TEXT,
        review_date TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS member_follow_up_logs (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        member_number TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        date TEXT NOT NULL,
        contact_channel TEXT NOT NULL,
        conducted_by TEXT NOT NULL,
        has_outstanding_loan BOOLEAN DEFAULT false,
        outstanding_loan_amount DOUBLE PRECISION DEFAULT 0,
        purpose TEXT NOT NULL,
        member_response TEXT NOT NULL,
        next_follow_up_date TEXT,
        action_taken TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS savings_accounts (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        passbook_number TEXT NOT NULL,
        balance DOUBLE PRECISION DEFAULT 0,
        maintaining_balance DOUBLE PRECISION DEFAULT 1000,
        interest_rate DOUBLE PRECISION DEFAULT 1.0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS savings_transactions (
        id TEXT PRIMARY KEY,
        savings_account_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        transaction_number TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        balance_before DOUBLE PRECISION NOT NULL,
        balance_after DOUBLE PRECISION NOT NULL,
        processed_by TEXT NOT NULL,
        notes TEXT,
        official_receipt_number TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS savings_withdrawal_requests (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        member_id TEXT NOT NULL,
        member_name TEXT NOT NULL,
        branch_id TEXT NOT NULL,
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
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS interest_credit_logs (
        id TEXT PRIMARY KEY,
        period_month TEXT NOT NULL,
        calculation_date TEXT NOT NULL,
        annual_rate DOUBLE PRECISION DEFAULT 1.0,
        total_members_credited INTEGER NOT NULL,
        total_interest_distributed DOUBLE PRECISION NOT NULL,
        executed_by TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS loans (
        id TEXT PRIMARY KEY,
        loan_number TEXT NOT NULL UNIQUE,
        borrower_id TEXT NOT NULL,
        borrower_name TEXT NOT NULL,
        borrower_phone TEXT NOT NULL,
        borrower_avatar TEXT,
        branch_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
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
        is_irregular_account BOOLEAN DEFAULT false,
        total_late_penalties_charged DOUBLE PRECISION DEFAULT 0,
        total_rebates_awarded DOUBLE PRECISION DEFAULT 0,
        disbursement_method TEXT,
        disbursement_account TEXT,
        officer_in_charge TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        receipt_number TEXT NOT NULL UNIQUE,
        loan_id TEXT NOT NULL,
        loan_number TEXT NOT NULL,
        borrower_id TEXT NOT NULL,
        borrower_name TEXT NOT NULL,
        branch_id TEXT NOT NULL,
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
        is_advance_payment BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        performed_by TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        type TEXT NOT NULL,
        user_name TEXT,
        user_role TEXT,
        target_type TEXT,
        target_id TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS solidarity_groups (
        id TEXT PRIMARY KEY,
        group_code TEXT NOT NULL UNIQUE,
        group_name TEXT NOT NULL,
        center_name TEXT NOT NULL,
        branch_id TEXT NOT NULL,
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
        joint_liability_agreed BOOLEAN DEFAULT true,
        status TEXT NOT NULL DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS financial_transactions (
        id TEXT PRIMARY KEY,
        reference_number TEXT NOT NULL,
        client_id TEXT NOT NULL,
        client_name TEXT,
        account_or_loan_id TEXT NOT NULL,
        account_or_loan_type TEXT DEFAULT 'General',
        branch_id TEXT,
        transaction_type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        transaction_date TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        processed_by TEXT NOT NULL,
        processed_by_role TEXT,
        status TEXT NOT NULL,
        notes TEXT,
        reversal_of_txn_id TEXT,
        reversed_by_txn_id TEXT,
        metadata JSONB,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        doc_number TEXT NOT NULL,
        branch_id TEXT NOT NULL,
        client_id TEXT,
        client_name TEXT,
        loan_id TEXT,
        loan_number TEXT,
        doc_name TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        file_url TEXT,
        uploaded_by TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Active',
        notes TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS branch_notifications (
        id TEXT PRIMARY KEY,
        branch_id TEXT NOT NULL,
        target_staff_id TEXT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        related_type TEXT,
        related_id TEXT,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS kyc_submissions (
        id                TEXT PRIMARY KEY,
        borrower_id       TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'NOT_STARTED',
        personal_info     JSONB,
        address           JSONB,
        employment        JSONB,
        submitted_at      TEXT,
        reviewed_at       TEXT,
        reviewed_by       TEXT,
        reviewed_by_name  TEXT,
        correction_reason TEXT,
        rejection_reason  TEXT,
        verified_at       TEXT,
        created_at        TEXT NOT NULL,
        updated_at        TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kyc_submissions_borrower ON kyc_submissions(borrower_id);
      CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);

      CREATE TABLE IF NOT EXISTS kyc_documents (
        id                  TEXT PRIMARY KEY,
        kyc_submission_id   TEXT NOT NULL,
        borrower_id         TEXT NOT NULL,
        document_type       TEXT NOT NULL,
        document_name       TEXT NOT NULL,
        file_name           TEXT,
        file_url            TEXT,
        status              TEXT NOT NULL DEFAULT 'PENDING',
        rejection_reason    TEXT,
        verified_by         TEXT,
        verified_at         TEXT,
        created_at          TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kyc_documents_borrower ON kyc_documents(borrower_id);
      CREATE INDEX IF NOT EXISTS idx_kyc_documents_submission ON kyc_documents(kyc_submission_id);

      CREATE TABLE IF NOT EXISTS kyc_audit_log (
        id                  TEXT PRIMARY KEY,
        borrower_id         TEXT NOT NULL,
        kyc_submission_id   TEXT,
        staff_user_id       TEXT,
        staff_name          TEXT,
        action              TEXT NOT NULL,
        previous_status     TEXT,
        new_status          TEXT,
        reason              TEXT,
        created_at          TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_kyc_audit_borrower ON kyc_audit_log(borrower_id);

      CREATE TABLE IF NOT EXISTS kyc_required_documents (
        id                  TEXT PRIMARY KEY,
        document_type       TEXT NOT NULL,
        document_name       TEXT NOT NULL,
        description         TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order          INTEGER NOT NULL DEFAULT 0,
        created_at          TEXT NOT NULL
      );
    `);

    // Self-heal defaults and ensure modern columns on pre-existing databases
    await client.query(`
      ALTER TABLE borrowers ALTER COLUMN savings_balance SET DEFAULT 0;
      ALTER TABLE borrowers ALTER COLUMN share_capital SET DEFAULT 0;
      ALTER TABLE savings_accounts ALTER COLUMN balance SET DEFAULT 0;

      -- Self-heal pre-existing borrowers table columns
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS email_verified INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS email_verified_at TEXT;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS profile_completed_at TEXT;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS existing_member_id TEXT;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS barangay TEXT;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS city_municipality TEXT;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS province TEXT;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS source_of_income TEXT;
      ALTER TABLE borrowers ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

      CREATE INDEX IF NOT EXISTS idx_borrowers_email_verified ON borrowers (email_verified);
      CREATE INDEX IF NOT EXISTS idx_borrowers_profile_completed ON borrowers (profile_completed);
      CREATE INDEX IF NOT EXISTS idx_borrowers_member_status ON borrowers (member_status);

      -- Seed KYC required documents if empty
      INSERT INTO kyc_required_documents (id, document_type, document_name, description, is_active, sort_order, created_at)
      VALUES
        ('KRD-001', 'VALID_ID',        'Government-Issued Photo ID',        'A valid, unexpired government-issued photo ID (PhilID, Passport, Driver License, UMID, SSS, PRC).',  true, 1,  NOW()::text),
        ('KRD-002', 'PROOF_OF_ADDRESS','Barangay Clearance or Utility Bill','Recent proof of residence within the last 3 months.',                                                         true, 2,  NOW()::text),
        ('KRD-003', 'PROOF_OF_INCOME', 'Payslip / Business Permit / Bank Statement','Evidence of regular income or business operations.',                                                     true, 3,  NOW()::text),
        ('KRD-004', 'PHOTO_2X2',       'Recent 2x2 ID Photo',              'A recent photograph with white background.',                                                                 true, 4,  NOW()::text)
      ON CONFLICT DO NOTHING;

      -- Self-heal handle_new_user function in Supabase auth trigger
      DO $func$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          EXECUTE $fn$
            CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $body$
            DECLARE
              v_role user_role := 'client';
              v_meta_role text;
            BEGIN
              v_meta_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'client'));
              IF v_meta_role IN ('admin', 'client', 'loan_officer', 'manager', 'teller') THEN
                v_role := v_meta_role::user_role;
              END IF;

              INSERT INTO public.profiles (id, full_name, phone, role)
              VALUES (
                NEW.id,
                COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), SPLIT_PART(NEW.email, '@', 1)),
                NEW.phone,
                v_role
              )
              ON CONFLICT (id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

              RETURN NEW;
            EXCEPTION WHEN OTHERS THEN
              RAISE WARNING 'handle_new_user error: %', SQLERRM;
              RETURN NEW;
            END $body$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
          $fn$;
        END IF;
      END
      $func$;
    `);

    console.log('[Database] Schema verified and all tables ensured.');
    return true;
  } catch (err: any) {
    console.error('[Database] Error ensuring tables exist:', err.message);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
}
