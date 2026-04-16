-- Migration 003: Extend schema for production telecom platform
-- Adds: carriers, rate_cards, payments, recordings, fraud_logs, sip_endpoints, queues, voicemails, time_conditions
-- Enhances: did_inventory routing options, call_routes flexibility

SET NAMES utf8mb4;

-- ============================================================
-- CARRIERS (upstream SIP trunks from telcos)
-- ============================================================
CREATE TABLE IF NOT EXISTS carriers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  host            VARCHAR(255) NOT NULL,
  port            INT UNSIGNED NOT NULL DEFAULT 5060,
  transport       ENUM('udp','tcp','tls') NOT NULL DEFAULT 'udp',
  auth_type       ENUM('ip','registration','both') NOT NULL DEFAULT 'ip',
  username        VARCHAR(255) NOT NULL DEFAULT '',
  password        VARCHAR(512) NOT NULL DEFAULT '',
  allowed_ips     JSON NULL COMMENT '["1.2.3.4","5.6.7.0/24"]',
  codecs          VARCHAR(255) NOT NULL DEFAULT 'g729,alaw,ulaw',
  max_channels    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '0=unlimited',
  cps_limit       INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'calls-per-second, 0=unlimited',
  cost_per_minute DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  connection_fee  DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  status          ENUM('active','disabled','testing') NOT NULL DEFAULT 'active',
  notes           TEXT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY idx_carriers_status (status),
  KEY idx_carriers_host (host)
) ENGINE=InnoDB;

