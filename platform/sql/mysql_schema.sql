-- IPRN Telecom Platform — MySQL 8.x production schema
-- Charset: utf8mb4 for international numbering / metadata
-- Apply: mysql -u user -p database < mysql_schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS invoice_lines;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS cdr;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS numbers;
DROP TABLE IF EXISTS ivr;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS user_permissions;
DROP TABLE IF EXISTS config_versions;
DROP TABLE IF EXISTS live_calls;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(128) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            ENUM('admin','reseller','user') NOT NULL DEFAULT 'user',
  balance         DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  billing_currency CHAR(3) NOT NULL DEFAULT 'USD',
  status          ENUM('active','suspended') NOT NULL DEFAULT 'active',
  parent_user_id  BIGINT UNSIGNED NULL,
  permissions_json JSON NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_role (role),
  KEY idx_users_parent (parent_user_id),
  KEY idx_users_status (status),
  KEY idx_users_currency (billing_currency),
  CONSTRAINT fk_users_parent FOREIGN KEY (parent_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE user_permissions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id     BIGINT UNSIGNED NOT NULL,
  perm        VARCHAR(64) NOT NULL,
  created_at  DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_user_perm (user_id, perm),
  KEY idx_user_permissions_user (user_id),
  CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE customers (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  company       VARCHAR(255) NULL,
  contact_info  JSON NULL,
  user_id       BIGINT UNSIGNED NULL,
  reseller_user_id BIGINT UNSIGNED NULL,
  status        ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at    DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_customers_reseller (reseller_user_id),
  KEY idx_customers_user (user_id),
  CONSTRAINT fk_customers_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_reseller FOREIGN KEY (reseller_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE suppliers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  host            VARCHAR(255) NOT NULL,
  port            INT UNSIGNED NOT NULL DEFAULT 5060,
  username        VARCHAR(255) NOT NULL DEFAULT '',
  password        VARCHAR(512) NOT NULL DEFAULT '',
  protocol        ENUM('sip','pjsip') NOT NULL DEFAULT 'pjsip',
  active          TINYINT(1) NOT NULL DEFAULT 1,
  cost_per_minute DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  routing_priority INT NOT NULL DEFAULT 100,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_suppliers_active (active),
  KEY idx_suppliers_priority (routing_priority)
) ENGINE=InnoDB;

CREATE TABLE ivr (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  audio_file  VARCHAR(512) NOT NULL DEFAULT '',
  language    VARCHAR(16) NOT NULL DEFAULT 'en',
  created_at  DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3))
) ENGINE=InnoDB;

