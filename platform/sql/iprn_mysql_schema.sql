-- =============================================================================
-- IPRN (International Premium Rate Number) platform — MySQL 8.0+ schema
-- Engine: InnoDB, utf8mb4. Apply: mysql -u root -p < iprn_mysql_schema.sql
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS iprn_platform
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE iprn_platform;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username      VARCHAR(128) NOT NULL,
  password_hash VARCHAR(255) NOT NULL COMMENT 'bcrypt/argon2 hash; never store plaintext',
  role          ENUM('admin', 'reseller', 'user') NOT NULL DEFAULT 'user',
  balance       DECIMAL(18, 6) NOT NULL DEFAULT 0.000000 COMMENT 'prepay balance in billing currency',
  status        ENUM('active', 'suspended', 'closed') NOT NULL DEFAULT 'active',
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_username (username),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Platform operators, resellers, and end users';

-- -----------------------------------------------------------------------------
-- customers (B2B accounts; not necessarily 1:1 with users)
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(255) NOT NULL,
  company      VARCHAR(255) NULL,
  contact_info JSON NULL COMMENT 'e.g. email, phone, billing address',
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_customers_company (company(64)),
  KEY idx_customers_name (name(64))
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- suppliers (SIP/PJSIP termination / origination peers)
-- -----------------------------------------------------------------------------
CREATE TABLE suppliers (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(255) NOT NULL,
  host       VARCHAR(255) NOT NULL,
  port       SMALLINT UNSIGNED NOT NULL DEFAULT 5060,
  username   VARCHAR(255) NOT NULL DEFAULT '',
  password   VARBINARY(512) NOT NULL DEFAULT '' COMMENT 'encrypted secret or KDF output; app decrypts',
  protocol   ENUM('sip', 'pjsip') NOT NULL DEFAULT 'pjsip',
  active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_suppliers_active (active),
  KEY idx_suppliers_host_port (host(64), port)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- numbers (inventory / rate card; prefix + optional numeric range)
-- prefix_len supports longest-prefix match without FUNCTION-based indexes
-- -----------------------------------------------------------------------------
CREATE TABLE numbers (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prefix        VARCHAR(32) NOT NULL COMMENT 'E.164 digits without +, e.g. 447700900',
  prefix_len    TINYINT UNSIGNED GENERATED ALWAYS AS (CHAR_LENGTH(prefix)) STORED,
  -- 0,0 = whole-prefix row (no sub-range). Non-zero = inclusive DID suffix range within prefix.
  range_start   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  range_end     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  country       CHAR(2) NOT NULL COMMENT 'ISO 3166-1 alpha-2',
  supplier_id   BIGINT UNSIGNED NULL,
  rate_per_min  DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
  type          ENUM('premium', 'non-premium') NOT NULL DEFAULT 'premium',
  status        ENUM('active', 'inactive', 'quarantine', 'retired') NOT NULL DEFAULT 'active',
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_numbers_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_numbers_range
    CHECK (
      (range_start = 0 AND range_end = 0)
      OR (range_start > 0 AND range_end >= range_start)
    ),
  UNIQUE KEY uk_numbers_prefix_range (prefix, range_start, range_end),
  KEY idx_numbers_prefix (prefix),
  KEY idx_numbers_prefix_len (prefix_len DESC, prefix),
  KEY idx_numbers_country_status (country, status),
  KEY idx_numbers_supplier (supplier_id),
  KEY idx_numbers_range_lookup (prefix, range_start, range_end)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- routes (multi-supplier outbound / failover by prefix)
-- -----------------------------------------------------------------------------
CREATE TABLE routes (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  prefix      VARCHAR(32) NOT NULL,
  prefix_len  TINYINT UNSIGNED GENERATED ALWAYS AS (CHAR_LENGTH(prefix)) STORED,
  supplier_id BIGINT UNSIGNED NOT NULL,
  priority    INT NOT NULL DEFAULT 100 COMMENT 'lower = higher precedence',
  rate        DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000 COMMENT 'cost or override for this leg',
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_routes_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uk_routes_prefix_supplier_prio (prefix, supplier_id, priority),
  KEY idx_routes_prefix_active_prio (prefix, active, priority),
  KEY idx_routes_prefix_len (prefix_len DESC, prefix, active),
  KEY idx_routes_supplier (supplier_id)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- cdr (high volume; time indexes + optional monthly RANGE partition after FK drop)
-- -----------------------------------------------------------------------------
CREATE TABLE cdr (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  call_id         VARCHAR(128) NOT NULL COMMENT 'Asterisk Linkedid or unique channel id',
  cli             VARCHAR(64) NULL COMMENT 'calling party number',
  destination     VARCHAR(64) NOT NULL,
  start_time      DATETIME(3) NOT NULL,
  answer_time     DATETIME(3) NULL,
  end_time        DATETIME(3) NULL,
  duration        INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'connected seconds (or total if no answer)',
  billed_duration INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'billable seconds after rounding rules',
  cost            DECIMAL(18, 8) NOT NULL DEFAULT 0.00000000,
  supplier_id     BIGINT UNSIGNED NULL,
  user_id         BIGINT UNSIGNED NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uk_cdr_call_id (call_id),
  CONSTRAINT fk_cdr_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_cdr_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_cdr_start_time (start_time),
  KEY idx_cdr_user_start (user_id, start_time),
  KEY idx_cdr_supplier_start (supplier_id, start_time),
  KEY idx_cdr_destination (destination),
  KEY idx_cdr_cli (cli)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='High-volume CDR; InnoDB does not support FKs on partitioned tables—use archive job or replica analytics DB at extreme scale';

-- Optional monthly partitions (MySQL): drop FKs on cdr first, then:
-- ALTER TABLE cdr DROP FOREIGN KEY fk_cdr_supplier, DROP FOREIGN KEY fk_cdr_user;
-- ALTER TABLE cdr PARTITION BY RANGE (TO_DAYS(start_time)) (...);

-- -----------------------------------------------------------------------------
-- invoices
-- -----------------------------------------------------------------------------
CREATE TABLE invoices (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  total_amount DECIMAL(18, 6) NOT NULL DEFAULT 0.000000,
  status       ENUM('draft', 'issued', 'paid', 'void', 'overdue') NOT NULL DEFAULT 'draft',
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT fk_invoices_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY idx_invoices_user_created (user_id, created_at),
  KEY idx_invoices_status_created (status, created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  action     VARCHAR(128) NOT NULL,
  user_id    BIGINT UNSIGNED NULL,
  timestamp  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  metadata   JSON NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_audit_timestamp (timestamp),
  KEY idx_audit_user_time (user_id, timestamp),
  KEY idx_audit_action (action)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Optional: event table for near real-time CDR fan-out (outbox pattern)
-- =============================================================================
-- CREATE TABLE cdr_events (
--   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
--   cdr_id BIGINT UNSIGNED NOT NULL,
--   cdr_start_time DATETIME(3) NOT NULL,
--   processed_at DATETIME(3) NULL,
--   PRIMARY KEY (id),
--   KEY idx_cdr_events_pending (processed_at)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
