-- ============================================================
-- 0008 — FUNCTIONS & TRIGGERS
-- Requires: 0002..0007
-- ============================================================

-- ------------------------------------------------------------
-- 1. Generic updated_at maintainer
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at      BEFORE UPDATE ON profiles            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_clients_updated_at       BEFORE UPDATE ON clients             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_kyc_updated_at           BEFORE UPDATE ON client_kyc          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sav_products_updated_at  BEFORE UPDATE ON savings_products    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sav_accounts_updated_at  BEFORE UPDATE ON savings_accounts    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loan_products_updated_at BEFORE UPDATE ON loan_products       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_apps_updated_at          BEFORE UPDATE ON loan_applications   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loans_updated_at         BEFORE UPDATE ON loans               FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_inst_updated_at          BEFORE UPDATE ON loan_installments   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_groups_updated_at        BEFORE UPDATE ON lending_groups      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- 2. Auto-provision profile on Supabase Auth signup
--    role/full_name come from signup metadata; defaults to 'client'.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
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
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Guard: users must never be able to self-promote or re-link their profile.
-- auth.uid() IS NULL ⇒ request came via backend service key ⇒ allowed.
CREATE OR REPLACE FUNCTION guard_profile_changes() RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.role <> OLD.role OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.is_active <> OLD.is_active THEN
      RAISE EXCEPTION 'Privileged profile fields may only be changed by staff services';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_guard_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profile_changes();

-- ------------------------------------------------------------
-- 3. Overdue installment sweep — call nightly from a scheduler:
--    SELECT mark_overdue_installments();
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_overdue_installments() RETURNS integer AS $$
DECLARE affected INTEGER;
BEGIN
  UPDATE loan_installments li
     SET status = 'overdue', updated_at = NOW()
    FROM loans l
   WHERE li.loan_id = l.loan_id
     AND l.status IN ('disbursed', 'active')
     AND li.status = 'pending'
     AND li.due_date < CURRENT_DATE;
  GET DIAGNOSTICS affected = ROW_COUNT;

  UPDATE loans l
     SET days_in_arrears = GREATEST(0, (CURRENT_DATE - i.min_due::DATE))
    FROM (SELECT loan_id, MIN(due_date) AS min_due
            FROM loan_installments
           WHERE status IN ('pending', 'partially_paid', 'overdue')
           GROUP BY loan_id) i
   WHERE l.loan_id = i.loan_id AND l.status IN ('disbursed', 'active');
  RETURN affected;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- 4. Loan status transition guard (state machine at DB level).
--    Allowed transitions mirror the Phase-8 workflow.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_loan_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status, NEW.status) IN (
        ('draft','submitted'), ('draft','cancelled'),
        ('submitted','under_review'), ('submitted','approved'),
        ('under_review','approved'), ('under_review','rejected'),
        ('approved','disbursed'), ('approved','cancelled'),
        ('disbursed','active'),
        ('active','fully_paid'), ('active','defaulted')
      )
    ) THEN
      RAISE EXCEPTION 'Illegal loan status transition % -> %', OLD.status, NEW.status;
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_loan_state BEFORE UPDATE ON loans
  FOR EACH ROW EXECUTE FUNCTION guard_loan_status();

-- ------------------------------------------------------------
-- 5. Application review integrity: only approved apps create loans,
--    and approvals must record reviewer + amount.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_application_review() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('approved','rejected') AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN
      RAISE EXCEPTION 'Review decision requires reviewed_by and reviewed_at';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_review BEFORE UPDATE ON loan_applications
  FOR EACH ROW EXECUTE FUNCTION guard_application_review();
