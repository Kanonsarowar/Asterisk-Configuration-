-- =============================================================================
-- IPRN Telecom Platform — Production MySQL 8 Schema
-- Wholesale inbound DID routing, multi-tenant billing, fraud detection
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- ----- USERS (admin / reseller / client portal logins) -----
CREATE TABLE IF NOT EXISTS users (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(128)    NOT NULL,
  email           VARCHAR(255)    NULL,
  password_hash   VARCHAR(255)    NOT NULL,
  role            ENUM('superadmin','admin','reseller','client') NOT NULL DEFAULT 'client',
  status          ENUM('active','suspended','pending') NOT NULL DEFAULT 'pending',
  parent_id       BIGINT UNSIGNED NULL,
  last_login_at   DATETIME(3)     NULL,
  last_login_ip   VARCHAR(45)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_status (status),
  KEY idx_users_parent (parent_id),
  CONSTRAINT fk_users_parent FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----- CLIENTS (business entity linked to user login) -----
CREATE TABLE IF NOT EXISTS clients (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NOT NULL,
  company_name    VARCHAR(255)    NOT NULL,
  contact_name    VARCHAR(255)    NULL,
  contact_email   VARCHAR(255)    NULL,
  contact_phone   VARCHAR(64)     NULL,
  address         TEXT            NULL,
  tax_id          VARCHAR(64)     NULL,
  billing_type    ENUM('prepaid','postpaid') NOT NULL DEFAULT 'prepaid',
  credit_limit    DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  balance         DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
  rate_card_id    BIGINT UNSIGNED NULL,
  status          ENUM('active','suspended','terminated') NOT NULL DEFAULT 'active',
  notes           TEXT            NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_clients_user (user_id),
  KEY idx_clients_status (status),
  KEY idx_clients_billing (billing_type),
  CONSTRAINT fk_clients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- PROVIDERS (upstream carriers delivering inbound traffic) -----
CREATE TABLE IF NOT EXISTS providers (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255)    NOT NULL,
  host            VARCHAR(255)    NOT NULL,
  port            INT UNSIGNED    NOT NULL DEFAULT 5060,
  transport       ENUM('udp','tcp','tls') NOT NULL DEFAULT 'udp',
  auth_type       ENUM('ip','registration') NOT NULL DEFAULT 'ip',
  auth_user       VARCHAR(255)    NOT NULL DEFAULT '',
  auth_password   VARCHAR(512)    NOT NULL DEFAULT '',
  allowed_ips     JSON            NULL COMMENT '["1.2.3.4","5.6.7.0/24"]',
  codecs          VARCHAR(255)    NOT NULL DEFAULT 'g729,alaw,ulaw',
  max_channels    INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '0 = unlimited',
  max_cps         INT UNSIGNED    NOT NULL DEFAULT 0 COMMENT '0 = unlimited',
  cost_per_minute DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  connection_fee  DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  tech_prefix     VARCHAR(16)     NOT NULL DEFAULT '',
  quality_score   DECIMAL(5,2)    NOT NULL DEFAULT 100.00 COMMENT 'ASR-based 0-100',
  status          ENUM('active','disabled','testing') NOT NULL DEFAULT 'active',
  notes           TEXT            NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_providers_status (status),
  KEY idx_providers_host (host)
) ENGINE=InnoDB;

-- ----- SIP ACCOUNTS (customer SIP registrations) -----
CREATE TABLE IF NOT EXISTS sip_accounts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id       BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(128)    NOT NULL,
  username        VARCHAR(128)    NOT NULL,
  password        VARCHAR(512)    NOT NULL,
  allowed_ips     JSON            NULL,
  codecs          VARCHAR(255)    NOT NULL DEFAULT 'g729,alaw,ulaw',
  max_channels    INT UNSIGNED    NOT NULL DEFAULT 2,
  transport       ENUM('udp','tcp','tls') NOT NULL DEFAULT 'udp',
  context         VARCHAR(64)     NOT NULL DEFAULT 'from-client',
  nat             TINYINT(1)      NOT NULL DEFAULT 1,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_registered DATETIME(3)     NULL,
  register_ip     VARCHAR(45)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_sip_username (username),
  KEY idx_sip_client (client_id),
  KEY idx_sip_status (status),
  CONSTRAINT fk_sip_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- RATE CARDS (pricing tables applied to clients or providers) -----
CREATE TABLE IF NOT EXISTS rate_cards (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255)    NOT NULL,
  card_type       ENUM('sell','buy') NOT NULL DEFAULT 'sell',
  currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
  effective_date  DATE            NOT NULL,
  expiry_date     DATE            NULL,
  status          ENUM('active','draft','expired') NOT NULL DEFAULT 'draft',
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_rc_type_status (card_type, status),
  KEY idx_rc_effective (effective_date),
  CONSTRAINT fk_rc_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rate_card_entries (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rate_card_id    BIGINT UNSIGNED NOT NULL,
  prefix          VARCHAR(32)     NOT NULL,
  destination     VARCHAR(255)    NOT NULL DEFAULT '',
  rate_per_minute DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  connection_fee  DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  min_duration    INT UNSIGNED    NOT NULL DEFAULT 0,
  increment       INT UNSIGNED    NOT NULL DEFAULT 1,
  KEY idx_rce_card_prefix (rate_card_id, prefix),
  CONSTRAINT fk_rce_card FOREIGN KEY (rate_card_id) REFERENCES rate_cards(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- FK for clients.rate_card_id after rate_cards exists
ALTER TABLE clients ADD CONSTRAINT fk_clients_rate_card
  FOREIGN KEY (rate_card_id) REFERENCES rate_cards(id) ON DELETE SET NULL;

-- ----- DID INVENTORY (core inbound number pool) -----
CREATE TABLE IF NOT EXISTS did_inventory (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  did_number      VARCHAR(64)     NOT NULL COMMENT 'E.164 digits, no +',
  provider_id     BIGINT UNSIGNED NULL,
  client_id       BIGINT UNSIGNED NULL,
  country_code    VARCHAR(8)      NOT NULL DEFAULT '',
  city            VARCHAR(255)    NOT NULL DEFAULT '',
  did_type        ENUM('local','tollfree','premium','mobile') NOT NULL DEFAULT 'local',
  status          ENUM('available','assigned','reserved','porting','blocked') NOT NULL DEFAULT 'available',
  billing_type    ENUM('prepaid','postpaid') NOT NULL DEFAULT 'prepaid',
  rate_per_minute DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  monthly_cost    DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  monthly_price   DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  setup_fee       DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  route_type      ENUM('sip_endpoint','ivr','queue','voicemail','failover','time_condition') NULL,
  route_target    VARCHAR(512)    NULL,
  failover_target VARCHAR(512)    NULL,
  ivr_id          BIGINT UNSIGNED NULL,
  recording       TINYINT(1)      NOT NULL DEFAULT 0,
  assigned_at     DATETIME(3)     NULL,
  notes           TEXT            NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_did_number (did_number),
  KEY idx_did_provider (provider_id),
  KEY idx_did_client (client_id),
  KEY idx_did_status (status),
  KEY idx_did_country (country_code),
  KEY idx_did_route (route_type),
  CONSTRAINT fk_did_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
  CONSTRAINT fk_did_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----- IVR MENUS -----
CREATE TABLE IF NOT EXISTS ivr_menus (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id       BIGINT UNSIGNED NULL,
  name            VARCHAR(255)    NOT NULL,
  welcome_file    VARCHAR(512)    NOT NULL DEFAULT '',
  timeout         INT UNSIGNED    NOT NULL DEFAULT 10,
  max_retries     INT UNSIGNED    NOT NULL DEFAULT 3,
  invalid_file    VARCHAR(512)    NOT NULL DEFAULT '',
  timeout_target  VARCHAR(512)    NULL,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_ivr_client (client_id),
  CONSTRAINT fk_ivr_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ivr_options (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ivr_id          BIGINT UNSIGNED NOT NULL,
  digit           CHAR(1)         NOT NULL,
  route_type      ENUM('sip_endpoint','ivr','queue','voicemail','hangup') NOT NULL DEFAULT 'sip_endpoint',
  route_target    VARCHAR(512)    NOT NULL,
  UNIQUE KEY uq_ivr_digit (ivr_id, digit),
  CONSTRAINT fk_ivr_opt_menu FOREIGN KEY (ivr_id) REFERENCES ivr_menus(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- FK for did_inventory.ivr_id
ALTER TABLE did_inventory ADD CONSTRAINT fk_did_ivr
  FOREIGN KEY (ivr_id) REFERENCES ivr_menus(id) ON DELETE SET NULL;

-- ----- ROUTES (prefix-based carrier routing with failover) -----
CREATE TABLE IF NOT EXISTS routes (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prefix          VARCHAR(32)     NOT NULL,
  provider_id     BIGINT UNSIGNED NOT NULL,
  priority        INT             NOT NULL DEFAULT 0 COMMENT 'lower = preferred',
  weight          INT UNSIGNED    NOT NULL DEFAULT 100 COMMENT 'for weighted distribution',
  rate            DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  min_asr         DECIMAL(5,2)    NOT NULL DEFAULT 0.00 COMMENT 'minimum ASR to stay active',
  min_acd         DECIMAL(8,2)    NOT NULL DEFAULT 0.00,
  margin_min      DECIMAL(18,6)   NOT NULL DEFAULT 0.000000 COMMENT 'minimum profit margin',
  active          TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_routes_prefix (prefix, active, priority),
  KEY idx_routes_provider (provider_id),
  CONSTRAINT fk_routes_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- CDR (call detail records with full financial data) -----
CREATE TABLE IF NOT EXISTS cdr (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uniqueid        VARCHAR(128)    NOT NULL,
  call_id         VARCHAR(128)    NULL,
  src             VARCHAR(128)    NULL,
  dst             VARCHAR(128)    NULL,
  did_number      VARCHAR(64)     NULL,
  provider_id     BIGINT UNSIGNED NULL,
  client_id       BIGINT UNSIGNED NULL,
  sip_account_id  BIGINT UNSIGNED NULL,
  start_time      DATETIME(3)     NULL,
  answer_time     DATETIME(3)     NULL,
  end_time        DATETIME(3)     NULL,
  duration        INT UNSIGNED    NOT NULL DEFAULT 0,
  billed_duration INT UNSIGNED    NOT NULL DEFAULT 0,
  disposition     VARCHAR(64)     NULL,
  hangup_cause    INT UNSIGNED    NULL,
  cost            DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  revenue         DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  profit          DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  connection_fee  DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  rate_per_min    DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  matched_prefix  VARCHAR(32)     NULL,
  carrier_ip      VARCHAR(45)     NULL,
  sip_code        VARCHAR(8)      NULL,
  recording_file  VARCHAR(512)    NULL,
  billed          TINYINT(1)      NOT NULL DEFAULT 0,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_cdr_uniqueid (uniqueid),
  KEY idx_cdr_created (created_at),
  KEY idx_cdr_dst (dst),
  KEY idx_cdr_did (did_number),
  KEY idx_cdr_client (client_id),
  KEY idx_cdr_provider (provider_id),
  KEY idx_cdr_billed (billed, created_at),
  KEY idx_cdr_disposition (disposition, created_at),
  CONSTRAINT fk_cdr_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
  CONSTRAINT fk_cdr_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_cdr_sip FOREIGN KEY (sip_account_id) REFERENCES sip_accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----- LIVE CALLS (real-time active call tracking) -----
CREATE TABLE IF NOT EXISTS live_calls (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uniqueid        VARCHAR(128)    NOT NULL,
  channel         VARCHAR(512)    NULL,
  src             VARCHAR(128)    NULL,
  dst             VARCHAR(128)    NULL,
  did_number      VARCHAR(64)     NULL,
  provider_id     BIGINT UNSIGNED NULL,
  client_id       BIGINT UNSIGNED NULL,
  state           ENUM('ringing','answered','bridged') NOT NULL DEFAULT 'ringing',
  started_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  answered_at     DATETIME(3)     NULL,
  UNIQUE KEY uq_live_uniqueid (uniqueid),
  KEY idx_live_client (client_id),
  KEY idx_live_provider (provider_id),
  KEY idx_live_started (started_at)
) ENGINE=InnoDB;

-- ----- INVOICES -----
CREATE TABLE IF NOT EXISTS invoices (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id       BIGINT UNSIGNED NOT NULL,
  invoice_number  VARCHAR(64)     NOT NULL,
  total_amount    DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  tax_amount      DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
  status          ENUM('draft','issued','paid','overdue','void') NOT NULL DEFAULT 'draft',
  period_start    DATE            NOT NULL,
  period_end      DATE            NOT NULL,
  due_date        DATE            NULL,
  notes           TEXT            NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_invoice_number (invoice_number),
  KEY idx_invoices_client (client_id),
  KEY idx_invoices_status (status),
  KEY idx_invoices_period (period_start, period_end),
  CONSTRAINT fk_invoices_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS invoice_lines (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id      BIGINT UNSIGNED NOT NULL,
  description     VARCHAR(512)    NOT NULL DEFAULT '',
  quantity        DECIMAL(18,6)   NOT NULL DEFAULT 0,
  unit_price      DECIMAL(18,6)   NOT NULL DEFAULT 0,
  amount          DECIMAL(18,6)   NOT NULL DEFAULT 0.000000,
  line_type       ENUM('usage','did_rental','setup','adjustment','credit') NOT NULL DEFAULT 'usage',
  KEY idx_il_invoice (invoice_id),
  CONSTRAINT fk_il_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- PAYMENTS -----
CREATE TABLE IF NOT EXISTS payments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id       BIGINT UNSIGNED NOT NULL,
  amount          DECIMAL(18,6)   NOT NULL,
  currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
  method          ENUM('wire','credit_card','paypal','crypto','manual','credit') NOT NULL DEFAULT 'manual',
  reference       VARCHAR(255)    NULL,
  invoice_id      BIGINT UNSIGNED NULL,
  status          ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  processed_by    BIGINT UNSIGNED NULL,
  notes           TEXT            NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_payments_client (client_id),
  KEY idx_payments_status (status),
  KEY idx_payments_created (created_at),
  CONSTRAINT fk_payments_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_processor FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----- TICKETS (support) -----
CREATE TABLE IF NOT EXISTS tickets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id       BIGINT UNSIGNED NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  subject         VARCHAR(255)    NOT NULL,
  body            TEXT            NOT NULL,
  priority        ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  status          ENUM('open','in_progress','waiting','resolved','closed') NOT NULL DEFAULT 'open',
  assigned_to     BIGINT UNSIGNED NULL,
  resolved_at     DATETIME(3)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_tickets_client (client_id),
  KEY idx_tickets_status (status),
  KEY idx_tickets_priority (priority),
  CONSTRAINT fk_tickets_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_tickets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tickets_assignee FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id       BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NOT NULL,
  body            TEXT            NOT NULL,
  is_internal     TINYINT(1)      NOT NULL DEFAULT 0,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_tm_ticket (ticket_id),
  CONSTRAINT fk_tm_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  CONSTRAINT fk_tm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----- AUDIT LOGS -----
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         BIGINT UNSIGNED NULL,
  action          VARCHAR(255)    NOT NULL,
  entity_type     VARCHAR(64)     NULL,
  entity_id       BIGINT UNSIGNED NULL,
  ip_address      VARCHAR(45)     NULL,
  old_values      JSON            NULL,
  new_values      JSON            NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_audit_user (user_id),
  KEY idx_audit_action (action),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----- FRAUD LOGS -----
CREATE TABLE IF NOT EXISTS fraud_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_type      ENUM('cps_exceeded','cli_flood','short_call_ratio','ip_blacklist','pattern_anomaly','balance_depleted','simultaneous_limit') NOT NULL,
  severity        ENUM('info','low','medium','high','critical') NOT NULL DEFAULT 'medium',
  source_ip       VARCHAR(45)     NULL,
  cli             VARCHAR(128)    NULL,
  destination     VARCHAR(128)    NULL,
  provider_id     BIGINT UNSIGNED NULL,
  client_id       BIGINT UNSIGNED NULL,
  details         JSON            NULL,
  resolved        TINYINT(1)      NOT NULL DEFAULT 0,
  resolved_by     BIGINT UNSIGNED NULL,
  resolved_at     DATETIME(3)     NULL,
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_fraud_type (event_type),
  KEY idx_fraud_severity (severity),
  KEY idx_fraud_resolved (resolved),
  KEY idx_fraud_created (created_at),
  KEY idx_fraud_client (client_id),
  CONSTRAINT fk_fraud_provider FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL,
  CONSTRAINT fk_fraud_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_fraud_resolver FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ----- IP WHITELIST -----
CREATE TABLE IF NOT EXISTS ip_whitelist (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ip_address      VARCHAR(45)     NOT NULL,
  cidr_mask       INT UNSIGNED    NOT NULL DEFAULT 32,
  description     VARCHAR(255)    NULL,
  entity_type     ENUM('provider','client','system') NOT NULL DEFAULT 'system',
  entity_id       BIGINT UNSIGNED NULL,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3)     NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_ip_wl (ip_address, cidr_mask),
  KEY idx_ip_wl_status (status)
) ENGINE=InnoDB;

-- ----- SYSTEM SETTINGS -----
CREATE TABLE IF NOT EXISTS system_settings (
  skey    VARCHAR(128) NOT NULL PRIMARY KEY,
  svalue  JSON         NOT NULL
) ENGINE=InnoDB;

INSERT INTO system_settings (skey, svalue) VALUES
  ('billing', JSON_OBJECT(
    'min_bill_seconds', 30,
    'increment_seconds', 6,
    'routing_mode', 'priority',
    'max_cps_global', 100,
    'low_balance_threshold', 5.00,
    'negative_balance_allowed', FALSE
  )),
  ('fraud', JSON_OBJECT(
    'enabled', TRUE,
    'max_cps_per_ip', 50,
    'max_calls_per_cli_hour', 120,
    'short_call_threshold_pct', 85,
    'short_call_duration_sec', 6,
    'max_simultaneous_per_client', 100
  )),
  ('platform', JSON_OBJECT(
    'name', 'IPRN Telecom Platform',
    'version', '3.0.0',
    'recording_enabled', TRUE,
    'recording_path', '/var/spool/asterisk/recording',
    'recording_max_days', 90,
    'asterisk_host', '127.0.0.1',
    'asterisk_ami_port', 5038,
    'asterisk_ami_user', 'platform',
    'asterisk_ami_secret', 'change-me'
  ))
ON DUPLICATE KEY UPDATE skey = skey;

-- ----- ODBC lookup view for Asterisk func_odbc -----
CREATE OR REPLACE VIEW v_did_lookup AS
SELECT
  d.did_number,
  d.client_id,
  d.provider_id,
  d.rate_per_minute,
  d.route_type,
  d.route_target,
  d.failover_target,
  d.ivr_id,
  d.recording,
  d.status AS did_status,
  c.balance AS client_balance,
  c.billing_type AS client_billing,
  c.status AS client_status
FROM did_inventory d
LEFT JOIN clients c ON c.id = d.client_id
WHERE d.status = 'assigned';

-- ----- Provider IP lookup view for Asterisk ACL -----
CREATE OR REPLACE VIEW v_provider_ips AS
SELECT
  p.id AS provider_id,
  p.name AS provider_name,
  p.host,
  p.allowed_ips,
  p.status
FROM providers p
WHERE p.status IN ('active','testing');

SET FOREIGN_KEY_CHECKS = 1;
