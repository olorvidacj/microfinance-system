-- ============================================================
-- 0017 - ROW LEVEL SECURITY FOR THE LEGACY SCHEMA  (DRAFT - DO NOT BLIND-APPLY)
--        (requires: 0015, 0016)
--
-- WHY THIS FILE IS A DRAFT
--   This is the only Phase C file that is not safe to simply run.
--   It closes a critical hole, but it embeds two decisions that
--   affect who can sign in. Read "THINGS TO DECIDE" below first.
--
-- THE HOLE (verified against the live database)
--   RLS is enabled on most tables, which looks protective, but on
--   the seven tables holding money and identity it is a no-op:
--
--     borrowers, loans, payments, savings_accounts,
--     savings_withdrawal_requests, staff, branches
--       -> policy "Allow full access to <table>"
--          FOR ALL TO public USING (true) WITH CHECK (true)
--
--   USING (true) for role public means every row is readable and
--   writable by anyone holding a table grant. RLS is enabled, so
--   tooling reports the table as protected, while providing no
--   protection at all. Any future grant to anon/authenticated
--   turns this into a full data breach.
--
--   Eight further tables have RLS switched off entirely:
--     documents, financial_transactions, kyc_documents,
--     kyc_submissions, kyc_audit_log, branch_notifications,
--     kyc_required_documents, id_sequences
--
--   Partial mitigation today: role_table_grants shows grants only
--   to postgres and service_role. anon and authenticated have no
--   grant on these tables, and the app reaches the database only
--   through the service-role key, so this is not remotely
--   exploitable in the current deployment. The gap is defence in
--   depth, not an active leak.
--
-- WHY THE IDENTITY HELPER MATCHES ON EMAIL
--   The obvious helper is "users.id = auth.uid()". That is wrong
--   here: only 5 of the 18 rows in users have a UUID-shaped id.
--   The rest are legacy/local-HMAC ids. A helper keyed on auth.uid()
--   would silently deny 13 of 18 accounts.
--
--   The backend already handles this by falling back to an email
--   lookup (server.ts authenticate(): findById, then
--   findByEmailOrPhone). This helper uses the same email identity
--   so RLS and the application agree on who the caller is.
--
-- DECISIONS TAKEN (resolved, no longer open)
--   1. LOCAL-HMAC / DEV MODE -> dev tooling must connect with the
--      service-role key, exactly as production does. No dev bypass is
--      added to the helpers. Rationale: a conditional bypass is one
--      misconfiguration away from being a production hole, whereas
--      "dev uses the same key as prod" cannot leak. Consequence: a
--      dev session presenting a locally signed HMAC token and calling
--      the database as anon/authenticated will be denied. It must
--      present the service-role key instead.
--   2. BRANCH SCOPING -> staff branch lives in staff.assigned_branch_id
--      because users has no branch_id column. Global roles
--      (ADMINISTRATOR, MANAGER, CREDIT_COMMITTEE, BOARD_OF_DIRECTORS)
--      are cross-branch via is_global_staff() below.
--
-- STILL UNAPPLIED
--   0015 and 0016 are live. This file is not: 15 "Allow full access"
--   USING (true) policies are still in place and the 8 previously
--   unprotected tables still have RLS disabled. Verified present as of
--   the 0015/0016 apply.
-- ============================================================

-- ------------------------------------------------------------
-- 1) IDENTITY HELPERS
--    SECURITY DEFINER so the policy does not recurse through the
--    users table's own policies. search_path pinned.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_user_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT u.id::text
     FROM public.users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.is_active
    LIMIT 1 $$;

CREATE OR REPLACE FUNCTION my_borrower_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT u.borrower_id
     FROM public.users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.is_active
      AND u.borrower_id IS NOT NULL
    LIMIT 1 $$;

-- Coarse role: 'STAFF' | 'CLIENT' (the same two values /auth/login emits).
CREATE OR REPLACE FUNCTION my_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT u.role
     FROM public.users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.is_active
    LIMIT 1 $$;

-- Specific job title, e.g. LOAN_OFFICER, MANAGER, CASHIER_TELLER.
-- Vocabulary is the one actually present in users.staff_role.
CREATE OR REPLACE FUNCTION my_staff_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT u.staff_role
     FROM public.users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.is_active
    LIMIT 1 $$;

