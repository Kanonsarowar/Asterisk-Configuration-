-- DANGER: Removes all DIDs from the dashboard (MySQL).
-- Run only when you intend to rebuild inventory from scratch.
-- Keeps call_logs and other tables.

USE iprn_system;

SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM number_inventory;
DELETE FROM numbers;
DELETE FROM did_inventory;
SET FOREIGN_KEY_CHECKS = 1;

SELECT 'numbers cleared' AS step;
