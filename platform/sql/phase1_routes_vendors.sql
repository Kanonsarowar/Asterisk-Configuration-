-- Phase 1 carrier API: optional tables if not present (MariaDB / MySQL 8+)
-- Safe to run on existing iprn_system.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `vendors` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL DEFAULT '',
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vendors_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `routes` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `prefix` VARCHAR(32) NOT NULL DEFAULT '',
  `vendor_id` INT UNSIGNED NULL,
  `priority` INT NOT NULL DEFAULT 1,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `meta` JSON NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_routes_prefix` (`prefix`(32)),
  KEY `idx_routes_vendor` (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed example (idempotent)
INSERT IGNORE INTO `vendors` (`id`, `name`, `status`) VALUES (1, 'Default Vendor', 'active');
INSERT IGNORE INTO `routes` (`id`, `prefix`, `vendor_id`, `priority`, `status`)
VALUES (1, '971', 1, 1, 'active');
