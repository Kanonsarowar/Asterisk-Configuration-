-- =============================================================================
-- IPRN Telecom Platform — Production MySQL Schema
-- Database: iprn_platform
-- Engine:   InnoDB (row-level locking, ACID, FK support)
-- Charset:  utf8mb4 / utf8mb4_unicode_ci
-- Apply:    mysql -u root -p < 001_schema.sql
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `iprn_platform`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `iprn_platform`;

-- ---------------------------------------------------------------------------
-- 1. users — Platform operators, resellers, end-users
-- ---------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(128)     NOT NULL,
  `password_hash` VARCHAR(255)     NOT NULL COMMENT 'bcrypt / argon2 hash',
  `role`          ENUM('admin','reseller','user') NOT NULL DEFAULT 'user',
  `balance`       DECIMAL(18,6)    NOT NULL DEFAULT 0.000000 COMMENT 'prepaid balance in base currency',
  `status`        ENUM('active','suspended','disabled') NOT NULL DEFAULT 'active',
  `created_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_username` (`username`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 2. customers — Client organisations (may map to a user login)
-- ---------------------------------------------------------------------------
CREATE TABLE `customers` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(255)     NOT NULL,
  `company`       VARCHAR(255)     NOT NULL DEFAULT '',
  `contact_info`  TEXT             NULL COMMENT 'JSON or free-text: email, phone, address',
  `user_id`       BIGINT UNSIGNED  NULL COMMENT 'optional portal login',
  `status`        ENUM('active','suspended') NOT NULL DEFAULT 'active',
  `created_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_customers_user` (`user_id`),
  KEY `idx_customers_company` (`company`(64)),
  CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 3. suppliers — SIP trunk providers
-- ---------------------------------------------------------------------------
CREATE TABLE `suppliers` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(255)     NOT NULL,
  `host`          VARCHAR(255)     NOT NULL COMMENT 'SIP host or IP',
  `port`          SMALLINT UNSIGNED NOT NULL DEFAULT 5060,
  `username`      VARCHAR(255)     NOT NULL DEFAULT '' COMMENT 'SIP auth user (empty = IP-auth)',
  `password`      VARCHAR(255)     NOT NULL DEFAULT '' COMMENT 'SIP auth password (encrypted at app layer)',
  `protocol`      ENUM('sip','pjsip') NOT NULL DEFAULT 'pjsip',
  `codecs`        VARCHAR(128)     NOT NULL DEFAULT 'g729,alaw,ulaw' COMMENT 'comma-separated codec list',
  `max_channels`  INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '0 = unlimited',
  `cost_per_min`  DECIMAL(14,6)    NOT NULL DEFAULT 0.000000 COMMENT 'default cost/min from this supplier',
  `active`        TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_suppliers_active` (`active`),
  KEY `idx_suppliers_host` (`host`(64))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 4. numbers — DID / premium-number inventory
--    Prefix-based ranges: a row covers range_start..range_end under a prefix.
-- ---------------------------------------------------------------------------
CREATE TABLE `numbers` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `prefix`        VARCHAR(32)      NOT NULL COMMENT 'E.164 prefix digits (e.g. 4420)',
  `range_start`   VARCHAR(32)      NOT NULL DEFAULT '' COMMENT 'first suffix in range (digits after prefix)',
  `range_end`     VARCHAR(32)      NOT NULL DEFAULT '' COMMENT 'last suffix in range (digits after prefix)',
  `country`       CHAR(2)          NOT NULL DEFAULT '' COMMENT 'ISO 3166-1 alpha-2',
  `supplier_id`   BIGINT UNSIGNED  NULL,
  `customer_id`   BIGINT UNSIGNED  NULL,
  `rate_per_min`  DECIMAL(14,6)    NOT NULL DEFAULT 0.000000 COMMENT 'sell rate charged to caller/user',
  `type`          ENUM('premium','non-premium') NOT NULL DEFAULT 'premium',
  `status`        ENUM('available','assigned','testing','blocked') NOT NULL DEFAULT 'available',
  `ivr_slot`      TINYINT UNSIGNED NULL COMMENT 'IVR slot 1-10 for routing',
  `created_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_numbers_prefix` (`prefix`),
  KEY `idx_numbers_prefix_range` (`prefix`, `range_start`, `range_end`),
  KEY `idx_numbers_country_prefix` (`country`, `prefix`),
  KEY `idx_numbers_supplier` (`supplier_id`),
  KEY `idx_numbers_customer` (`customer_id`),
  KEY `idx_numbers_status` (`status`),
  KEY `idx_numbers_type` (`type`),

  CONSTRAINT `fk_numbers_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_numbers_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 5. routes — Prefix-based routing with priority & multi-supplier failover
--    Lower priority value = tried first.
-- ---------------------------------------------------------------------------
CREATE TABLE `routes` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `prefix`        VARCHAR(32)      NOT NULL COMMENT 'E.164 prefix to match',
  `supplier_id`   BIGINT UNSIGNED  NOT NULL,
  `priority`      INT              NOT NULL DEFAULT 100 COMMENT 'lower = higher priority',
  `rate`          DECIMAL(14,6)    NOT NULL DEFAULT 0.000000 COMMENT 'cost rate for this route',
  `active`        TINYINT(1)       NOT NULL DEFAULT 1,
  `created_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_routes_prefix_supplier` (`prefix`, `supplier_id`),
  KEY `idx_routes_prefix_priority` (`prefix`, `active`, `priority`),
  KEY `idx_routes_supplier` (`supplier_id`),
  KEY `idx_routes_active` (`active`),

  CONSTRAINT `fk_routes_supplier` FOREIGN KEY (`supplier_id`)
    REFERENCES `suppliers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 6. cdr — Call Detail Records (high-volume write-heavy table)
--    Partitioned by RANGE on start_time for efficient pruning and queries.
-- ---------------------------------------------------------------------------
CREATE TABLE `cdr` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `call_id`         VARCHAR(128)     NOT NULL COMMENT 'Asterisk Uniqueid',
  `cli`             VARCHAR(64)      NOT NULL DEFAULT '' COMMENT 'Caller ID / ANI',
  `destination`     VARCHAR(64)      NOT NULL DEFAULT '' COMMENT 'called number (E.164)',
  `start_time`      DATETIME(3)      NOT NULL COMMENT 'call setup time',
  `answer_time`     DATETIME(3)      NULL COMMENT 'NULL if unanswered',
  `end_time`        DATETIME(3)      NULL COMMENT 'hangup time',
  `duration`        INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'total seconds (ring + talk)',
  `billed_duration` INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT 'billable seconds (rounded per billing increment)',
  `cost`            DECIMAL(14,6)    NOT NULL DEFAULT 0.000000 COMMENT 'cost to platform (supplier rate)',
  `revenue`         DECIMAL(14,6)    NOT NULL DEFAULT 0.000000 COMMENT 'revenue from user (sell rate)',
  `profit`          DECIMAL(14,6)    NOT NULL DEFAULT 0.000000 COMMENT 'revenue - cost',
  `disposition`     VARCHAR(32)      NOT NULL DEFAULT '' COMMENT 'ANSWERED, NO ANSWER, BUSY, FAILED',
  `supplier_id`     BIGINT UNSIGNED  NULL,
  `user_id`         BIGINT UNSIGNED  NULL,
  `customer_id`     BIGINT UNSIGNED  NULL,
  `prefix_matched`  VARCHAR(32)      NOT NULL DEFAULT '' COMMENT 'routing prefix that was matched',
  `created_at`      DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`, `start_time`),
  UNIQUE KEY `uk_cdr_call_id` (`call_id`, `start_time`),
  KEY `idx_cdr_start_time` (`start_time`),
  KEY `idx_cdr_destination` (`destination`),
  KEY `idx_cdr_cli` (`cli`),
  KEY `idx_cdr_supplier` (`supplier_id`),
  KEY `idx_cdr_user` (`user_id`),
  KEY `idx_cdr_customer` (`customer_id`),
  KEY `idx_cdr_disposition` (`disposition`),
  KEY `idx_cdr_prefix` (`prefix_matched`)
)
ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
PARTITION BY RANGE (TO_DAYS(`start_time`)) (
  PARTITION p_2025_q1 VALUES LESS THAN (TO_DAYS('2025-04-01')),
  PARTITION p_2025_q2 VALUES LESS THAN (TO_DAYS('2025-07-01')),
  PARTITION p_2025_q3 VALUES LESS THAN (TO_DAYS('2025-10-01')),
  PARTITION p_2025_q4 VALUES LESS THAN (TO_DAYS('2026-01-01')),
  PARTITION p_2026_q1 VALUES LESS THAN (TO_DAYS('2026-04-01')),
  PARTITION p_2026_q2 VALUES LESS THAN (TO_DAYS('2026-07-01')),
  PARTITION p_2026_q3 VALUES LESS THAN (TO_DAYS('2026-10-01')),
  PARTITION p_2026_q4 VALUES LESS THAN (TO_DAYS('2027-01-01')),
  PARTITION p_future  VALUES LESS THAN MAXVALUE
);