CREATE OR REPLACE FUNCTION is_backend_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT coalesce(my_role(), '') = 'STAFF' $$;

-- Roles that legitimately need cross-branch visibility.
CREATE OR REPLACE FUNCTION is_global_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT coalesce(my_staff_role(), '')
          IN ('ADMINISTRATOR','MANAGER','CREDIT_COMMITTEE','BOARD_OF_DIRECTORS') $$;

CREATE OR REPLACE FUNCTION is_admin_staff() RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT coalesce(my_staff_role(), '') IN ('ADMINISTRATOR','MANAGER') $$;

CREATE OR REPLACE FUNCTION my_staff_branch_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT s.assigned_branch_id
     FROM public.users u
     JOIN public.staff s ON s.id::text = u.staff_id::text
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.is_active
    LIMIT 1 $$;

-- The caller's own staff row id. branch_notifications.target_staff_id
-- references staff, not users, so this is distinct from my_user_id().
CREATE OR REPLACE FUNCTION my_staff_id() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT u.staff_id::text
     FROM public.users u
    WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      AND u.is_active
    LIMIT 1 $$;

-- Grant USAGE so anon/authenticated can call them from a policy.
GRANT EXECUTE ON FUNCTION my_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION my_borrower_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION my_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION my_staff_role() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_backend_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_global_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION is_admin_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION my_staff_branch_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION my_staff_id() TO anon, authenticated;

-- ------------------------------------------------------------
-- 2) REPLACE THE PERMISSIVE POLICIES
--
-- 15 tables carry "Allow full access to <t>" FOR ALL TO public
-- USING (true) WITH CHECK (true):
--   audit_logs, borrowers, branches, interest_credit_logs,
--   loan_products, loans, member_follow_up_logs,
--   member_update_requests, membership_applications, payments,
--   savings_accounts, savings_transactions,
--   savings_withdrawal_requests, solidarity_groups, staff
--
-- IMPORTANT - WHY THIS IS SAFE TO DO NOW:
--   role_table_grants shows NO grants at all to anon or
--   authenticated on any of these tables; only service_role has
--   them. The backend connects with the service-role key, which
--   has BYPASSRLS. So every policy below has ZERO effect on
--   current application behaviour. They exist purely so that a
--   future GRANT to anon/authenticated cannot silently expose
--   data. That is why this file can be strict without risking a
--   production outage - but it also means the policies are not
--   currently doing any work. Real enforcement is in
--   /src/auth/permissions.ts; RLS is the backstop.
--
-- Because the policies are a backstop rather than the live
-- control plane, they are deliberately strict:
--   * clients get SELECT on their own rows only
--   * branch staff get SELECT on their branch's rows
--   * global staff get SELECT everywhere
--   * ALL writes are staff-only (self-service KYC submission is
--     still possible via the backend, which uses service_role)
-- ------------------------------------------------------------

-- ---- borrowers -------------------------------------------------
DROP POLICY IF EXISTS "Allow full access to borrowers" ON borrowers;
DROP POLICY IF EXISTS p_borrowers_client_read ON borrowers;
CREATE POLICY p_borrowers_client_read ON borrowers FOR SELECT TO authenticated
  USING (id::text = my_borrower_id());
DROP POLICY IF EXISTS p_borrowers_branch_read ON borrowers;
CREATE POLICY p_borrowers_branch_read ON borrowers FOR SELECT TO authenticated
  USING (is_global_staff() OR (is_backend_staff() AND branch_id::text = my_staff_branch_id()));
DROP POLICY IF EXISTS p_borrowers_staff_write ON borrowers;
CREATE POLICY p_borrowers_staff_write ON borrowers FOR ALL TO authenticated
  USING (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()))
  WITH CHECK (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()));

-- ---- branches --------------------------------------------------
DROP POLICY IF EXISTS "Allow full access to branches" ON branches;
DROP POLICY IF EXISTS p_branches_read ON branches;
CREATE POLICY p_branches_read ON branches FOR SELECT TO authenticated
  USING (true);
DROP POLICY IF EXISTS p_branches_admin_write ON branches;
CREATE POLICY p_branches_admin_write ON branches FOR ALL TO authenticated
  USING (is_admin_staff()) WITH CHECK (is_admin_staff());