-- DID inventory: prefix + inclusive numeric range (full digits, no +); optional legacy single `did`
CREATE TABLE numbers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  did             VARCHAR(64) NULL,
  prefix          VARCHAR(32) NOT NULL DEFAULT '',
  range_start     VARCHAR(32) NOT NULL,
  range_end       VARCHAR(32) NOT NULL,
  country         VARCHAR(8) NOT NULL DEFAULT '',
  supplier_id     BIGINT UNSIGNED NULL,
  customer_id     BIGINT UNSIGNED NULL,
  ivr_id          BIGINT UNSIGNED NULL,
  rate_per_min    DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  type            ENUM('premium','non-premium') NOT NULL DEFAULT 'non-premium',
  status          ENUM('available','assigned','testing','blocked') NOT NULL DEFAULT 'available',
  provisioned_by  BIGINT UNSIGNED NULL,
  allocation_date DATETIME(3) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_numbers_did (did),
  KEY idx_numbers_prefix (prefix),
  KEY idx_numbers_range (range_start, range_end),
  KEY idx_numbers_status (status),
  KEY idx_numbers_customer (customer_id),
  KEY idx_numbers_supplier (supplier_id),
  KEY idx_numbers_provisioned (provisioned_by),
  CONSTRAINT fk_numbers_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
  CONSTRAINT fk_numbers_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_numbers_ivr FOREIGN KEY (ivr_id) REFERENCES ivr (id) ON DELETE SET NULL,
  CONSTRAINT fk_numbers_provisioned FOREIGN KEY (provisioned_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Prefix-based carrier routing (failover by priority; rate used for LCR when mode=lcr)
CREATE TABLE routes (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  prefix        VARCHAR(32) NOT NULL,
  supplier_id   BIGINT UNSIGNED NOT NULL,
  priority      INT NOT NULL DEFAULT 0,
  rate          DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  active        TINYINT(1) NOT NULL DEFAULT 1,
  allowed_cli_regex VARCHAR(512) NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_routes_prefix_active (prefix, active, priority),
  KEY idx_routes_supplier (supplier_id),
  CONSTRAINT fk_routes_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE cdr (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  call_id           VARCHAR(128) NULL,
  uniqueid          VARCHAR(128) NULL,
  cli               VARCHAR(128) NULL,
  destination       VARCHAR(128) NULL,
  start_time        DATETIME(3) NULL,
  answer_time       DATETIME(3) NULL,
  end_time          DATETIME(3) NULL,
  duration          INT UNSIGNED NOT NULL DEFAULT 0,
  billed_duration   INT UNSIGNED NOT NULL DEFAULT 0,
  disposition       VARCHAR(64) NULL,
  cost              DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  revenue           DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  profit            DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  billing_currency  CHAR(3) NULL DEFAULT NULL,
  user_rate_per_min DECIMAL(18,6) NULL DEFAULT NULL,
  supplier_rate_per_min DECIMAL(18,6) NULL DEFAULT NULL,
  financials_applied_at DATETIME(3) NULL DEFAULT NULL,
  supplier_id       BIGINT UNSIGNED NULL,
  user_id           BIGINT UNSIGNED NULL,
  customer_id       BIGINT UNSIGNED NULL,
  number_id         BIGINT UNSIGNED NULL,
  matched_prefix    VARCHAR(32) NULL,
  created_at        DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_cdr_call_id (call_id),
  KEY idx_cdr_created (created_at),
  KEY idx_cdr_destination (destination),
  KEY idx_cdr_user (user_id),
  KEY idx_cdr_supplier (supplier_id),
  KEY idx_cdr_customer (customer_id),
  UNIQUE KEY uq_cdr_uniqueid (uniqueid),
  KEY idx_cdr_financials_pending (financials_applied_at, created_at),
  CONSTRAINT fk_cdr_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE SET NULL,
  CONSTRAINT fk_cdr_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_cdr_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_cdr_number FOREIGN KEY (number_id) REFERENCES numbers (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE invoices (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED NOT NULL,
  total_amount  DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  currency      CHAR(3) NOT NULL DEFAULT 'USD',
  status        ENUM('draft','issued','paid','void') NOT NULL DEFAULT 'draft',
  period_start  DATE NULL,
  period_end    DATE NULL,
  summary_json  JSON NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_invoices_user (user_id),
  KEY idx_invoices_status (status),
  CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE invoice_lines (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  invoice_id    BIGINT UNSIGNED NOT NULL,
  cdr_id        BIGINT UNSIGNED NULL,
  description   VARCHAR(512) NOT NULL DEFAULT '',
  amount        DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  KEY idx_invoice_lines_invoice (invoice_id),
  CONSTRAINT fk_invoice_lines_invoice FOREIGN KEY (invoice_id) REFERENCES invoices (id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_lines_cdr FOREIGN KEY (cdr_id) REFERENCES cdr (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  action      VARCHAR(255) NOT NULL,
  user_id     BIGINT UNSIGNED NULL,
  timestamp   DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  metadata    JSON NULL,
  KEY idx_audit_user (user_id),
  KEY idx_audit_ts (timestamp),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE system_settings (
  skey    VARCHAR(128) NOT NULL PRIMARY KEY,
  svalue  JSON NOT NULL
) ENGINE=InnoDB;

INSERT INTO system_settings (skey, svalue) VALUES
  ('billing', JSON_OBJECT(
    'minimum_bill_seconds', 30,
    'increment_seconds', 6,
    'routing_mode', 'priority',
    'default_prefix_length', 5,
    'max_cps_global', 50,
    'lcr_tie_break', 'priority_then_supplier_id',
    'default_billing_currency', 'USD',
    'currencies', JSON_OBJECT(
      'USD', JSON_OBJECT('decimals', 6, 'name', 'US Dollar'),
      'EUR', JSON_OBJECT('decimals', 6, 'name', 'Euro'),
      'GBP', JSON_OBJECT('decimals', 6, 'name', 'Pound Sterling')
    )
  )),
  ('fraud', JSON_OBJECT(
    'enabled', TRUE,
    'max_calls_per_cli_per_hour', 120,
    'suspicious_short_ratio_threshold', 0.85,
    'max_calls_per_user_per_minute', 120,
    'max_unique_destinations_per_user_per_minute', 40,
    'block_empty_cli', TRUE,
    'cli_min_digits', 6,
    'cli_blocked_regexes', JSON_ARRAY('^0{6,}$', '^1{6,}$'),
    'block_repeated_digit_cli', TRUE,
    'strict_cli_on_premium', TRUE,
    'premium_cli_extra_regexes', JSON_ARRAY()
  ))
ON DUPLICATE KEY UPDATE skey = skey;

CREATE TABLE config_versions (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  version_tag   VARCHAR(64) NOT NULL,
  files_json    JSON NOT NULL,
  checksum      CHAR(64) NOT NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  created_by    BIGINT UNSIGNED NULL,
  applied_at    DATETIME(3) NULL,
  KEY idx_config_versions_created (created_at),
  CONSTRAINT fk_config_versions_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE live_calls (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  uniqueid      VARCHAR(128) NOT NULL,
  linkedid      VARCHAR(128) NULL,
  channel       VARCHAR(512) NULL,
  dialplan_context VARCHAR(256) NULL,
  exten         VARCHAR(64) NULL,
  accountcode   VARCHAR(64) NULL,
  cli           VARCHAR(128) NULL,
  destination   VARCHAR(128) NULL,
  direction     ENUM('inbound','outbound','unknown') NOT NULL DEFAULT 'unknown',
  state         VARCHAR(64) NULL,
  started_at    DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  last_seen_at  DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_live_uniqueid (uniqueid),
  KEY idx_live_dest (destination),
  KEY idx_live_linkedid (linkedid)
) ENGINE=InnoDB;
