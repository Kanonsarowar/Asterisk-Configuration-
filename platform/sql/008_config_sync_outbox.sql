-- Asterisk config sync: outbox for DB triggers + full snapshots for rollback
-- Safe to re-run: drops triggers first.

DROP TRIGGER IF EXISTS tr_routes_config_sync_ai;
DROP TRIGGER IF EXISTS tr_routes_config_sync_au;
DROP TRIGGER IF EXISTS tr_routes_config_sync_ad;
DROP TRIGGER IF EXISTS tr_suppliers_config_sync_ai;
DROP TRIGGER IF EXISTS tr_suppliers_config_sync_au;
DROP TRIGGER IF EXISTS tr_suppliers_config_sync_ad;
DROP TRIGGER IF EXISTS tr_numbers_config_sync_ai;
DROP TRIGGER IF EXISTS tr_numbers_config_sync_au;
DROP TRIGGER IF EXISTS tr_numbers_config_sync_ad;

CREATE TABLE IF NOT EXISTS config_sync_outbox (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reason        VARCHAR(32) NOT NULL DEFAULT 'unknown',
  created_at    DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
  processed_at  DATETIME(3) NULL,
  KEY idx_outbox_pending (processed_at, id)
) ENGINE=InnoDB;

DELIMITER //
CREATE TRIGGER tr_routes_config_sync_ai AFTER INSERT ON routes FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('routes');
END//
CREATE TRIGGER tr_routes_config_sync_au AFTER UPDATE ON routes FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('routes');
END//
CREATE TRIGGER tr_routes_config_sync_ad AFTER DELETE ON routes FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('routes');
END//

CREATE TRIGGER tr_suppliers_config_sync_ai AFTER INSERT ON suppliers FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('suppliers');
END//
CREATE TRIGGER tr_suppliers_config_sync_au AFTER UPDATE ON suppliers FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('suppliers');
END//
CREATE TRIGGER tr_suppliers_config_sync_ad AFTER DELETE ON suppliers FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('suppliers');
END//

CREATE TRIGGER tr_numbers_config_sync_ai AFTER INSERT ON numbers FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('numbers');
END//
CREATE TRIGGER tr_numbers_config_sync_au AFTER UPDATE ON numbers FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('numbers');
END//
CREATE TRIGGER tr_numbers_config_sync_ad AFTER DELETE ON numbers FOR EACH ROW
BEGIN
  INSERT INTO config_sync_outbox (reason) VALUES ('numbers');
END//
DELIMITER ;

ALTER TABLE config_versions
  ADD COLUMN trigger_source VARCHAR(64) NULL DEFAULT NULL AFTER version_tag,
  ADD COLUMN snapshot_json MEDIUMTEXT NULL DEFAULT NULL AFTER files_json;