-- ---- loans -----------------------------------------------------
DROP POLICY IF EXISTS "Allow full access to loans" ON loans;
DROP POLICY IF EXISTS p_loans_client_read ON loans;
CREATE POLICY p_loans_client_read ON loans FOR SELECT TO authenticated
  USING (borrower_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_loans_branch_read ON loans;
CREATE POLICY p_loans_branch_read ON loans FOR SELECT TO authenticated
  USING (is_global_staff() OR (is_backend_staff() AND branch_id::text = my_staff_branch_id()));
DROP POLICY IF EXISTS p_loans_staff_write ON loans;
CREATE POLICY p_loans_staff_write ON loans FOR ALL TO authenticated
  USING (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()))
  WITH CHECK (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()));

-- ---- payments --------------------------------------------------
DROP POLICY IF EXISTS "Allow full access to payments" ON payments;
DROP POLICY IF EXISTS p_payments_client_read ON payments;
CREATE POLICY p_payments_client_read ON payments FOR SELECT TO authenticated
  USING (borrower_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_payments_branch_read ON payments;
CREATE POLICY p_payments_branch_read ON payments FOR SELECT TO authenticated
  USING (is_global_staff() OR (is_backend_staff() AND branch_id::text = my_staff_branch_id()));
DROP POLICY IF EXISTS p_payments_staff_write ON payments;
CREATE POLICY p_payments_staff_write ON payments FOR ALL TO authenticated
  USING (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()))
  WITH CHECK (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()));

