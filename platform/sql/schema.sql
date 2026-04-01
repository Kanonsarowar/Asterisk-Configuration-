-- Telecom IPRN platform — PostgreSQL schema
-- Apply: psql $DATABASE_URL -f schema.sql

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Roles: admin, reseller, client
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  username        VARCHAR(128) NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            VARCHAR(32) NOT NULL CHECK (role IN ('admin', 'reseller', 'client')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users (role);

-- Client org: optional login user; reseller who owns this customer
CREATE TABLE customers (
  id                BIGSERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  user_id           BIGINT REFERENCES users (id) ON DELETE SET NULL,
  reseller_user_id  BIGINT REFERENCES users (id) ON DELETE SET NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_reseller ON customers (reseller_user_id);
CREATE INDEX idx_customers_user ON customers (user_id);

CREATE TABLE suppliers (
  id                BIGSERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  sip_host          VARCHAR(255) NOT NULL,
  sip_username      VARCHAR(255) NOT NULL DEFAULT '',
  sip_password      TEXT NOT NULL DEFAULT '',
  cost_per_minute   NUMERIC(14, 6) NOT NULL DEFAULT 0,
  routing_priority  INT NOT NULL DEFAULT 100,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_priority ON suppliers (routing_priority);

CREATE TABLE ivr (
  id          BIGSERIAL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  audio_file  VARCHAR(512) NOT NULL DEFAULT '',
  language    VARCHAR(16) NOT NULL DEFAULT 'en',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DID inventory (digits only recommended for did)
CREATE TABLE numbers (
  id            BIGSERIAL PRIMARY KEY,
  did           VARCHAR(64) NOT NULL UNIQUE,
  country       VARCHAR(8) NOT NULL DEFAULT '',
  prefix        VARCHAR(64) NOT NULL DEFAULT '',
  supplier_id   BIGINT REFERENCES suppliers (id) ON DELETE SET NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'assigned', 'testing', 'blocked')),
  customer_id   BIGINT REFERENCES customers (id) ON DELETE SET NULL,
  ivr_id        BIGINT REFERENCES ivr (id) ON DELETE SET NULL,
  sell_rate     NUMERIC(14, 6) NOT NULL DEFAULT 0,
  allocation_date TIMESTAMPTZ,
  provisioned_by BIGINT REFERENCES users (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_numbers_status ON numbers (status);
CREATE INDEX idx_numbers_customer ON numbers (customer_id);
CREATE INDEX idx_numbers_supplier ON numbers (supplier_id);
CREATE INDEX idx_numbers_prefix ON numbers (country, prefix);
CREATE INDEX idx_numbers_provisioned ON numbers (provisioned_by);

-- Failover / multi-supplier routing per number (lower priority = tried first)
CREATE TABLE routes (
  id            BIGSERIAL PRIMARY KEY,
  number_id     BIGINT NOT NULL REFERENCES numbers (id) ON DELETE CASCADE,
  supplier_id   BIGINT NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  priority      INT NOT NULL DEFAULT 0,
  UNIQUE (number_id, supplier_id)
);

CREATE INDEX idx_routes_number ON routes (number_id);
CREATE INDEX idx_routes_lookup ON routes (number_id, priority);

CREATE TABLE cdr (
  id                BIGSERIAL PRIMARY KEY,
  call_id           VARCHAR(128),
  caller            VARCHAR(128),
  destination       VARCHAR(128),
  duration_seconds  INT NOT NULL DEFAULT 0,
  cost              NUMERIC(14, 6) NOT NULL DEFAULT 0,
  revenue           NUMERIC(14, 6) NOT NULL DEFAULT 0,
  profit            NUMERIC(14, 6) NOT NULL DEFAULT 0,
  disposition       VARCHAR(64),
  number_id         BIGINT REFERENCES numbers (id) ON DELETE SET NULL,
  customer_id       BIGINT REFERENCES customers (id) ON DELETE SET NULL,
  supplier_id       BIGINT REFERENCES suppliers (id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_cdr_call_id ON cdr (call_id) WHERE call_id IS NOT NULL AND call_id <> '';
CREATE INDEX idx_cdr_created ON cdr (created_at);
CREATE INDEX idx_cdr_destination ON cdr (destination);

CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  action      TEXT NOT NULL,
  user_id     BIGINT REFERENCES users (id) ON DELETE SET NULL,
  meta        JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs (user_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at);

COMMIT;
