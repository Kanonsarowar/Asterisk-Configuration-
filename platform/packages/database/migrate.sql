-- Migration: upgrade existing iprn schema to telecom platform v3
-- Safe to run multiple times (all ALTER/CREATE use IF NOT EXISTS patterns)

SET NAMES utf8mb4;

-- Upgrade users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) NULL AFTER username;
ALTER TABLE users MODIFY COLUMN role ENUM('superadmin','admin','reseller','client','user') NOT NULL DEFAULT 'client';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at DATETIME(3) NULL AFTER status;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45) NULL AFTER last_login_at;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at;
ALTER TABLE users CHANGE COLUMN IF EXISTS parent_user_id parent_id BIGINT UNSIGNED NULL;

-- Update existing admin user to superadmin
UPDATE users SET role = 'superadmin' WHERE role = 'admin' AND id = 1;

-- Upgrade clients if missing columns
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tax_id VARCHAR(64) NULL AFTER address;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS rate_card_id BIGINT UNSIGNED NULL AFTER currency;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at DATETIME(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)) ON UPDATE CURRENT_TIMESTAMP(3) AFTER created_at;

-- Apply the new schema (IF NOT EXISTS handles everything)
