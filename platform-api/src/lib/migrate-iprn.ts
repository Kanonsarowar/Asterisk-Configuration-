import type { Pool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';

async function columnExists(p: Pool, table: string, column: string): Promise<boolean> {
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows?.[0] ? Number(rows[0].c) > 0 : false;
}

async function tableExists(p: Pool, name: string): Promise<boolean> {
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [name]
  );
  return rows?.[0] ? Number(rows[0].c) > 0 : false;
}

/** Idempotent columns for IPRN audio IVR + billing on existing tables. */
export async function migrateIprnAudioSchema(p: Pool): Promise<void> {
  if (await tableExists(p, 'call_logs')) {
    const callCols: [string, string][] = [
      ['uniqueid', '`uniqueid` VARCHAR(50) NULL'],
      ['did', '`did` VARCHAR(64) NULL'],
      ['callerid', '`callerid` VARCHAR(64) NULL'],
      ['start_time', '`start_time` DATETIME NULL'],
      ['end_time', '`end_time` DATETIME NULL'],
      ['disposition', '`disposition` VARCHAR(64) NULL'],
      ['revenue', '`revenue` DECIMAL(18,6) NULL'],
      ['carrier_cost', '`carrier_cost` DECIMAL(18,6) NULL'],
      ['profit', '`profit` DECIMAL(18,6) NULL'],
      ['currency', '`currency` VARCHAR(8) NULL'],
    ];
    for (const [name, ddl] of callCols) {
      if (await columnExists(p, 'call_logs', name)) continue;
      try {
        await p.execute(`ALTER TABLE \`call_logs\` ADD COLUMN ${ddl}`);
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        if (!msg.includes('Duplicate column')) throw e;
      }
    }
  }

  if (await tableExists(p, 'numbers')) {
    if (!(await columnExists(p, 'numbers', 'carrier_cost_per_min'))) {
      try {
        await p.execute(
          'ALTER TABLE `numbers` ADD COLUMN `carrier_cost_per_min` DECIMAL(14,6) NOT NULL DEFAULT 0'
        );
      } catch (e) {
        const msg = String((e as Error)?.message || e);
        if (!msg.includes('Duplicate column')) throw e;
      }
    }
  }

  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS \`platform_users\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`username\` VARCHAR(64) NOT NULL,
      \`password_hash\` VARCHAR(255) NOT NULL DEFAULT '',
      \`role\` VARCHAR(24) NOT NULL DEFAULT 'user',
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_platform_users_username\` (\`username\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS \`user_dids\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`user_id\` INT UNSIGNED NOT NULL,
      \`did\` VARCHAR(64) NOT NULL,
      \`assigned_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`status\` VARCHAR(24) NOT NULL DEFAULT 'active',
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_user_dids_did\` (\`did\`),
      KEY \`idx_user_dids_user\` (\`user_id\`),
      CONSTRAINT \`fk_user_dids_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`platform_users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS \`audio_files\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`path\` VARCHAR(512) NOT NULL,
      \`label\` VARCHAR(128) NOT NULL DEFAULT '',
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_audio_files_path\` (\`path\`(191))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS \`audio_map\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`did\` VARCHAR(64) NOT NULL,
      \`audio_file_id\` INT UNSIGNED NOT NULL,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_audio_map_did\` (\`did\`),
      KEY \`idx_audio_map_file\` (\`audio_file_id\`),
      CONSTRAINT \`fk_audio_map_file\` FOREIGN KEY (\`audio_file_id\`) REFERENCES \`audio_files\` (\`id\`) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS \`billing_accounts\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`user_id\` INT UNSIGNED NOT NULL,
      \`currency\` VARCHAR(8) NOT NULL DEFAULT 'USD',
      \`balance\` DECIMAL(18,6) NOT NULL DEFAULT 0,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uk_billing_user_currency\` (\`user_id\`, \`currency\`),
      CONSTRAINT \`fk_billing_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`platform_users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS \`invoices\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`user_id\` INT UNSIGNED NOT NULL,
      \`period_start\` DATE NOT NULL,
      \`period_end\` DATE NOT NULL,
      \`amount\` DECIMAL(18,6) NOT NULL DEFAULT 0,
      \`currency\` VARCHAR(8) NOT NULL DEFAULT 'USD',
      \`status\` VARCHAR(24) NOT NULL DEFAULT 'draft',
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_invoices_user\` (\`user_id\`),
      CONSTRAINT \`fk_invoices_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`platform_users\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS \`audit_logs\` (
      \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`user_id\` INT UNSIGNED NULL,
      \`action\` VARCHAR(128) NOT NULL,
      \`details\` JSON NULL,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`idx_audit_created\` (\`created_at\`),
      KEY \`idx_audit_user\` (\`user_id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  ];

  for (const sql of ddlStatements) {
    try {
      await p.execute(sql);
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      if (!msg.includes('already exists') && !msg.includes('Duplicate')) {
        console.warn('[platform-api] migrate:', msg);
      }
    }
  }
}