-- ---------------------------------------------------------------------------
-- 7. invoices — Billing invoices per user
-- ---------------------------------------------------------------------------
CREATE TABLE `invoices` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED  NOT NULL,
  `customer_id`   BIGINT UNSIGNED  NULL,
  `total_amount`  DECIMAL(18,6)    NOT NULL DEFAULT 0.000000,
  `currency`      CHAR(3)          NOT NULL DEFAULT 'USD',
  `period_start`  DATE             NULL COMMENT 'billing period start',
  `period_end`    DATE             NULL COMMENT 'billing period end',
  `status`        ENUM('draft','pending','paid','overdue','cancelled') NOT NULL DEFAULT 'draft',
  `notes`         TEXT             NULL,
  `meta`          JSON             NULL COMMENT 'line-item breakdown, call aggregates',
  `created_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`    DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_invoices_user` (`user_id`),
  KEY `idx_invoices_customer` (`customer_id`),
  KEY `idx_invoices_status` (`status`),
  KEY `idx_invoices_created` (`created_at`),
  KEY `idx_invoices_period` (`period_start`, `period_end`),

  CONSTRAINT `fk_invoices_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customer_id`)
    REFERENCES `customers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ---------------------------------------------------------------------------
-- 8. audit_logs — Immutable action log for compliance and debugging
-- ---------------------------------------------------------------------------
CREATE TABLE `audit_logs` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `action`        VARCHAR(255)     NOT NULL COMMENT 'e.g. user.login, route.create, number.assign',
  `user_id`       BIGINT UNSIGNED  NULL,
  `entity_type`   VARCHAR(64)      NULL COMMENT 'table/resource affected',
  `entity_id`     BIGINT UNSIGNED  NULL COMMENT 'PK of affected row',
  `ip_address`    VARCHAR(45)      NULL COMMENT 'client IP (v4 or v6)',
  `metadata`      JSON             NULL COMMENT 'before/after snapshots, extra context',
  `timestamp`     DATETIME(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  KEY `idx_audit_user` (`user_id`),
  KEY `idx_audit_action` (`action`(64)),
  KEY `idx_audit_entity` (`entity_type`, `entity_id`),
  KEY `idx_audit_timestamp` (`timestamp`),

  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ===========================================================================
-- VIEWS — Convenience queries for the dashboard / API
-- ===========================================================================

-- Active routes ordered by prefix match length (longest prefix first) then priority
CREATE OR REPLACE VIEW `v_active_routes` AS
SELECT
  r.`id`          AS `route_id`,
  r.`prefix`,
  r.`priority`,
  r.`rate`        AS `route_rate`,
  s.`id`          AS `supplier_id`,
  s.`name`        AS `supplier_name`,
  s.`host`        AS `supplier_host`,
  s.`port`        AS `supplier_port`,
  s.`protocol`,
  s.`cost_per_min`
FROM `routes` r
JOIN `suppliers` s ON s.`id` = r.`supplier_id`
WHERE r.`active` = 1
  AND s.`active` = 1
ORDER BY LENGTH(r.`prefix`) DESC, r.`priority` ASC;

-- Per-user revenue & profit summary (last 30 days)
CREATE OR REPLACE VIEW `v_user_revenue_30d` AS
SELECT
  u.`id`          AS `user_id`,
  u.`username`,
  u.`role`,
  u.`balance`,
  COALESCE(SUM(c.`revenue`), 0)  AS `revenue_30d`,
  COALESCE(SUM(c.`cost`), 0)     AS `cost_30d`,
  COALESCE(SUM(c.`profit`), 0)   AS `profit_30d`,
  COUNT(c.`id`)                   AS `calls_30d`
FROM `users` u
LEFT JOIN `cdr` c ON c.`user_id` = u.`id`
  AND c.`start_time` >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY u.`id`;

-- Supplier utilisation summary (last 24h)
CREATE OR REPLACE VIEW `v_supplier_utilisation_24h` AS
SELECT
  s.`id`          AS `supplier_id`,
  s.`name`,
  s.`host`,
  s.`active`,
  COUNT(c.`id`)                          AS `calls_24h`,
  COALESCE(SUM(c.`duration`), 0)         AS `total_seconds_24h`,
  COALESCE(SUM(c.`cost`), 0)             AS `total_cost_24h`,
  COALESCE(AVG(c.`duration`), 0)         AS `acd_24h`,
  COALESCE(
    SUM(CASE WHEN c.`disposition` = 'ANSWERED' THEN 1 ELSE 0 END) * 100.0
    / NULLIF(COUNT(c.`id`), 0),
    0
  ) AS `asr_24h`
FROM `suppliers` s
LEFT JOIN `cdr` c ON c.`supplier_id` = s.`id`
  AND c.`start_time` >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY s.`id`;


-- ===========================================================================
-- STORED PROCEDURE — Longest-prefix route lookup with failover
-- Returns all active routes matching the destination, longest prefix first,
-- then by priority ASC. The caller (Asterisk AGI / API) iterates through
-- the result set for failover.
-- ===========================================================================
DELIMITER //

CREATE PROCEDURE `sp_route_lookup` (IN p_destination VARCHAR(64))
BEGIN
  SELECT
    r.`id`          AS `route_id`,
    r.`prefix`,
    r.`priority`,
    r.`rate`,
    s.`id`          AS `supplier_id`,
    s.`name`        AS `supplier_name`,
    s.`host`        AS `supplier_host`,
    s.`port`        AS `supplier_port`,
    s.`protocol`,
    s.`username`    AS `supplier_user`,
    s.`cost_per_min`
  FROM `routes` r
  JOIN `suppliers` s ON s.`id` = r.`supplier_id`
  WHERE r.`active` = 1
    AND s.`active` = 1
    AND LEFT(p_destination, LENGTH(r.`prefix`)) = r.`prefix`
  ORDER BY LENGTH(r.`prefix`) DESC, r.`priority` ASC;
END //

DELIMITER ;


-- ===========================================================================
-- TRIGGER — Auto-calculate profit on CDR insert
-- ===========================================================================
DELIMITER //

CREATE TRIGGER `trg_cdr_calc_profit`
BEFORE INSERT ON `cdr`
FOR EACH ROW
BEGIN
  SET NEW.`profit` = NEW.`revenue` - NEW.`cost`;
END //

DELIMITER ;


-- ===========================================================================
-- EVENT — Add future CDR partitions automatically (runs quarterly)
-- Requires: SET GLOBAL event_scheduler = ON;
-- ===========================================================================
DELIMITER //

CREATE EVENT IF NOT EXISTS `evt_cdr_add_partition`
ON SCHEDULE EVERY 3 MONTH
STARTS '2027-01-01 00:05:00'
DO
BEGIN
  DECLARE v_part_name VARCHAR(32);
  DECLARE v_boundary  DATE;
  SET v_boundary = DATE_ADD(CURDATE(), INTERVAL 6 MONTH);
  SET v_boundary = MAKEDATE(YEAR(v_boundary),
    CASE QUARTER(v_boundary)
      WHEN 1 THEN 1
      WHEN 2 THEN 91
      WHEN 3 THEN 182
      WHEN 4 THEN 274
    END);
  SET v_part_name = CONCAT('p_', YEAR(v_boundary), '_q', QUARTER(v_boundary));

  SET @sql = CONCAT(
    'ALTER TABLE `cdr` REORGANIZE PARTITION `p_future` INTO (',
    'PARTITION `', v_part_name, '` VALUES LESS THAN (TO_DAYS(''', v_boundary, ''')),',
    'PARTITION `p_future` VALUES LESS THAN MAXVALUE)'
  );
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END //

DELIMITER ;
