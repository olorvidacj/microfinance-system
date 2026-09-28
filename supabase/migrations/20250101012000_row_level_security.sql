-- ============================================================
-- 0009 — ROW LEVEL SECURITY (Supabase Auth aware)
-- Requires: 0002..0008
--
-- Model:
--   * auth.uid() = JWT subject. NULL ⇒ backend service key
--     (service role BYPASSES RLS entirely — that is the sanctioned
--      write path for financial + audit inserts).
--   * Helpers are SECURITY DEFINER to avoid recursive policy scans.
-- ============================================================

-- ------------------------------------------------------------
-- Helper functions
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_my_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_my_client_id() RETURNS UUID AS $$
  SELECT client_id FROM profiles WHERE id = auth.uid() AND is_active
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_staff() RETURNS BOOLEAN AS $$
  SELECT COALESCE(get_my_role()) IN ('admin','manager','loan_officer','teller')
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_admin_or_manager() RETURNS BOOLEAN AS $$
  SELECT COALESCE(get_my_role()) IN ('admin','manager')
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- Enable RLS everywhere
-- ------------------------------------------------------------
ALTER TABLE profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_kyc            ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_accounts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_applications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_installments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications         ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- profiles: self read/update-limited; staff read all; admin manage
-- (privileged column changes blocked by trg_guard_profiles)
-- ------------------------------------------------------------
CREATE POLICY p_profiles_self_read    ON profiles FOR SELECT USING (id = auth.uid() OR is_staff());
CREATE POLICY p_profiles_self_update  ON profiles FOR UPDATE USING (id = auth.uid() OR is_admin_or_manager())
                                       WITH CHECK (id = auth.uid() OR is_admin_or_manager());
CREATE POLICY p_profiles_staff_insert ON profiles FOR INSERT WITH CHECK (is_admin_or_manager());

-- clients ------------------------------------------------------
CREATE POLICY p_clients_read   ON clients FOR SELECT USING (is_staff() OR client_id = get_my_client_id());
CREATE POLICY p_clients_insert ON clients FOR INSERT WITH CHECK (is_staff());
CREATE POLICY p_clients_update ON clients FOR UPDATE USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY p_clients_delete ON clients FOR DELETE USING (get_my_role() = 'admin');

-- client_kyc ---------------------------------------------------
CREATE POLICY p_kyc_read ON client_kyc FOR SELECT
  USING (is_staff() OR client_id = get_my_client_id());
-- Clients may submit their own docs, always as 'pending'
CREATE POLICY p_kyc_submit ON client_kyc FOR INSERT
  WITH CHECK (client_id = get_my_client_id() AND verification_status = 'pending');
CREATE POLICY p_kyc_staff_insert ON client_kyc FOR INSERT WITH CHECK (is_staff());
CREATE POLICY p_kyc_update ON client_kyc FOR UPDATE USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY p_kyc_delete ON client_kyc FOR DELETE USING (get_my_role() = 'admin');

-- product catalogs --------------------------------------------
CREATE POLICY p_savprod_read   ON savings_products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY p_savprod_write  ON savings_products FOR ALL
  USING (is_admin_or_manager()) WITH CHECK (is_admin_or_manager());
CREATE POLICY p_loanprod_read  ON loan_products FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY p_loanprod_write ON loan_products FOR ALL
  USING (is_admin_or_manager()) WITH CHECK (is_admin_or_manager());

-- savings ------------------------------------------------------
CREATE POLICY p_savacc_read   ON savings_accounts FOR SELECT
  USING (is_staff() OR client_id = get_my_client_id());
CREATE POLICY p_savacc_write  ON savings_accounts FOR INSERT WITH CHECK (is_staff());
CREATE POLICY p_savacc_update ON savings_accounts FOR UPDATE USING (is_staff()) WITH CHECK (is_staff());
CREATE POLICY p_savacc_delete ON savings_accounts FOR DELETE USING (get_my_role() = 'admin');

-- Clients read the passbook of THEIR accounts only
CREATE POLICY p_stx_read   ON savings_transactions FOR SELECT
  USING (is_staff() OR EXISTS (
    SELECT 1 FROM savings_accounts a
    WHERE a.savings_account_id = savings_transactions.savings_account_id
      AND a.client_id = get_my_client_id()));
