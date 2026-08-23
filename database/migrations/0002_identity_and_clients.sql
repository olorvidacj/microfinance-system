-- ============================================================
-- 0002 — PROFILES, CLIENTS, CLIENT KYC
-- Requires: 0001
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES — one row per Supabase Auth user
-- ------------------------------------------------------------
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        user_role NOT NULL DEFAULT 'client',
  client_id   UUID,                       -- FK added after clients exists
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- CLIENTS
-- ------------------------------------------------------------
CREATE TABLE clients (
  client_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_code          TEXT NOT NULL UNIQUE
                       DEFAULT 'CL-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                              LPAD(NEXTVAL('seq_client_code')::TEXT, 5, '0'),
  full_name            TEXT NOT NULL CHECK (LENGTH(TRIM(full_name)) >= 2),
  business_name        TEXT,
  date_of_birth        DATE NOT NULL CHECK (date_of_birth < CURRENT_DATE),
  gender               gender NOT NULL,

  -- Contact
  contact_number       TEXT NOT NULL,
  email                TEXT CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),

  -- Address (Philippine format)
  street_address       TEXT NOT NULL,
  barangay             TEXT,
  city_municipality    TEXT NOT NULL,
  province             TEXT NOT NULL,
  postal_code          TEXT,

  -- Classification
  client_type          client_type NOT NULL DEFAULT 'individual',

  -- Employment / business information
  employment_status    TEXT,
  employer_business_name TEXT,
  occupation           TEXT,
  monthly_income       NUMERIC(14,2) CHECK (monthly_income IS NULL OR monthly_income >= 0),

  -- Emergency contact
  emergency_contact_name     TEXT,
  emergency_contact_phone    TEXT,
  emergency_contact_relation TEXT,

  -- Lifecycle
  status               client_status NOT NULL DEFAULT 'pending',
  registration_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  registered_by        UUID REFERENCES profiles (id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT clients_emergency_required_together CHECK (
    (emergency_contact_name IS NULL AND emergency_contact_phone IS NULL)
    OR (emergency_contact_name IS NOT NULL AND emergency_contact_phone IS NOT NULL)
  )
);

-- Duplicate prevention: case-insensitive unique email
CREATE UNIQUE INDEX uq_clients_email_lower ON clients (LOWER(email)) WHERE email IS NOT NULL;

ALTER TABLE profiles
  ADD CONSTRAINT fk_profiles_client
  FOREIGN KEY (client_id) REFERENCES clients (client_id) ON DELETE SET NULL;

CREATE INDEX idx_clients_status        ON clients (status);
CREATE INDEX idx_clients_full_name_trgm ON clients USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_clients_city          ON clients (city_municipality);

-- ------------------------------------------------------------
-- CLIENT KYC
-- ------------------------------------------------------------
CREATE TABLE client_kyc (
  kyc_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id           UUID NOT NULL REFERENCES clients (client_id) ON DELETE CASCADE,
  id_type             TEXT NOT NULL,
  id_number           TEXT NOT NULL,
  document_url        TEXT NOT NULL,          -- Supabase Storage object path
  verification_status kyc_status NOT NULL DEFAULT 'pending',
  verified_by         UUID REFERENCES profiles (id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  expiry_date         DATE,
  remarks             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT kyc_reject_requires_remarks CHECK (
    verification_status <> 'rejected' OR remarks IS NOT NULL
  ),
  CONSTRAINT kyc_verified_requires_verifier CHECK (
    verification_status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)
  ),
  CONSTRAINT kyc_expiry_after_created CHECK (
    expiry_date IS NULL OR expiry_date > created_at::DATE
  )
);

-- Same government ID cannot be VERIFIED for two different clients (duplicate guard)
CREATE UNIQUE INDEX uq_kyc_verified_id
  ON client_kyc (LOWER(id_type), LOWER(id_number))
  WHERE verification_status = 'verified';

CREATE INDEX idx_kyc_client   ON client_kyc (client_id);
CREATE INDEX idx_kyc_status   ON client_kyc (verification_status);
