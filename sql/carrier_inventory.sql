-- Carrier-style inventory tables (optional complement to dashboard `numbers` + `number_inventory`).
-- The dashboard continues to use `numbers` as source of truth; these tables are kept in sync by the app.
-- Run manually or via dashboard schema ensure — do NOT replace existing `call_logs` (CDR uses different columns).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `providers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `type` ENUM('origination','termination','both') NOT NULL DEFAULT 'both',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `carrier_trunks` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `provider_id` INT UNSIGNED NULL,
  `name` VARCHAR(100) NULL,
  `host` VARCHAR(100) NULL,
  `port` INT NOT NULL DEFAULT 5060,
  `username` VARCHAR(100) NULL,
  `password` VARCHAR(100) NULL,
  `status` ENUM('up','down') NOT NULL DEFAULT 'up',
  PRIMARY KEY (`id`),
  KEY `idx_carrier_trunks_provider` (`provider_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `routing_table` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `prefix` VARCHAR(20) NULL,
  `trunk_id` INT UNSIGNED NULL,
  `priority` INT NOT NULL DEFAULT 1,
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  KEY `idx_routing_prefix` (`prefix`(16))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NULL,
  `balance` DECIMAL(12,4) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mirrors `numbers` for reporting / carrier queries (synced by Node, not a replacement for ODBC `number_inventory`).
CREATE TABLE IF NOT EXISTS `did_inventory` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `number` VARCHAR(20) NOT NULL,
  `country` VARCHAR(50) NULL,
  `country_code` VARCHAR(10) NULL,
  `prefix` VARCHAR(32) NULL,
  `status` ENUM('free','assigned','blocked','reserved') NOT NULL DEFAULT 'free',
  `provider_id` INT UNSIGNED NULL,
  `route_id` INT UNSIGNED NULL,
  `dashboard_number_id` INT UNSIGNED NULL COMMENT 'FK to numbers.id',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_did_inventory_number` (`number`),
  KEY `idx_did_prefix` (`prefix`),
  KEY `idx_did_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `did_assignments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `number` VARCHAR(20) NOT NULL,
  `customer_id` INT UNSIGNED NULL,
  `assigned_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_did_assign_number` (`number`(16))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