CREATE POLICY p_stx_insert ON savings_transactions FOR INSERT WITH CHECK (is_staff());
CREATE POLICY p_stx_update ON savings_transactions FOR UPDATE USING (is_staff()) WITH CHECK (is_staff());

-- loans --------------------------------------------------------
CREATE POLICY p_apps_read   ON loan_applications FOR SELECT
  USING (is_staff() OR client_id = get_my_client_id());
-- Client may submit for self, only in draft/submitted state
CREATE POLICY p_apps_submit ON loan_applications FOR INSERT
  WITH CHECK (client_id = get_my_client_id() AND status IN ('draft','submitted'));
CREATE POLICY p_apps_staff_insert ON loan_applications FOR INSERT WITH CHECK (is_staff());
CREATE POLICY p_apps_update ON loan_applications FOR UPDATE USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY p_loans_read   ON loans FOR SELECT USING (is_staff() OR client_id = get_my_client_id());
CREATE POLICY p_loans_insert ON loans FOR INSERT WITH CHECK (is_staff());
CREATE POLICY p_loans_update ON loans FOR UPDATE USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY p_inst_read ON loan_installments FOR SELECT
  USING (is_staff() OR EXISTS (
    SELECT 1 FROM loans l WHERE l.loan_id = loan_installments.loan_id
      AND l.client_id = get_my_client_id()));
CREATE POLICY p_inst_write ON loan_installments FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY p_pay_read   ON loan_payments FOR SELECT
  USING (is_staff() OR client_id = get_my_client_id());
CREATE POLICY p_pay_insert ON loan_payments FOR INSERT WITH CHECK (is_staff());
CREATE POLICY p_pay_update ON loan_payments FOR UPDATE USING (is_staff()) WITH CHECK (is_staff());

-- groups -------------------------------------------------------
CREATE POLICY p_groups_read ON lending_groups FOR SELECT
  USING (is_staff() OR EXISTS (
    SELECT 1 FROM lending_group_members m
    WHERE m.group_id = lending_groups.group_id AND m.client_id = get_my_client_id()));
CREATE POLICY p_groups_write ON lending_groups FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

CREATE POLICY p_gm_read ON lending_group_members FOR SELECT
  USING (is_staff() OR client_id = get_my_client_id());
CREATE POLICY p_gm_write ON lending_group_members FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

-- financial integration stack ---------------------------------
CREATE POLICY p_ft_read ON financial_transactions FOR SELECT
  USING (is_staff() OR client_id = get_my_client_id());
-- NOTE: no INSERT/UPDATE/DELETE policies → service role only.

CREATE POLICY p_acct_read   ON accounts FOR SELECT USING (is_admin_or_manager());
CREATE POLICY p_acct_write  ON accounts FOR ALL USING (is_admin_or_manager())
                              WITH CHECK (is_admin_or_manager());
CREATE POLICY p_je_read     ON journal_entries FOR SELECT USING (is_admin_or_manager());
CREATE POLICY p_je_write    ON journal_entries FOR ALL USING (is_admin_or_manager())
                              WITH CHECK (is_admin_or_manager());
CREATE POLICY p_jel_read    ON journal_entry_lines FOR SELECT USING (is_admin_or_manager());
CREATE POLICY p_jel_write   ON journal_entry_lines FOR ALL USING (is_admin_or_manager())
                              WITH CHECK (is_admin_or_manager());
CREATE POLICY p_cash_read   ON cash_transactions FOR SELECT USING (is_admin_or_manager());
CREATE POLICY p_cash_write  ON cash_transactions FOR ALL USING (is_admin_or_manager())
                              WITH CHECK (is_admin_or_manager());

-- audit logs: staff-visible history, service-role-only writes --
CREATE POLICY p_audit_read ON audit_logs FOR SELECT USING (is_admin_or_manager());
-- NOTE: no insert policy on purpose.

-- notifications: own inbox -------------------------------------
CREATE POLICY p_notif_read   ON notifications FOR SELECT USING (profile_id = auth.uid() OR is_staff());
CREATE POLICY p_notif_update ON notifications FOR UPDATE USING (profile_id = auth.uid())
                               WITH CHECK (profile_id = auth.uid());
