-- IPRN range inventory (Phase 1) — MySQL
-- Tables use prefix iprn_inv_* to avoid collision with existing iprn_system tables
-- (`numbers`, `number_inventory`, suppliers in db.json, etc.).
-- Apply: mysql -u user -p iprn_system < sql/iprn_inventory.sql

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS iprn_inv_suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL DEFAULT '',
  country VARCHAR(50) NOT NULL DEFAULT '',
  sip_host VARCHAR(100) NOT NULL DEFAULT '',
  protocol ENUM('SIP','IAX') NOT NULL DEFAULT 'SIP',
  reliability_score FLOAT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iprn_inv_numbers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  country VARCHAR(50) NOT NULL DEFAULT '',
  prefix VARCHAR(20) NOT NULL DEFAULT '',
  range_start VARCHAR(20) NOT NULL DEFAULT '',
  range_end VARCHAR(20) NOT NULL DEFAULT '',
  type ENUM('IPRN','TEST') NOT NULL DEFAULT 'IPRN',
  supplier_id INT UNSIGNED NULL,
  access_type ENUM('IVR','DIRECT','SIP') NOT NULL DEFAULT 'IVR',
  status ENUM('NEW','TESTING','ACTIVE','DEGRADED','BLOCKED','ARCHIVED') NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_iprn_inv_num_supplier (supplier_id),
  KEY idx_iprn_inv_num_status (status),
  CONSTRAINT fk_iprn_inv_num_supplier FOREIGN KEY (supplier_id) REFERENCES iprn_inv_suppliers (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iprn_inv_pricing (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  number_id INT UNSIGNED NOT NULL,
  buy_rate DECIMAL(10,5) NOT NULL DEFAULT 0,
  sell_rate DECIMAL(10,5) NOT NULL DEFAULT 0,
  billing_type ENUM('PER_MIN','PER_CALL') NOT NULL DEFAULT 'PER_MIN',
  margin DECIMAL(10,5) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iprn_inv_pricing_num (number_id),
  CONSTRAINT fk_iprn_inv_pricing_num FOREIGN KEY (number_id) REFERENCES iprn_inv_numbers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iprn_inv_routing (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  number_id INT UNSIGNED NOT NULL,
  asterisk_context VARCHAR(100) NOT NULL DEFAULT '',
  ivr_id INT NOT NULL DEFAULT 0,
  priority INT NOT NULL DEFAULT 1,
  failover_supplier INT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_iprn_inv_route_num (number_id),
  CONSTRAINT fk_iprn_inv_route_num FOREIGN KEY (number_id) REFERENCES iprn_inv_numbers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iprn_inv_stats (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  number_id INT UNSIGNED NOT NULL,
  asr FLOAT NOT NULL DEFAULT 0,
  acd FLOAT NOT NULL DEFAULT 0,
  total_calls INT NOT NULL DEFAULT 0,
  revenue DECIMAL(12,5) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_iprn_inv_stats_num (number_id),
  CONSTRAINT fk_iprn_inv_stats_num FOREIGN KEY (number_id) REFERENCES iprn_inv_numbers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
