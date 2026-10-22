-- ============================================================
-- 0028 - Group lending and the solidarity mechanism
--
-- Requires: 0025 (ledger, loans lifecycle), 0026 (payments), 0027.
--
-- Approach: ONE LOAN PER MEMBER under the group. A group product (lending
-- type GROUP) is applied for by each member; the loan carries group_id. The
-- group never borrows as a whole. See docs/GROUP_LENDING.md.
--
-- 1. solidarity_groups: status codes FORMING / ACTIVE / SUSPENDED /
--    DISSOLVED, meeting frequency, the arrears threshold that blocks new
--    group loans, and an exact solidarity fund balance (a cache of
--    group_fund_transactions). Leader columns become a copy of the LEADER
--    row in group_members.
-- 2. group_members replaces the members jsonb: one row per membership, one
--    active group per member, at most one leader / secretary / treasurer.
--    The jsonb is migrated and then no longer written.
-- 3. loans.group_id; group_loan_consents (the other members' consent, or
--    refusal, recorded per loan before approval).
-- 4. group_meetings and group_attendance.
-- 5. The solidarity fund: group_fund_transactions (ledgered, never
--    deleted), solidarity_covers (a payment the fund made for a member, and
--    what the member has paid back), group_overdue_alerts (each overdue
--    installment alerts the group once), group_collections (batch posting).
-- 6. GL 2040 Group Solidarity Fund Payable. Existing fund balances are
--    carried into the ledger against 3900 Opening Balance Equity.
-- 7. payments may be funded by the solidarity fund (method SOLIDARITY_FUND).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Groups
-- ------------------------------------------------------------

ALTER TABLE solidarity_groups ADD COLUMN IF NOT EXISTS meeting_frequency TEXT NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE solidarity_groups ADD COLUMN IF NOT EXISTS arrears_threshold_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE solidarity_groups ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE solidarity_groups ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE solidarity_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE solidarity_groups ADD COLUMN IF NOT EXISTS dissolved_at TIMESTAMPTZ;

ALTER TABLE solidarity_groups
  ALTER COLUMN solidarity_fund_balance TYPE NUMERIC(14,2) USING round(coalesce(solidarity_fund_balance, 0)::numeric, 2);
UPDATE solidarity_groups SET solidarity_fund_balance = 0 WHERE solidarity_fund_balance IS NULL;
ALTER TABLE solidarity_groups ALTER COLUMN solidarity_fund_balance SET DEFAULT 0;
ALTER TABLE solidarity_groups ALTER COLUMN solidarity_fund_balance SET NOT NULL;

-- A forming group may have no leader yet.
ALTER TABLE solidarity_groups ALTER COLUMN leader_borrower_id DROP NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN leader_name DROP NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN leader_phone DROP NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN members DROP NOT NULL;
ALTER TABLE solidarity_groups ALTER COLUMN members SET DEFAULT '[]'::jsonb;

UPDATE solidarity_groups
   SET status_reason = coalesce(status_reason, format('Status "%s" before 0028 was not recognised; review and reinstate or dissolve.', status))
 WHERE NOT (status ILIKE 'active' OR status ILIKE ANY (ARRAY['forming%', 'pending%', 'new', 'suspend%', 'inactive', 'on hold%', 'dissolv%', 'closed%']))
   AND status NOT IN ('FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED');
UPDATE solidarity_groups
   SET status = CASE
         WHEN status IN ('FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED') THEN status
         WHEN status ILIKE 'active' THEN 'ACTIVE'
         WHEN status ILIKE ANY (ARRAY['forming%', 'pending%', 'new']) THEN 'FORMING'
         WHEN status ILIKE ANY (ARRAY['dissolv%', 'closed%']) THEN 'DISSOLVED'
         ELSE 'SUSPENDED' END;
