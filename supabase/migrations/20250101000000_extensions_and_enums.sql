-- ============================================================
-- 0001 — EXTENSIONS, SEQUENCES, ENUM TYPES
-- Target: Supabase PostgreSQL (run FIRST)
-- NOTE: auth.* schema exists only on Supabase projects.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram search on names

-- ------------------------------------------------------------
-- Sequences for human-readable business codes
-- ------------------------------------------------------------
CREATE SEQUENCE seq_client_code         START 1;
CREATE SEQUENCE seq_account_number      START 1;
CREATE SEQUENCE seq_savings_ref         START 1;
CREATE SEQUENCE seq_loan_number         START 1;
CREATE SEQUENCE seq_application_number  START 1;
CREATE SEQUENCE seq_payment_number      START 1;
CREATE SEQUENCE seq_group_code          START 1;
CREATE SEQUENCE seq_fin_txn             START 100001;  -- TXN codes start padded
CREATE SEQUENCE seq_cash_txn            START 1;

-- ------------------------------------------------------------
-- Enum types (extend later with ALTER TYPE ... ADD VALUE)
-- ------------------------------------------------------------
CREATE TYPE user_role            AS ENUM ('admin','manager','loan_officer','teller','client');
CREATE TYPE client_status        AS ENUM ('pending','active','inactive','suspended','closed');
CREATE TYPE client_type          AS ENUM ('individual','business');
CREATE TYPE gender               AS ENUM ('male','female','other');
CREATE TYPE kyc_status           AS ENUM ('pending','verified','rejected','expired');
CREATE TYPE product_status       AS ENUM ('active','inactive');
CREATE TYPE savings_product_type AS ENUM ('regular','special_deposit','time_deposit');
CREATE TYPE posting_frequency    AS ENUM ('none','monthly','quarterly','annually');
CREATE TYPE account_status       AS ENUM ('active','dormant','frozen','closed');
CREATE TYPE savings_txn_type     AS ENUM ('deposit','withdrawal','interest_credit','adjustment','fee');
CREATE TYPE txn_status           AS ENUM ('completed','pending','reversed');
CREATE TYPE loan_type            AS ENUM ('business','personal','agricultural','emergency','educational','other');
CREATE TYPE interest_method      AS ENUM ('flat_rate','reducing_balance');
CREATE TYPE payment_frequency    AS ENUM ('daily','weekly','bi_weekly','semi_monthly','monthly');
CREATE TYPE application_status   AS ENUM ('draft','submitted','under_review','approved','rejected','cancelled');
CREATE TYPE loan_status          AS ENUM ('draft','submitted','under_review','approved','rejected',
                                          'disbursed','active','fully_paid','defaulted','cancelled');
CREATE TYPE installment_status   AS ENUM ('pending','partially_paid','paid','overdue');
CREATE TYPE payment_method       AS ENUM ('cash','bank_transfer','e_wallet','other');
CREATE TYPE group_role           AS ENUM ('leader','member');
CREATE TYPE member_status        AS ENUM ('active','inactive','removed');
CREATE TYPE group_status         AS ENUM ('active','inactive','dissolved');
CREATE TYPE fin_txn_type         AS ENUM ('savings_deposit','savings_withdrawal','interest_credit',
                                          'loan_disbursement','loan_repayment','fee','penalty','adjustment');
CREATE TYPE entry_direction      AS ENUM ('debit','credit');
CREATE TYPE journal_status       AS ENUM ('draft','posted','void');
CREATE TYPE account_type         AS ENUM ('asset','liability','equity','income','expense');
CREATE TYPE normal_balance       AS ENUM ('debit','credit');
CREATE TYPE notification_type    AS ENUM ('kyc_update','loan_update','payment_reminder',
                                          'savings_update','group_update','system');
