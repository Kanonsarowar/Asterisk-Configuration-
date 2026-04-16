-- Migration 004: Profit-aware smart routing engine
--
-- Adds route_scores table for cached composite scoring,
-- extends routes with weight/threshold columns for smart routing,
-- adds PDD tracking to CDR.
--
-- Safe to re-run: all DDL uses conditional patterns.

SET NAMES utf8mb4;

-- =====================================================================
-- 1. Extend routes table with scoring-related columns
-- =====================================================================

-- weight for weighted distribution
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'weight');
SET @s = IF(@c = 0, 'ALTER TABLE routes ADD COLUMN weight INT UNSIGNED NOT NULL DEFAULT 100 AFTER priority', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- min_asr threshold
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'min_asr');
SET @s = IF(@c = 0, 'ALTER TABLE routes ADD COLUMN min_asr DECIMAL(5,2) NOT NULL DEFAULT 0.00 AFTER rate', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- min_acd threshold
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'min_acd');
SET @s = IF(@c = 0, 'ALTER TABLE routes ADD COLUMN min_acd DECIMAL(8,2) NOT NULL DEFAULT 0.00 AFTER min_asr', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- margin_min for margin protection
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'margin_min');
SET @s = IF(@c = 0, 'ALTER TABLE routes ADD COLUMN margin_min DECIMAL(18,6) NOT NULL DEFAULT 0.000000 AFTER min_acd', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- status enum (may already exist from partial run)
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'status');
-- If missing, add it; if present, skip
SET @s = IF(@c = 0, "ALTER TABLE routes ADD COLUMN status ENUM('active','quarantined','disabled') NOT NULL DEFAULT 'active' AFTER active", 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'quarantined_at');
SET @s = IF(@c = 0, 'ALTER TABLE routes ADD COLUMN quarantined_at DATETIME(3) NULL AFTER status', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND COLUMN_NAME = 'quarantine_reason');
SET @s = IF(@c = 0, 'ALTER TABLE routes ADD COLUMN quarantine_reason VARCHAR(255) NULL AFTER quarantined_at', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Sync status from active flag for existing rows
UPDATE routes SET status = 'active' WHERE active = 1 AND status = 'active';
UPDATE routes SET status = 'disabled' WHERE active = 0 AND status = 'active';

-- =====================================================================
-- 2. route_scores — materialised score cache
-- =====================================================================
CREATE TABLE IF NOT EXISTS route_scores (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  route_id        BIGINT UNSIGNED NOT NULL,
  supplier_id     BIGINT UNSIGNED NOT NULL,
  prefix          VARCHAR(32)     NOT NULL DEFAULT '',

  asr             DECIMAL(7,4)  NOT NULL DEFAULT 0.0000,
  acd             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pdd             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  margin          DECIMAL(18,6) NOT NULL DEFAULT 0.000000,
  stability       DECIMAL(7,4)  NOT NULL DEFAULT 100.0000,

  quality_score   DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  profit_score    DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  final_score     DECIMAL(10,4) NOT NULL DEFAULT 0.0000,

  sample_size     INT UNSIGNED  NOT NULL DEFAULT 0,
  computed_at     DATETIME(3)   NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  updated_at      DATETIME(3)   NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3),

  UNIQUE KEY uq_rs_route (route_id),
  KEY idx_rs_supplier (supplier_id),
  KEY idx_rs_prefix_score (prefix, final_score),
  KEY idx_rs_final (final_score),
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_supplier FOREIGN KEY (supplier_id) REFERENCES providers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- 3. PDD column on CDR
-- =====================================================================
SET @c = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'cdr' AND COLUMN_NAME = 'pdd_ms');
SET @s = IF(@c = 0, 'ALTER TABLE cdr ADD COLUMN pdd_ms INT UNSIGNED NULL', 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- =====================================================================
-- 4. Routing engine settings
-- =====================================================================
INSERT INTO system_settings (skey, svalue) VALUES
  ('routing_engine', JSON_OBJECT(
    'mode', 'smart',
    'quarantine_asr_threshold', 20.00,
    'quarantine_window_minutes', 15,
    'quarantine_retest_minutes', 10,
    'quarantine_min_samples', 10,
    'score_recompute_minutes', 5,
    'weights', JSON_OBJECT(
      'asr', 0.35,
      'acd', 0.15,
      'pdd', 0.10,
      'margin', 0.30,
      'stability', 0.10
    ),
    'lcr_fallback', TRUE,
    'max_acd_normalise', 300,
    'max_margin_normalise', 0.10
  ))
ON DUPLICATE KEY UPDATE skey = skey;