ALTER TABLE solidarity_groups ALTER COLUMN status SET DEFAULT 'FORMING';
ALTER TABLE solidarity_groups DROP CONSTRAINT IF EXISTS solidarity_groups_valid;
ALTER TABLE solidarity_groups ADD CONSTRAINT solidarity_groups_valid CHECK (
  status IN ('FORMING', 'ACTIVE', 'SUSPENDED', 'DISSOLVED')
  AND meeting_frequency IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')
  AND arrears_threshold_days BETWEEN 0 AND 365
  AND solidarity_fund_balance >= 0
  AND (status <> 'DISSOLVED' OR solidarity_fund_balance = 0)
);
CREATE SEQUENCE IF NOT EXISTS group_code_seq;

-- ------------------------------------------------------------
-- 2. Members
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS group_members (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES solidarity_groups (id) ON DELETE RESTRICT,
  borrower_id  TEXT NOT NULL REFERENCES borrowers (id) ON DELETE RESTRICT,
  role         TEXT NOT NULL DEFAULT 'MEMBER',
  status       TEXT NOT NULL DEFAULT 'ACTIVE',
  joined_at    DATE NOT NULL DEFAULT current_date,
  left_at      DATE,
  left_reason  TEXT,
  added_by     TEXT,
  removed_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT group_members_valid CHECK (
    role IN ('LEADER', 'SECRETARY', 'TREASURER', 'MEMBER')
    AND status IN ('ACTIVE', 'LEFT')
    AND (status = 'ACTIVE' OR left_at IS NOT NULL)
  )
);
-- One active group per member, and one leader / secretary / treasurer per group.
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_members_one_group ON group_members (borrower_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_members_officer ON group_members (group_id, role) WHERE status = 'ACTIVE' AND role <> 'MEMBER';
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id, status);

-- From the jsonb (plus the leader column when the leader is missing from the
-- array). Entries for unknown borrowers are skipped; a member listed in two
-- groups stays in the first; a second leader/secretary/treasurer becomes MEMBER.
WITH raw AS (
  SELECT g.id AS group_id, g.formed_date, g.created_at, m->>'borrowerId' AS borrower_id, lower(coalesce(m->>'role', '')) AS role_text, o.ord
    FROM solidarity_groups g,
         jsonb_array_elements(CASE WHEN jsonb_typeof(g.members) = 'array' THEN g.members ELSE '[]'::jsonb END) WITH ORDINALITY AS o(m, ord)
   WHERE g.status <> 'DISSOLVED'
  UNION ALL
  SELECT g.id, g.formed_date, g.created_at, g.leader_borrower_id, 'leader', 0
    FROM solidarity_groups g
   WHERE g.status <> 'DISSOLVED' AND coalesce(g.leader_borrower_id, '') <> ''
     AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(g.members) = 'array' THEN g.members ELSE '[]'::jsonb END) e
                      WHERE e->>'borrowerId' = g.leader_borrower_id)
),
typed AS (
  SELECT r.*, CASE r.role_text WHEN 'leader' THEN 'LEADER' WHEN 'secretary' THEN 'SECRETARY' WHEN 'treasurer' THEN 'TREASURER' ELSE 'MEMBER' END AS role
    FROM raw r JOIN borrowers b ON b.id = r.borrower_id
),
first_group AS (
  SELECT t.*, row_number() OVER (PARTITION BY t.borrower_id ORDER BY t.created_at NULLS LAST, t.group_id, t.ord) AS bn
    FROM typed t
),
ranked AS (
  SELECT f.*, row_number() OVER (PARTITION BY f.group_id, f.role ORDER BY f.ord) AS rn
    FROM first_group f WHERE f.bn = 1
)
INSERT INTO group_members (id, group_id, borrower_id, role, status, joined_at, added_by)
SELECT 'gm-' || md5(group_id || ':' || borrower_id), group_id, borrower_id,
       CASE WHEN role <> 'MEMBER' AND rn > 1 THEN 'MEMBER' ELSE role END,
       'ACTIVE',
       CASE WHEN formed_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN formed_date::date ELSE current_date END,
       'migration-0028'
  FROM ranked
