-- Rollback of 0000_application_baseline.sql
--
-- Drops the baseline tables. Every later migration depends on them, so roll
-- those back first. This refuses to run unless every baseline table is empty:
-- it exists to undo a fresh build, never to remove an environment's data.

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'id_sequences', 'branches', 'staff', 'loan_products', 'borrowers', 'membership_applications',
    'member_update_requests', 'member_follow_up_logs', 'savings_accounts', 'savings_transactions',
    'savings_withdrawal_requests', 'interest_credit_logs', 'loans', 'payments', 'audit_logs',
    'solidarity_groups', 'financial_transactions', 'documents', 'payment_proofs', 'branch_notifications',
    'kyc_submissions', 'kyc_documents', 'kyc_audit_log', 'kyc_required_documents'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'Refusing to roll back 0000: table % has % rows', t, n;
      END IF;
    END IF;
  END LOOP;
END $$;

DROP TABLE IF EXISTS
  kyc_required_documents, kyc_audit_log, kyc_documents, kyc_submissions, branch_notifications,
  payment_proofs, documents, financial_transactions, solidarity_groups, audit_logs, payments, loans,
  interest_credit_logs, savings_withdrawal_requests, savings_transactions, savings_accounts,
  member_follow_up_logs, member_update_requests, membership_applications, borrowers, loan_products,
  staff, branches, id_sequences, users
  CASCADE;
