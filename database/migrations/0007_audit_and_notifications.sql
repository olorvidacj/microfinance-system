-- ============================================================
-- 0007 — AUDIT TRAIL + NOTIFICATIONS
-- Requires: 0002
-- ============================================================

-- ------------------------------------------------------------
-- AUDIT LOGS (append-only; inserts via backend service role only)
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
  audit_log_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      UUID REFERENCES profiles (id) ON DELETE SET NULL,
  actor_role   TEXT,                          -- snapshot at action time
  action       TEXT NOT NULL,                 -- e.g. 'CLIENT_CREATED', 'KYC_VERIFIED'
  module       TEXT NOT NULL,                 -- 'clients','kyc','savings','loans','groups','financial'
  record_table TEXT,
  record_id    UUID,
  old_values   JSONB,
  new_values   JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_module_record ON audit_logs (module, record_table, record_id);
CREATE INDEX idx_audit_user_time     ON audit_logs (user_id, timestamp DESC);
CREATE INDEX idx_audit_action        ON audit_logs (action);

-- ------------------------------------------------------------
-- NOTIFICATIONS (client self-service portal)
-- ------------------------------------------------------------
CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  type            notification_type NOT NULL DEFAULT 'system',
  reference_table TEXT,
  reference_id    UUID,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT read_needs_timestamp CHECK (NOT is_read OR read_at IS NOT NULL)
);

CREATE INDEX idx_notif_profile ON notifications (profile_id, is_read, created_at DESC);