ON CONFLICT (id) DO NOTHING;

-- Leader columns mirror the LEADER row.
UPDATE solidarity_groups g
   SET leader_borrower_id = b.id, leader_name = b.full_name, leader_phone = b.phone
  FROM group_members m JOIN borrowers b ON b.id = m.borrower_id
 WHERE m.group_id = g.id AND m.status = 'ACTIVE' AND m.role = 'LEADER';
UPDATE solidarity_groups g
   SET leader_borrower_id = NULL, leader_name = NULL, leader_phone = NULL
 WHERE NOT EXISTS (SELECT 1 FROM group_members m WHERE m.group_id = g.id AND m.status = 'ACTIVE' AND m.role = 'LEADER');

-- ------------------------------------------------------------
-- 3. Group loans and consent
-- ------------------------------------------------------------

ALTER TABLE loans ADD COLUMN IF NOT EXISTS group_id TEXT REFERENCES solidarity_groups (id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_loans_group ON loans (group_id) WHERE group_id IS NOT NULL;
UPDATE loans l SET group_id = m.group_id
  FROM group_members m
 WHERE l.group_id IS NULL AND l.lending_type = 'GROUP' AND m.borrower_id = l.borrower_id AND m.status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS group_loan_consents (
  id           TEXT PRIMARY KEY,
  loan_id      TEXT NOT NULL REFERENCES loans (id) ON DELETE RESTRICT,
  group_id     TEXT NOT NULL REFERENCES solidarity_groups (id) ON DELETE RESTRICT,
  borrower_id  TEXT NOT NULL REFERENCES borrowers (id) ON DELETE RESTRICT,
  decision     TEXT NOT NULL,
  channel      TEXT NOT NULL,
  note         TEXT,
  recorded_by  TEXT NOT NULL,
  recorded_by_name TEXT,
  recorded_at  TIMESTAMPTZ NOT NULL,
  CONSTRAINT group_loan_consents_valid CHECK (decision IN ('CONSENT', 'DECLINE') AND channel IN ('MEETING', 'PORTAL')),
  CONSTRAINT uq_group_loan_consent UNIQUE (loan_id, borrower_id)
);

-- ------------------------------------------------------------
-- 4. Meetings and attendance
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS group_meetings (
  id               TEXT PRIMARY KEY,
  group_id         TEXT NOT NULL REFERENCES solidarity_groups (id) ON DELETE RESTRICT,
  meeting_date     DATE NOT NULL,
  location         TEXT,
  notes            TEXT,
  recorded_by      TEXT NOT NULL,
  recorded_by_name TEXT,
  created_at       TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_group_meeting_date UNIQUE (group_id, meeting_date)
);

CREATE TABLE IF NOT EXISTS group_attendance (
  meeting_id   TEXT NOT NULL REFERENCES group_meetings (id) ON DELETE CASCADE,
  borrower_id  TEXT NOT NULL REFERENCES borrowers (id) ON DELETE RESTRICT,
  status       TEXT NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'EXCUSED')),
  note         TEXT,
  PRIMARY KEY (meeting_id, borrower_id)
);

-- ------------------------------------------------------------
-- 5. Solidarity fund
-- ------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS group_fund_txn_seq;
CREATE SEQUENCE IF NOT EXISTS group_cover_seq;
CREATE SEQUENCE IF NOT EXISTS group_collection_seq;

