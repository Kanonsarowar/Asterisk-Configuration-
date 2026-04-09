-- Prefix catalog: countries → commercial/routing template per prefix.
-- Applied automatically by dashboard ensureMysqlSchema() when MYSQL_ENABLED=1.

CREATE TABLE IF NOT EXISTS `prefix_countries` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(128) NOT NULL DEFAULT '',
  `country` VARCHAR(8) NOT NULL DEFAULT 'XX',
  `dial_prefix` VARCHAR(32) NOT NULL DEFAULT '',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_prefix_countries_country` (`country`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `prefix_inventory` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `country_id` INT UNSIGNED NOT NULL,
  `country_code` VARCHAR(32) NOT NULL DEFAULT '',
  `prefix` VARCHAR(64) NOT NULL DEFAULT '',
  `rate` VARCHAR(32) NOT NULL DEFAULT '0.01',
  `rate_currency` VARCHAR(8) NOT NULL DEFAULT 'usd',
  `payment_term` VARCHAR(16) NOT NULL DEFAULT 'weekly',
  `supplier_id` VARCHAR(32) NOT NULL DEFAULT '',
  `destination_id` VARCHAR(16) NOT NULL DEFAULT '1',
  `routes_logic` TEXT NULL,
  `test_number` VARCHAR(64) NOT NULL DEFAULT '',
  `status` VARCHAR(16) NOT NULL DEFAULT 'active',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_prefix_inv_cc_prefix` (`country_id`, `country_code`(16), `prefix`(32)),
  KEY `idx_prefix_inv_country` (`country_id`),
  CONSTRAINT `fk_prefix_inv_country` FOREIGN KEY (`country_id`) REFERENCES `prefix_countries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- `numbers.prefix_inventory_id` links optional template row (migration in dashboard/lib/mysql.js).
