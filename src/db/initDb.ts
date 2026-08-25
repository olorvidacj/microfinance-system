import { getPool } from './index';

export async function initDbSchema(): Promise<boolean> {
  const pool = getPool();
  if (!pool) {
    return false;
  }

  let client;
  try {
    client = await pool.connect();
  } catch (err: any) {
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
        savings_balance DOUBLE PRECISION DEFAULT 1000,
        share_capital DOUBLE PRECISION DEFAULT 15000,
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
        balance DOUBLE PRECISION DEFAULT 1000,
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