CREATE TABLE IF NOT EXISTS solidarity_covers (
  id               TEXT PRIMARY KEY,
  cover_number     TEXT NOT NULL UNIQUE,
  group_id         TEXT NOT NULL REFERENCES solidarity_groups (id) ON DELETE RESTRICT,
  loan_id          TEXT NOT NULL REFERENCES loans (id) ON DELETE RESTRICT,
  borrower_id      TEXT NOT NULL REFERENCES borrowers (id) ON DELETE RESTRICT,
  payment_id       TEXT NOT NULL REFERENCES payments (id) ON DELETE RESTRICT,
  amount           NUMERIC(14,2) NOT NULL,
  repaid           NUMERIC(14,2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'OUTSTANDING',
  reason           TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  created_by       TEXT NOT NULL,
  created_by_name  TEXT,
  created_at       TIMESTAMPTZ NOT NULL,
  repaid_at        TIMESTAMPTZ,
  CONSTRAINT solidarity_covers_valid CHECK (
    amount > 0 AND repaid >= 0 AND repaid <= amount
    AND status IN ('OUTSTANDING', 'REPAID')
    AND ((status = 'REPAID') = (repaid = amount))
  )
);
CREATE INDEX IF NOT EXISTS idx_solidarity_covers_group ON solidarity_covers (group_id, status);

CREATE TABLE IF NOT EXISTS group_collections (
  id               TEXT PRIMARY KEY,
  collection_number TEXT NOT NULL UNIQUE,
  group_id         TEXT NOT NULL REFERENCES solidarity_groups (id) ON DELETE RESTRICT,
  collection_date  DATE NOT NULL,
  method           TEXT NOT NULL CHECK (method IN ('CASH', 'BANK_TRANSFER', 'E_WALLET')),
  reference        TEXT,
  total            NUMERIC(14,2) NOT NULL CHECK (total > 0),
  lines            JSONB NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  posted_by        TEXT NOT NULL,
  posted_by_name   TEXT,
  created_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS group_fund_transactions (
  id                 TEXT PRIMARY KEY,
  group_id           TEXT NOT NULL REFERENCES solidarity_groups (id) ON DELETE RESTRICT,
  transaction_number TEXT NOT NULL UNIQUE,
  kind               TEXT NOT NULL,
  signed_amount      NUMERIC(14,2) NOT NULL,
  balance_before     NUMERIC(14,2) NOT NULL,
  balance_after      NUMERIC(14,2) NOT NULL,
  borrower_id        TEXT REFERENCES borrowers (id) ON DELETE RESTRICT,
  cover_id           TEXT REFERENCES solidarity_covers (id) ON DELETE RESTRICT,
  collection_id      TEXT REFERENCES group_collections (id) ON DELETE RESTRICT,
  method             TEXT,
  reference          TEXT,
  journal_entry_id   UUID REFERENCES journal_entries (journal_entry_id) ON DELETE RESTRICT,
  idempotency_key    TEXT,
  notes              TEXT,
  entry_date         DATE NOT NULL,
  posted_by          TEXT NOT NULL,
  posted_by_name     TEXT,
  created_at         TIMESTAMPTZ NOT NULL,
  sequence           BIGINT NOT NULL DEFAULT nextval('group_fund_txn_seq'),
  CONSTRAINT group_fund_transactions_valid CHECK (
    kind IN ('OPENING_BALANCE', 'CONTRIBUTION', 'COVER', 'COVER_REPAYMENT', 'REFUND')
    AND signed_amount <> 0
    AND balance_after = balance_before + signed_amount
    AND balance_after >= 0
    AND ((kind IN ('COVER', 'REFUND')) = (signed_amount < 0))
    AND (kind NOT IN ('COVER', 'COVER_REPAYMENT') OR cover_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_fund_idempotency ON group_fund_transactions (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_group_fund_group ON group_fund_transactions (group_id, sequence);

CREATE OR REPLACE FUNCTION group_fund_transactions_no_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Solidarity fund transactions are never deleted; post a correcting transaction instead.' USING ERRCODE = '42501';
END $$;
DROP TRIGGER IF EXISTS trg_group_fund_transactions_no_delete ON group_fund_transactions;
CREATE TRIGGER trg_group_fund_transactions_no_delete BEFORE DELETE ON group_fund_transactions FOR EACH ROW EXECUTE FUNCTION group_fund_transactions_no_delete();

CREATE TABLE IF NOT EXISTS group_overdue_alerts (
  loan_id            TEXT NOT NULL REFERENCES loans (id) ON DELETE RESTRICT,
  installment_number INTEGER NOT NULL,
  group_id           TEXT NOT NULL REFERENCES solidarity_groups (id) ON DELETE RESTRICT,
  alerted_at         TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (loan_id, installment_number)
);

-- ------------------------------------------------------------
-- 6. Ledger: the fund account, and existing balances carried in
-- ------------------------------------------------------------

INSERT INTO accounts (account_code, account_name, account_type, normal_balance) VALUES
  ('2040', 'Group Solidarity Fund Payable', 'liability', 'credit'),
  ('3900', 'Opening Balance Equity', 'equity', 'credit')
ON CONFLICT (account_code) DO NOTHING;

INSERT INTO group_fund_transactions (id, group_id, transaction_number, kind, signed_amount, balance_before, balance_after,
                                     notes, entry_date, posted_by, posted_by_name, created_at)
SELECT 'gft-open-' || g.id, g.id, 'GF-OPEN-' || g.group_code, 'OPENING_BALANCE', g.solidarity_fund_balance, 0, g.solidarity_fund_balance,
       'Solidarity fund balance carried over from before the fund was ledgered.', current_date, 'migration', 'Migration 0028', now()
  FROM solidarity_groups g
 WHERE g.solidarity_fund_balance > 0
   AND NOT EXISTS (SELECT 1 FROM group_fund_transactions t WHERE t.group_id = g.id)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  total NUMERIC;
  entry UUID;
BEGIN
  SELECT coalesce(sum(signed_amount), 0) INTO total FROM group_fund_transactions WHERE kind = 'OPENING_BALANCE' AND journal_entry_id IS NULL;
  IF total > 0 AND NOT EXISTS (SELECT 1 FROM journal_entries WHERE idempotency_key = 'group-fund-opening-0028') THEN
    INSERT INTO journal_entries (entry_date, description, reference_number, source_module, source_ref, posted_by, posted_by_name, idempotency_key, status)
    VALUES (current_date, 'Solidarity fund balances carried into the ledger (0028)', 'MIG-0028', 'group_fund_migration', 'all', 'migration', 'Migration 0028', 'group-fund-opening-0028', 'posted')
    RETURNING journal_entry_id INTO entry;
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, memo)
    SELECT entry, 1, account_id, total, 0, 'Opening balance equity' FROM accounts WHERE account_code = '3900';
    INSERT INTO journal_entry_lines (entry_id, line_number, account_id, debit, credit, memo)
    SELECT entry, 2, account_id, 0, total, 'Solidarity fund balances carried over' FROM accounts WHERE account_code = '2040';
    UPDATE group_fund_transactions SET journal_entry_id = entry WHERE kind = 'OPENING_BALANCE' AND journal_entry_id IS NULL;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 7. Payments funded by the solidarity fund
-- ------------------------------------------------------------

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_split_adds_up;
ALTER TABLE payments ADD CONSTRAINT payments_split_adds_up CHECK (
  allocation IS NULL OR (amount = principal_portion + interest_portion + penalty_portion + excess_amount
                         AND payment_method IN ('CASH', 'BANK_TRANSFER', 'E_WALLET', 'SOLIDARITY_FUND'))
);

-- ------------------------------------------------------------
-- 8. Access: server-side only
-- ------------------------------------------------------------

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_loan_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE solidarity_covers ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_overdue_alerts ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE
  r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE solidarity_groups, group_members, group_loan_consents, group_meetings, group_attendance, solidarity_covers, group_collections, group_fund_transactions, group_overdue_alerts FROM %I', r);
      EXECUTE format('REVOKE ALL ON SEQUENCE group_code_seq, group_fund_txn_seq, group_cover_seq, group_collection_seq FROM %I', r);
    END IF;
  END LOOP;
END
$$;

COMMIT;
