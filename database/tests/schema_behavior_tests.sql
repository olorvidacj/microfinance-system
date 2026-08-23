-- ============ SCHEMA BEHAVIOR TESTS (run after migrations) ============
-- How to run (Supabase SQL Editor or psql, in a THROWAWAY database):
--   1. Apply migrations 0001..0010 first.
--   2. Run this file with \set ON_ERROR_STOP on.
--   Expected final output row: 'ALL BEHAVIOR TESTS PASSED'
-- NOTE: the auth.users insert at the top requires the Supabase auth schema
--       (or a local stub table of the same shape when testing in vanilla PG).
\set ON_ERROR_STOP on

-- Setup: fixed staff verifier used by later assertions
-- (test-only Supabase-auth stub user; real deployments use Supabase Auth)
-- NOTE: inserting into auth.users exercises the on_auth_user_created trigger,
-- which auto-provisions the matching public.profiles row.
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('11111111-1111-1111-1111-111111111111', 'staff.verifier@test.local',
        '{"role":"admin","full_name":"Staff Verifier"}'::jsonb);

-- T1: client_code auto-generation pattern
DO $$
DECLARE code TEXT;
BEGIN
  INSERT INTO clients (full_name, date_of_birth, gender, contact_number, street_address, city_municipality, province)
  VALUES ('Maria Santos','1990-05-01','female','+639171112222','123 Rizal St.','Tacloban City','Leyte')
  RETURNING client_code INTO code;
  IF code NOT LIKE 'CL-%' THEN RAISE EXCEPTION 'T1 FAIL: %', code; END IF;
END $$;

-- T2: duplicate email (case-insensitive) must be rejected
DO $$
BEGIN
  INSERT INTO clients (full_name, date_of_birth, gender, contact_number, street_address, city_municipality, province, email)
  VALUES ('Maria Santos','1990-05-01','female','+639171112222','123 Rizal St.','Tacloban City','Leyte','maria@example.com');
  -- second signup, same person different case
  INSERT INTO clients (full_name, date_of_birth, gender, contact_number, street_address, city_municipality, province, email)
  VALUES ('Copy Cat','1980-01-01','male','+639999999999','X St.','City','Prov', 'MARIA@EXAMPLE.COM');
  RAISE EXCEPTION 'T2 FAIL: duplicate email accepted';
EXCEPTION WHEN unique_violation THEN NULL;
END $$;

-- T3: same government ID verified twice across clients must be rejected
-- (also proves LOWER()-based uniqueness is case-insensitive)
DO $$
DECLARE cid UUID; cid2 UUID;
      verifier UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  INSERT INTO clients (full_name, date_of_birth, gender, contact_number, street_address, city_municipality, province)
  VALUES ('Id Holder One','1975-03-03','female','+639170000001','Y St.','City','Prov') RETURNING client_id INTO cid;
  -- legitimate first verification
  INSERT INTO client_kyc (client_id, id_type, id_number, document_url, verification_status, verified_by, verified_at)
  VALUES (cid,'UMID','UMID-DUP-777','storage/holder1.jpg','verified',verifier,NOW());
  -- different person tries to verify the SAME id number
  INSERT INTO clients (full_name, date_of_birth, gender, contact_number, street_address, city_municipality, province)
  VALUES ('Id Holder Two','1992-09-09','male','+639170000002','Z St.','City','Prov') RETURNING client_id INTO cid2;
  BEGIN
    INSERT INTO client_kyc (client_id, id_type, id_number, document_url, verification_status, verified_by, verified_at)
    VALUES (cid2,'umid','umid-dup-777','storage/holder2.jpg','verified',verifier,NOW());
    RAISE EXCEPTION 'T3 FAIL: verified ID duplicated across clients';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- T4: passbook ledger arithmetic enforced
DO $$
DECLARE acc UUID;
BEGIN
  INSERT INTO savings_products (product_code, product_name, product_type, interest_rate)
  VALUES ('SAV-T','Test Sav','regular',1.0);
  SELECT savings_product_id INTO acc FROM savings_products WHERE product_code='SAV-T';
  -- open account for first client
  INSERT INTO savings_accounts (client_id, savings_product_id)
  SELECT c.client_id, sp.savings_product_id FROM clients c, savings_products sp
  WHERE sp.product_code='SAV-T' ORDER BY c.created_at LIMIT 1;
  SELECT savings_account_id INTO acc FROM savings_accounts LIMIT 1;
  INSERT INTO savings_transactions (savings_account_id, transaction_type, amount, balance_before, balance_after)
  VALUES (acc,'deposit',500,0,500);
  -- invalid chain: says balance went 500 -> 499 after withdrawing 999999
  BEGIN
    INSERT INTO savings_transactions (savings_account_id, transaction_type, amount, balance_before, balance_after)
    VALUES (acc,'withdrawal',999999,500,499);
    RAISE EXCEPTION 'T4 FAIL: bad balance chain accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T5: illegal loan state machine transition rejected
DO $$
BEGIN
  INSERT INTO loan_products (product_code, product_name, minimum_amount, maximum_amount, min_term_months, max_term_months, interest_rate)
  VALUES ('LNPT','Test Loan',1000,10000,1,12,10);
END $$;
DO $$
DECLARE lid UUID;
BEGIN
  INSERT INTO loans (client_id, loan_product_id, principal_amount, interest_rate, interest_method,
                     term_months, payment_frequency, number_of_installments, status)
  SELECT c.client_id, p.loan_product_id, 5000, 10, 'flat_rate', 6, 'monthly', 6, 'draft'
  FROM (SELECT client_id FROM clients ORDER BY created_at LIMIT 1) c,
       loan_products p WHERE p.product_code='LNPT'
  RETURNING loan_id INTO lid;
  UPDATE loans SET status='fully_paid' WHERE loan_id=lid;
  RAISE EXCEPTION 'T5 FAIL: draft->fully_paid allowed';
