-- ============================================================
-- 0016 - PAYMENT PROOFS (real table for the pending-verification queue)
--        (requires: 0015)
--
-- Idempotent. Safe to re-run. Creates one new table. Inserts
-- nothing, deletes nothing, and changes no existing table.
--
-- Why:
--   A client submitting a loan repayment uploads a receipt. The
--   receipt bytes are already stored in the private kyc-documents
--   bucket and a documents row is written, but a documents row is
--   a generic file record: it carries no amount, no payment
--   method, no payer, and no verification decision, so there is
--   no real queue a teller can work. Until this table exists the
--   approval trail is faked by storing the proof as a document
--   with status 'Pending Verification' and notifying the branch.
--
--   This table is the queue. documents keeps holding the bytes;
--   payment_proofs holds the claim about them.
--
-- Design notes:
--   * No money is moved here. A proof row is a *claim* awaiting
--     verification. It must never be treated as a payment, and it
--     is deliberately NOT FK'd to payments because approving a
--     proof is what creates the payment, not the other way round.
--   * document_id points at the documents row holding the bytes.
--     The legacy schema has no foreign keys on any financial
--     table, so this is a soft reference kept honest by the
--     verification query at the end of this file rather than by
--     a constraint the surrounding schema would not honour.
--   * status is constrained so an unknown state cannot be written.
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_proofs (
  id                text PRIMARY KEY,
  -- the claim
  borrower_id       text        NOT NULL,
  loan_id           text        NOT NULL,
  loan_number       text,
  amount            double precision NOT NULL CHECK (amount > 0),
  currency          text        NOT NULL DEFAULT 'PHP',
  payment_method    text        NOT NULL,
  payment_date      text        NOT NULL,
  reference_number  text,
  notes             text,
  -- the evidence (bytes live in documents, referenced here)
  document_id       text,
  storage_path      text,
  file_name         text,
  -- branch routing
  branch_id         text        NOT NULL,
  submitted_by      text,
  submitted_at      text        NOT NULL,
  -- the decision
  status            text        NOT NULL DEFAULT 'PENDING_REVIEW'
                              CHECK (status IN ('PENDING_REVIEW','UNDER_REVIEW',
                                                'VERIFIED','REJECTED')),
  reviewed_by       text,
  reviewed_by_name  text,
  reviewed_at       text,
  rejection_reason  text,
  -- link to the money, filled in only once a verified payment row exists
  payment_id        text,
  created_at        text        NOT NULL,
  updated_at        text        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_queue
  ON payment_proofs (branch_id, status, submitted_at);

CREATE INDEX IF NOT EXISTS idx_payment_proofs_borrower
  ON payment_proofs (borrower_id, submitted_at);

-- ------------------------------------------------------------
-- RLS - deliberately NOT "USING (true)"
--
-- Context: seven legacy tables (borrowers, loans, payments,
-- savings_accounts, savings_withdrawal_requests, staff, branches)
-- currently carry an "Allow full access ... USING (true)" policy
-- for role public, which makes RLS a no-op. This new table must
-- not repeat that.
--
-- Grants: service_role only, matching the existing pattern on the
-- other sensitive tables. The backend talks to Postgres with the
-- service-role key and enforces branch/ownership checks in
-- application code, so direct client access is not required and is
-- deliberately not granted.
-- ------------------------------------------------------------
ALTER TABLE payment_proofs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON payment_proofs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON payment_proofs TO service_role;

-- Service role bypasses RLS (it is BYPASSRLS), which is the
-- sanctioned write path. These policies exist so that if a grant
-- is ever widened to anon/authenticated, the default is deny
-- rather than allow.
--
-- DROP ... IF EXISTS first: CREATE POLICY has no IF NOT EXISTS
-- form, and this file must be safe to re-run.
DROP POLICY IF EXISTS p_payment_proofs_service_all ON payment_proofs;
CREATE POLICY p_payment_proofs_service_all ON payment_proofs
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Explicit deny-by-default for everyone else: no policy is created
-- for anon/authenticated, so RLS denies them all access even if a
-- table grant is later added by mistake.

-- ------------------------------------------------------------
-- 4) VERIFICATION (read-only; safe to run any time)
-- ------------------------------------------------------------
--   SELECT status, count(*) FROM payment_proofs GROUP BY status;
--   SELECT count(*) AS dangling_document_refs
--     FROM payment_proofs p
--     LEFT JOIN documents d ON d.id = p.document_id
--    WHERE p.document_id IS NOT NULL AND d.id IS NULL;   -- expect 0