-- ---- savings_accounts ------------------------------------------
DROP POLICY IF EXISTS "Allow full access to savings_accounts" ON savings_accounts;
DROP POLICY IF EXISTS p_savings_accounts_client_read ON savings_accounts;
CREATE POLICY p_savings_accounts_client_read ON savings_accounts FOR SELECT TO authenticated
  USING (member_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_savings_accounts_staff_read ON savings_accounts;
CREATE POLICY p_savings_accounts_staff_read ON savings_accounts FOR SELECT TO authenticated
  USING (is_global_staff() OR is_backend_staff());
DROP POLICY IF EXISTS p_savings_accounts_staff_write ON savings_accounts;
CREATE POLICY p_savings_accounts_staff_write ON savings_accounts FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- ---- savings_transactions --------------------------------------
DROP POLICY IF EXISTS "Allow full access to savings_transactions" ON savings_transactions;
DROP POLICY IF EXISTS p_savings_tx_client_read ON savings_transactions;
CREATE POLICY p_savings_tx_client_read ON savings_transactions FOR SELECT TO authenticated
  USING (member_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_savings_tx_staff_read ON savings_transactions;
CREATE POLICY p_savings_tx_staff_read ON savings_transactions FOR SELECT TO authenticated
  USING (is_global_staff() OR is_backend_staff());
DROP POLICY IF EXISTS p_savings_tx_staff_write ON savings_transactions;
CREATE POLICY p_savings_tx_staff_write ON savings_transactions FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- ---- savings_withdrawal_requests -------------------------------
DROP POLICY IF EXISTS "Allow full access to savings_withdrawal_requests" ON savings_withdrawal_requests;
DROP POLICY IF EXISTS p_swr_client_read ON savings_withdrawal_requests;
CREATE POLICY p_swr_client_read ON savings_withdrawal_requests FOR SELECT TO authenticated
  USING (member_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_swr_staff_read ON savings_withdrawal_requests;
CREATE POLICY p_swr_staff_read ON savings_withdrawal_requests FOR SELECT TO authenticated
  USING (is_global_staff() OR (is_backend_staff() AND branch_id::text = my_staff_branch_id()));
DROP POLICY IF EXISTS p_swr_staff_write ON savings_withdrawal_requests;
CREATE POLICY p_swr_staff_write ON savings_withdrawal_requests FOR ALL TO authenticated
  USING (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()))
  WITH CHECK (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()));

-- ---- staff -----------------------------------------------------
-- A client must never be able to enumerate staff or their roles.
DROP POLICY IF EXISTS "Allow full access to staff" ON staff;
DROP POLICY IF EXISTS p_staff_self_read ON staff;
CREATE POLICY p_staff_self_read ON staff FOR SELECT TO authenticated
  USING (id::text = (SELECT staff_id::text FROM public.users u
                      WHERE lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
                        AND u.is_active LIMIT 1));
DROP POLICY IF EXISTS p_staff_branch_read ON staff;
CREATE POLICY p_staff_branch_read ON staff FOR SELECT TO authenticated
  USING (is_global_staff() OR (is_backend_staff() AND assigned_branch_id::text = my_staff_branch_id()));
DROP POLICY IF EXISTS p_staff_admin_write ON staff;
CREATE POLICY p_staff_admin_write ON staff FOR ALL TO authenticated
  USING (is_admin_staff()) WITH CHECK (is_admin_staff());

-- ---- remaining permissive tables -------------------------------
-- These have no client-facing link column, so they are staff-scoped.
DROP POLICY IF EXISTS "Allow full access to audit_logs" ON audit_logs;
DROP POLICY IF EXISTS p_audit_logs_staff ON audit_logs;
CREATE POLICY p_audit_logs_staff ON audit_logs FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

DROP POLICY IF EXISTS "Allow full access to interest_credit_logs" ON interest_credit_logs;
DROP POLICY IF EXISTS p_interest_logs_staff ON interest_credit_logs;
CREATE POLICY p_interest_logs_staff ON interest_credit_logs FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

DROP POLICY IF EXISTS "Allow full access to loan_products" ON loan_products;
DROP POLICY IF EXISTS p_loan_products_read ON loan_products;
CREATE POLICY p_loan_products_read ON loan_products FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_loan_products_write ON loan_products;
CREATE POLICY p_loan_products_write ON loan_products FOR ALL TO authenticated
  USING (is_admin_staff()) WITH CHECK (is_admin_staff());

DROP POLICY IF EXISTS "Allow full access to member_follow_up_logs" ON member_follow_up_logs;
DROP POLICY IF EXISTS p_follow_up_staff ON member_follow_up_logs;
CREATE POLICY p_follow_up_staff ON member_follow_up_logs FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

DROP POLICY IF EXISTS "Allow full access to member_update_requests" ON member_update_requests;
DROP POLICY IF EXISTS p_member_update_read ON member_update_requests;
CREATE POLICY p_member_update_read ON member_update_requests FOR SELECT TO authenticated
  USING (is_backend_staff() OR member_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_member_update_write ON member_update_requests;
CREATE POLICY p_member_update_write ON member_update_requests FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

DROP POLICY IF EXISTS "Allow full access to membership_applications" ON membership_applications;
DROP POLICY IF EXISTS p_membership_apps ON membership_applications;
CREATE POLICY p_membership_apps ON membership_applications FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

DROP POLICY IF EXISTS "Allow full access to solidarity_groups" ON solidarity_groups;
DROP POLICY IF EXISTS p_solidarity_read ON solidarity_groups;
CREATE POLICY p_solidarity_read ON solidarity_groups FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_solidarity_write ON solidarity_groups;
CREATE POLICY p_solidarity_write ON solidarity_groups FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- ------------------------------------------------------------
-- 3) ENABLE RLS ON THE 8 TABLES THAT HAD IT SWITCHED OFF
--
-- These tables have RLS DISABLED, so any role with a grant sees
-- every row with no filtering at all. Grants are currently
-- service_role only, so nothing is exposed; but "RLS off" is a
-- loaded gun. Enabling RLS with no permissive policy is the
-- correct deny-by-default posture: service_role still bypasses it,
-- so the application is unaffected.
-- ------------------------------------------------------------

-- Client's own documents (documents.client_id holds a borrower id)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_documents_client_read ON documents;
CREATE POLICY p_documents_client_read ON documents FOR SELECT TO authenticated
  USING (client_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_documents_staff_read ON documents;
CREATE POLICY p_documents_staff_read ON documents FOR SELECT TO authenticated
  USING (is_global_staff() OR (is_backend_staff() AND branch_id::text = my_staff_branch_id()));
DROP POLICY IF EXISTS p_documents_staff_write ON documents;
CREATE POLICY p_documents_staff_write ON documents FOR ALL TO authenticated
  USING (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()))
  WITH CHECK (is_backend_staff() AND (is_global_staff() OR branch_id::text = my_staff_branch_id()));

-- Money movement. Clients see their own, staff see their branch.
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_fin_tx_client_read ON financial_transactions;
CREATE POLICY p_fin_tx_client_read ON financial_transactions FOR SELECT TO authenticated
  USING (client_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_fin_tx_staff_read ON financial_transactions;
CREATE POLICY p_fin_tx_staff_read ON financial_transactions FOR SELECT TO authenticated
  USING (is_global_staff() OR (is_backend_staff() AND branch_id::text = my_staff_branch_id()));
DROP POLICY IF EXISTS p_fin_tx_staff_write ON financial_transactions;
CREATE POLICY p_fin_tx_staff_write ON financial_transactions FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- Internal sequence counters. Never client-readable.
ALTER TABLE id_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_id_sequences_staff ON id_sequences;
CREATE POLICY p_id_sequences_staff ON id_sequences FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- KYC. Clients see only their own submissions/documents/audit trail.
ALTER TABLE kyc_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_kyc_sub_client_read ON kyc_submissions;
CREATE POLICY p_kyc_sub_client_read ON kyc_submissions FOR SELECT TO authenticated
  USING (borrower_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_kyc_sub_staff ON kyc_submissions;
CREATE POLICY p_kyc_sub_staff ON kyc_submissions FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_kyc_docs_client_read ON kyc_documents;
CREATE POLICY p_kyc_docs_client_read ON kyc_documents FOR SELECT TO authenticated
  USING (borrower_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_kyc_docs_staff ON kyc_documents;
CREATE POLICY p_kyc_docs_staff ON kyc_documents FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

ALTER TABLE kyc_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_kyc_audit_client_read ON kyc_audit_log;
CREATE POLICY p_kyc_audit_client_read ON kyc_audit_log FOR SELECT TO authenticated
  USING (borrower_id::text = my_borrower_id());
DROP POLICY IF EXISTS p_kyc_audit_staff ON kyc_audit_log;
CREATE POLICY p_kyc_audit_staff ON kyc_audit_log FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- Reference catalogue of required document types: readable by all
-- signed-in users, writable by staff only.
ALTER TABLE kyc_required_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_kyc_req_read ON kyc_required_documents;
CREATE POLICY p_kyc_req_read ON kyc_required_documents FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS p_kyc_req_write ON kyc_required_documents;
CREATE POLICY p_kyc_req_write ON kyc_required_documents FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- Notifications are addressed to a specific staff member.
ALTER TABLE branch_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_branch_notif_read ON branch_notifications;
CREATE POLICY p_branch_notif_read ON branch_notifications FOR SELECT TO authenticated
  USING (is_global_staff()
         OR (is_backend_staff() AND (target_staff_id::text = my_staff_id()
              OR branch_id::text = my_staff_branch_id())));
DROP POLICY IF EXISTS p_branch_notif_write ON branch_notifications;
CREATE POLICY p_branch_notif_write ON branch_notifications FOR ALL TO authenticated
  USING (is_backend_staff()) WITH CHECK (is_backend_staff());

-- ------------------------------------------------------------
-- 4) VERIFICATION (read-only; safe to run any time)
--
-- Expect ZERO rows here. Any hit means a permissive policy survived.
--
--   SELECT tablename, policyname FROM pg_policies
--    WHERE schemaname='public' AND (qual='true' OR with_check='true')
--      AND tablename NOT IN ('branches','loan_products','solidarity_groups',
--                             'kyc_required_documents');
--
-- Expect every target table to report true:
--
--   SELECT relname, relrowsecurity FROM pg_class c
--     JOIN pg_namespace n ON n.oid=c.relnamespace
--    WHERE n.nspname='public' AND relname = ANY(ARRAY[
--      'borrowers','branches','loans','payments','savings_accounts',
--      'savings_transactions','savings_withdrawal_requests','staff',
--      'documents','financial_transactions','id_sequences','kyc_submissions',
--      'kyc_documents','kyc_audit_log','kyc_required_documents',
--      'branch_notifications','audit_logs','interest_credit_logs',
--      'loan_products','member_follow_up_logs','member_update_requests',
--      'membership_applications','solidarity_groups']);
--
-- STILL TRUE AFTER APPLYING - the live control plane is the
-- backend, not RLS:
--   anon and authenticated still hold NO grants on these tables,
--   and the app connects with the service-role key (BYPASSRLS).
--   Verify with:
--   SELECT table_name, grantee FROM information_schema.role_table_grants
--    WHERE table_schema='public' AND grantee IN ('anon','authenticated');