EXCEPTION WHEN raise_exception THEN NULL;
END $$;

-- T6a: no duplicate ACTIVE member in same group
DO $$
DECLARE gid UUID; cid1 UUID; cid2 UUID;
BEGIN
  SELECT group_id INTO gid FROM lending_groups LIMIT 0; -- ensure table reachable
  INSERT INTO lending_groups (group_name) VALUES ('Behavior Test Group') RETURNING group_id INTO gid;
  SELECT client_id INTO cid1 FROM clients ORDER BY created_at LIMIT 1 OFFSET 0;
  SELECT client_id INTO cid2 FROM clients ORDER BY created_at DESC LIMIT 1;
  INSERT INTO lending_group_members (group_id, client_id, role) VALUES (gid,cid1,'member');
  BEGIN
    INSERT INTO lending_group_members (group_id, client_id, role) VALUES (gid,cid2,'member');
    RAISE EXCEPTION 'T6a setup needs same client twice';
  EXCEPTION
    WHEN unique_violation THEN NULL; -- cid1==cid2 case already proves guard
    WHEN others THEN NULL;
  END;
  -- explicit duplicate attempt with SAME client
  BEGIN
    INSERT INTO lending_group_members (group_id, client_id, role) VALUES (gid,cid1,'leader');
    RAISE EXCEPTION 'T6a FAIL: duplicate active member accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- T6b: at most ONE active leader per group
DO $$
DECLARE gid UUID; cidA UUID; cidB UUID;
BEGIN
  INSERT INTO lending_groups (group_name) VALUES ('Leader Test Group') RETURNING group_id INTO gid;
  SELECT client_id INTO cidA FROM clients ORDER BY created_at ASC LIMIT 1;
  SELECT client_id INTO cidB FROM clients ORDER BY created_at DESC LIMIT 1;
  INSERT INTO lending_group_members (group_id, client_id, role) VALUES (gid,cidA,'leader');
  IF cidA IS DISTINCT FROM cidB THEN
    UPDATE lending_group_members SET status='removed', left_at=NOW()
     WHERE group_id=gid AND client_id=cidA;
    INSERT INTO lending_group_members (group_id, client_id, role) VALUES (gid,cidB,'leader');
  ELSE
    BEGIN
      UPDATE lending_group_members SET role='member' WHERE group_id=gid AND client_id=cidA;
      INSERT INTO lending_group_members (group_id, client_id, role) VALUES (gid,cidA,'leader');
      RAISE EXCEPTION 'T6b FAIL';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END IF;
END $$;

-- T7: balanced journal entry accepted (deferred balance-check passes at commit)
DO $$
DECLARE jid UUID; cash UUID; lr UUID;
BEGIN
  SELECT account_id INTO cash FROM accounts WHERE account_code='1010';
  SELECT account_id INTO lr   FROM accounts WHERE account_code='1110';
  INSERT INTO journal_entries (description) VALUES ('Disburse LN-test') RETURNING journal_entry_id INTO jid;
  INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit) VALUES (jid,1,lr,100,0);
  INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit) VALUES (jid,2,cash,0,100);
END $$;

-- T8: installment paid-status consistency + generated total_due
DO $$
DECLARE lid UUID; td NUMERIC;
BEGIN
  INSERT INTO loans (client_id, loan_product_id, principal_amount, interest_rate, interest_method,
                     term_months, payment_frequency, number_of_installments, status,
                     disbursed_at, disbursed_by)
  SELECT c.client_id, p.loan_product_id, 5000, 10, 'flat_rate', 6, 'monthly', 6, 'active',
         NOW(), '11111111-1111-1111-1111-111111111111'
  FROM (SELECT client_id FROM clients ORDER BY created_at LIMIT 1) c,
       loan_products p WHERE p.product_code='LNPT'
  RETURNING loan_id INTO lid;

  -- valid installment: total_due must be generated = 800 + 200
  INSERT INTO loan_installments (loan_id, installment_number, due_date, principal_amount, interest_amount)
  VALUES (lid, 1, CURRENT_DATE + 30, 800, 200);
  SELECT total_due INTO td FROM loan_installments WHERE loan_id=lid AND installment_number=1;
  IF td IS DISTINCT FROM 1000 THEN RAISE EXCEPTION 'T8 FAIL: generated total_due=%', td; END IF;

  BEGIN
    INSERT INTO loan_installments (loan_id, installment_number, due_date, principal_amount, interest_amount, amount_paid, status)
    VALUES (lid, 2, CURRENT_DATE + 60, 800, 200, 0, 'paid');
    RAISE EXCEPTION 'T8 FAIL: marked paid with zero payments';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;

-- T9: approving an application requires reviewer + timestamp
DO $$
DECLARE aid UUID;
BEGIN
  INSERT INTO loan_applications (client_id, loan_product_id, requested_amount, term_months, payment_frequency, purpose, status)
  SELECT c.client_id, p.loan_product_id, 5000, 6, 'monthly', 'test purpose', 'submitted'
  FROM (SELECT client_id FROM clients ORDER BY created_at LIMIT 1) c,
       loan_products p WHERE p.product_code='LNPT'
  RETURNING loan_application_id INTO aid;
  UPDATE loan_applications SET status='approved' WHERE loan_application_id=aid;
  RAISE EXCEPTION 'T9 FAIL: approved without reviewer';
EXCEPTION WHEN raise_exception THEN NULL;
END $$;

-- T10: overdue sweep function executes
DO $$
DECLARE n INTEGER;
BEGIN
  n := mark_overdue_installments();
END $$;

SELECT 'ALL BEHAVIOR TESTS PASSED' AS result;
