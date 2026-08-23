-- ============================================================
-- 0005 — GROUP LENDING (Solidarity Mechanism)
-- Requires: 0004
-- ============================================================

-- ------------------------------------------------------------
-- LENDING GROUPS
-- ------------------------------------------------------------
CREATE TABLE lending_groups (
  group_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_code       TEXT NOT NULL UNIQUE
                   DEFAULT 'GRP-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                          LPAD(NEXTVAL('seq_group_code')::TEXT, 3, '0'),
  group_name       TEXT NOT NULL CHECK (LENGTH(TRIM(group_name)) >= 3),
  formation_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  leader_client_id UUID,                       -- FK added below; nullable until assigned
  status           group_status NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lending_groups
  ADD CONSTRAINT fk_group_leader
  FOREIGN KEY (leader_client_id) REFERENCES clients (client_id) ON DELETE SET NULL;

-- Back-fill loans.group_id now that groups exist
ALTER TABLE loans
  ADD CONSTRAINT fk_loans_group
  FOREIGN KEY (group_id) REFERENCES lending_groups (group_id) ON DELETE SET NULL;

CREATE INDEX idx_groups_status ON lending_groups (status);
CREATE INDEX idx_groups_leader ON lending_groups (leader_client_id);

-- ------------------------------------------------------------
-- LENDING GROUP MEMBERS
-- ------------------------------------------------------------
CREATE TABLE lending_group_members (
  group_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        UUID NOT NULL REFERENCES lending_groups (group_id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients (client_id) ON DELETE RESTRICT,
  role            group_role NOT NULL DEFAULT 'member',
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at         TIMESTAMPTZ,
  status          member_status NOT NULL DEFAULT 'active',

  -- Spec §9: a client may not be duplicated as an ACTIVE member of the same group
  CONSTRAINT uq_active_membership UNIQUE (group_id, client_id, status),
  CONSTRAINT removed_needs_left_at CHECK (status <> 'removed' OR left_at IS NOT NULL)
);

-- Tighter duplicate-active guard as a partial unique index:
CREATE UNIQUE INDEX uq_group_member_active
  ON lending_group_members (group_id, client_id)
  WHERE status = 'active';

-- A group may have at most one ACTIVE leader
CREATE UNIQUE INDEX uq_group_single_leader
  ON lending_group_members (group_id)
  WHERE role = 'leader' AND status = 'active';

CREATE INDEX idx_gm_client ON lending_group_members (client_id);
CREATE INDEX idx_gm_group  ON lending_group_members (group_id) WHERE status = 'active';