-- ============================================================
-- RATE CARDS (per-prefix pricing for billing)
-- ============================================================
CREATE TABLE IF NOT EXISTS rate_cards (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  card_type       ENUM('sell','buy') NOT NULL DEFAULT 'sell',
  effective_date  DATE NOT NULL,
  expiry_date     DATE NULL,
  status          ENUM('active','draft','expired') NOT NULL DEFAULT 'draft',
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_rate_cards_type (card_type),
  KEY idx_rate_cards_status (status),
  KEY idx_rate_cards_effective (effective_date),
  CONSTRAINT fk_rate_cards_creator FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS rate_card_entries (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rate_card_id    BIGINT UNSIGNED NOT NULL,
  prefix          VARCHAR(32) NOT NULL,
  destination     VARCHAR(255) NOT NULL DEFAULT '',
  rate_per_minute DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  connection_fee  DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  min_duration    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'minimum billable seconds',
  increment       INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'billing increment seconds',
  KEY idx_rce_card (rate_card_id),
  KEY idx_rce_prefix (prefix),
  CONSTRAINT fk_rce_card FOREIGN KEY (rate_card_id) REFERENCES rate_cards (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- DID INVENTORY (enhanced with full routing options)
-- ============================================================
CREATE TABLE IF NOT EXISTS did_inventory (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  did_number      VARCHAR(64) NOT NULL,
  carrier_id      BIGINT UNSIGNED NULL,
  customer_id     BIGINT UNSIGNED NULL,
  status          ENUM('available','assigned','reserved','porting','blocked') NOT NULL DEFAULT 'available',
  monthly_cost    DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  monthly_price   DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  setup_fee       DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  country_code    VARCHAR(8) NOT NULL DEFAULT '',
  city            VARCHAR(255) NOT NULL DEFAULT '',
  route_type      ENUM('sip_endpoint','ivr','queue','voicemail','failover','time_condition') NULL,
  route_target    VARCHAR(512) NULL COMMENT 'endpoint id or context reference',
  failover_target VARCHAR(512) NULL,
  time_condition_id BIGINT UNSIGNED NULL,
  billing_type    ENUM('prepaid','postpaid') NOT NULL DEFAULT 'prepaid',
  rate_card_id    BIGINT UNSIGNED NULL,
  notes           TEXT NULL,
  assigned_at     DATETIME(3) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_did_number (did_number),
  KEY idx_did_carrier (carrier_id),
  KEY idx_did_customer (customer_id),
  KEY idx_did_status (status),
  KEY idx_did_country (country_code),
  KEY idx_did_route_type (route_type),
  CONSTRAINT fk_did_carrier FOREIGN KEY (carrier_id) REFERENCES carriers (id) ON DELETE SET NULL,
  CONSTRAINT fk_did_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_did_rate_card FOREIGN KEY (rate_card_id) REFERENCES rate_cards (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SIP ENDPOINTS (customer SIP registrations/trunks)
-- ============================================================
CREATE TABLE IF NOT EXISTS sip_endpoints (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id     BIGINT UNSIGNED NOT NULL,
  name            VARCHAR(128) NOT NULL,
  username        VARCHAR(128) NOT NULL,
  password        VARCHAR(512) NOT NULL,
  allowed_ips     JSON NULL,
  codecs          VARCHAR(255) NOT NULL DEFAULT 'g729,alaw,ulaw',
  max_channels    INT UNSIGNED NOT NULL DEFAULT 2,
  transport       ENUM('udp','tcp','tls') NOT NULL DEFAULT 'udp',
  nat             TINYINT(1) NOT NULL DEFAULT 1,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_registered DATETIME(3) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_sip_username (username),
  KEY idx_sip_customer (customer_id),
  KEY idx_sip_status (status),
  CONSTRAINT fk_sip_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- CALL QUEUES
-- ============================================================
CREATE TABLE IF NOT EXISTS call_queues (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id     BIGINT UNSIGNED NULL,
  name            VARCHAR(128) NOT NULL,
  strategy        ENUM('ringall','roundrobin','leastrecent','fewestcalls','random') NOT NULL DEFAULT 'ringall',
  timeout         INT UNSIGNED NOT NULL DEFAULT 30,
  max_wait        INT UNSIGNED NOT NULL DEFAULT 300,
  wrapup_time     INT UNSIGNED NOT NULL DEFAULT 5,
  music_on_hold   VARCHAR(255) NOT NULL DEFAULT 'default',
  announce_frequency INT UNSIGNED NOT NULL DEFAULT 30,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_queue_customer (customer_id),
  CONSTRAINT fk_queue_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS queue_members (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  queue_id        BIGINT UNSIGNED NOT NULL,
  endpoint_id     BIGINT UNSIGNED NULL,
  interface       VARCHAR(255) NOT NULL COMMENT 'PJSIP/xxx or Local/xxx@ctx',
  penalty         INT NOT NULL DEFAULT 0,
  paused          TINYINT(1) NOT NULL DEFAULT 0,
  KEY idx_qm_queue (queue_id),
  CONSTRAINT fk_qm_queue FOREIGN KEY (queue_id) REFERENCES call_queues (id) ON DELETE CASCADE,
  CONSTRAINT fk_qm_endpoint FOREIGN KEY (endpoint_id) REFERENCES sip_endpoints (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- VOICEMAIL BOXES
-- ============================================================
CREATE TABLE IF NOT EXISTS voicemail_boxes (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id     BIGINT UNSIGNED NULL,
  mailbox         VARCHAR(128) NOT NULL,
  password        VARCHAR(64) NOT NULL DEFAULT '1234',
  email           VARCHAR(255) NULL,
  max_messages    INT UNSIGNED NOT NULL DEFAULT 50,
  greeting_file   VARCHAR(512) NULL,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_vm_mailbox (mailbox),
  KEY idx_vm_customer (customer_id),
  CONSTRAINT fk_vm_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- TIME CONDITIONS (business hours routing)
-- ============================================================
CREATE TABLE IF NOT EXISTS time_conditions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id     BIGINT UNSIGNED NULL,
  name            VARCHAR(255) NOT NULL,
  timezone        VARCHAR(64) NOT NULL DEFAULT 'UTC',
  match_route_type  ENUM('sip_endpoint','ivr','queue','voicemail') NOT NULL DEFAULT 'ivr',
  match_route_target VARCHAR(512) NULL,
  nomatch_route_type  ENUM('sip_endpoint','ivr','queue','voicemail') NOT NULL DEFAULT 'voicemail',
  nomatch_route_target VARCHAR(512) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_tc_customer (customer_id),
  CONSTRAINT fk_tc_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS time_condition_rules (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  time_condition_id   BIGINT UNSIGNED NOT NULL,
  day_of_week         VARCHAR(32) NOT NULL DEFAULT '*' COMMENT 'mon,tue,wed... or * for all',
  start_time          TIME NOT NULL DEFAULT '09:00:00',
  end_time            TIME NOT NULL DEFAULT '17:00:00',
  KEY idx_tcr_tc (time_condition_id),
  CONSTRAINT fk_tcr_tc FOREIGN KEY (time_condition_id) REFERENCES time_conditions (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================
-- CALL ROUTES (enhanced with flexible destination types)
-- ============================================================
CREATE TABLE IF NOT EXISTS call_routes (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  did_id          BIGINT UNSIGNED NULL,
  prefix          VARCHAR(32) NOT NULL DEFAULT '',
  priority        INT NOT NULL DEFAULT 0,
  route_type      ENUM('sip_endpoint','ivr','queue','voicemail','failover','time_condition','carrier') NOT NULL DEFAULT 'carrier',
  route_target    VARCHAR(512) NOT NULL DEFAULT '',
  failover_type   ENUM('sip_endpoint','ivr','queue','voicemail','carrier') NULL,
  failover_target VARCHAR(512) NULL,
  carrier_id      BIGINT UNSIGNED NULL,
  active          TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_cr_did (did_id),
  KEY idx_cr_prefix (prefix),
  KEY idx_cr_active (active),
  CONSTRAINT fk_cr_did FOREIGN KEY (did_id) REFERENCES did_inventory (id) ON DELETE CASCADE,
  CONSTRAINT fk_cr_carrier FOREIGN KEY (carrier_id) REFERENCES carriers (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_id     BIGINT UNSIGNED NOT NULL,
  user_id         BIGINT UNSIGNED NULL,
  amount          DECIMAL(18,6) NOT NULL,
  currency        VARCHAR(3) NOT NULL DEFAULT 'USD',
  method          ENUM('wire','credit_card','paypal','crypto','manual') NOT NULL DEFAULT 'manual',
  reference       VARCHAR(255) NULL,
  status          ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
  notes           TEXT NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_payments_customer (customer_id),
  KEY idx_payments_status (status),
  KEY idx_payments_created (created_at),
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
  CONSTRAINT fk_payments_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- RECORDINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS recordings (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  cdr_id          BIGINT UNSIGNED NULL,
  customer_id     BIGINT UNSIGNED NULL,
  call_id         VARCHAR(128) NULL,
  filename        VARCHAR(512) NOT NULL,
  file_size       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  duration        INT UNSIGNED NOT NULL DEFAULT 0,
  direction       ENUM('inbound','outbound') NOT NULL DEFAULT 'inbound',
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_rec_cdr (cdr_id),
  KEY idx_rec_customer (customer_id),
  KEY idx_rec_created (created_at),
  CONSTRAINT fk_rec_cdr FOREIGN KEY (cdr_id) REFERENCES cdr (id) ON DELETE SET NULL,
  CONSTRAINT fk_rec_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- FRAUD LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS fraud_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  event_type      ENUM('cps_exceeded','cli_flood','short_call_ratio','ip_blacklist','pattern_anomaly','balance_alert') NOT NULL,
  severity        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  source_ip       VARCHAR(45) NULL,
  cli             VARCHAR(128) NULL,
  destination     VARCHAR(128) NULL,
  carrier_id      BIGINT UNSIGNED NULL,
  customer_id     BIGINT UNSIGNED NULL,
  details         JSON NULL,
  resolved        TINYINT(1) NOT NULL DEFAULT 0,
  resolved_by     BIGINT UNSIGNED NULL,
  resolved_at     DATETIME(3) NULL,
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  KEY idx_fraud_type (event_type),
  KEY idx_fraud_severity (severity),
  KEY idx_fraud_resolved (resolved),
  KEY idx_fraud_created (created_at),
  KEY idx_fraud_customer (customer_id),
  CONSTRAINT fk_fraud_carrier FOREIGN KEY (carrier_id) REFERENCES carriers (id) ON DELETE SET NULL,
  CONSTRAINT fk_fraud_customer FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE SET NULL,
  CONSTRAINT fk_fraud_resolver FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- SIP WHITELIST (IP-based access control)
-- ============================================================
CREATE TABLE IF NOT EXISTS sip_whitelist (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ip_address      VARCHAR(45) NOT NULL,
  cidr_mask       INT UNSIGNED NOT NULL DEFAULT 32,
  description     VARCHAR(255) NULL,
  entity_type     ENUM('carrier','customer','system') NOT NULL DEFAULT 'system',
  entity_id       BIGINT UNSIGNED NULL,
  status          ENUM('active','disabled') NOT NULL DEFAULT 'active',
  created_at      DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  UNIQUE KEY uq_sip_wl_ip (ip_address, cidr_mask),
  KEY idx_sip_wl_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- API RATE LIMITS (brute force protection)
-- ============================================================
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ip_address      VARCHAR(45) NOT NULL,
  endpoint        VARCHAR(255) NOT NULL DEFAULT '*',
  requests        INT UNSIGNED NOT NULL DEFAULT 0,
  window_start    DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  blocked_until   DATETIME(3) NULL,
  KEY idx_arl_ip (ip_address),
  KEY idx_arl_window (window_start)
) ENGINE=InnoDB;

-- Update system_settings with extended fraud config
INSERT INTO system_settings (skey, svalue) VALUES
  ('platform', JSON_OBJECT(
    'name', 'Telecom IPRN Platform',
    'version', '3.0.0',
    'kamailio_enabled', TRUE,
    'recording_enabled', TRUE,
    'recording_path', '/var/spool/asterisk/recording',
    'max_recording_days', 90
  ))
ON DUPLICATE KEY UPDATE skey = skey;
