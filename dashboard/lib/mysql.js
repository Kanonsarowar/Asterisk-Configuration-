/**
 * Optional MySQL integration. Disabled unless MYSQL_ENABLED is set and required env vars are present.
 * When enabled and healthy, DID inventory is read/written from the `numbers` table (see numbers-service).
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirnameMysql = dirname(fileURLToPath(import.meta.url));

/** Set true after a failed init so health reflects degraded state without throwing elsewhere. */
let initFailed = false;
let initError = null;

/**
 * MySQL is on when MYSQL_ENABLED is truthy (1, true, yes) and host, database, and user are set.
 */
export function isMysqlEnabled() {
  const flag = String(process.env.MYSQL_ENABLED || '').toLowerCase();
  const on = flag === '1' || flag === 'true' || flag === 'yes';
  return (
    on &&
    !!(process.env.MYSQL_HOST || '').trim() &&
    !!(process.env.MYSQL_DATABASE || '').trim() &&
    !!(process.env.MYSQL_USER || '').trim()
  );
}

/** True when MySQL is configured and startup init did not fail (numbers API uses DB). */
export function isMysqlNumbersReady() {
  return isMysqlEnabled() && !initFailed;
}

let pool = null;

export function getMysqlPool() {
  if (!isMysqlEnabled() || initFailed) return null;
  if (!pool) {
    pool = mysql.createPool({
      host: (process.env.MYSQL_HOST || '127.0.0.1').trim(),
      port: parseInt(process.env.MYSQL_PORT || '3306', 10) || 3306,
      user: (process.env.MYSQL_USER || '').trim(),
      password: process.env.MYSQL_PASSWORD != null ? String(process.env.MYSQL_PASSWORD) : '',
      database: (process.env.MYSQL_DATABASE || '').trim(),
      waitForConnections: true,
      connectionLimit: Math.min(20, Math.max(2, parseInt(process.env.MYSQL_CONNECTION_LIMIT || '10', 10) || 10)),
      enableKeepAlive: true,
    });
  }
  return pool;
}

/** Close pool (e.g. tests). */
export async function closeMysqlPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

const DDL_NUMBERS = `
CREATE TABLE IF NOT EXISTS \`numbers\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`number\` VARCHAR(64) NOT NULL,
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'active',
  \`client_name\` VARCHAR(255) NULL,
  \`allocation_date\` DATETIME NULL,
  \`country\` VARCHAR(8) NOT NULL DEFAULT 'XX',
  \`country_code\` VARCHAR(32) NOT NULL DEFAULT '',
  \`prefix\` VARCHAR(64) NOT NULL DEFAULT '',
  \`extension\` VARCHAR(32) NOT NULL DEFAULT '',
  \`rate\` VARCHAR(32) NOT NULL DEFAULT '0.01',
  \`rate_currency\` VARCHAR(8) NOT NULL DEFAULT 'usd',
  \`payment_term\` VARCHAR(16) NOT NULL DEFAULT 'weekly',
  \`supplier_id\` VARCHAR(32) NOT NULL DEFAULT '',
  \`destination_type\` VARCHAR(16) NOT NULL DEFAULT 'ivr',
  \`destination_id\` VARCHAR(16) NOT NULL DEFAULT '1',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_numbers_number\` (\`number\`),
  KEY \`idx_numbers_status\` (\`status\`),
  KEY \`idx_numbers_prefix\` (\`country\`, \`country_code\`, \`prefix\`(16))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/** iprn_system-style tables for ODBC routing + billing (optional; created when MySQL is enabled). */
const DDL_NUMBER_INVENTORY = `
CREATE TABLE IF NOT EXISTS \`number_inventory\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`number\` VARCHAR(64) NOT NULL,
  \`route_status\` VARCHAR(32) NOT NULL DEFAULT 'active',
  \`supplier\` VARCHAR(128) NOT NULL DEFAULT '',
  \`backup_supplier\` VARCHAR(128) NOT NULL DEFAULT '',
  \`rate_per_min\` DECIMAL(14,6) NOT NULL DEFAULT 0,
  \`cost_per_min\` DECIMAL(14,6) NOT NULL DEFAULT 0,
  \`priority\` INT NOT NULL DEFAULT 0,
  \`last_used\` DATETIME NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_number_inventory_number\` (\`number\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const DDL_CALL_BILLING = `
CREATE TABLE IF NOT EXISTS \`call_billing\` (
  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`call_id\` VARCHAR(64) NOT NULL,
  \`number\` VARCHAR(64) NOT NULL,
  \`supplier\` VARCHAR(128) NOT NULL DEFAULT '',
  \`start_time\` DATETIME NULL,
  \`end_time\` DATETIME NULL,
  \`duration\` INT NULL COMMENT 'seconds',
  \`rate\` DECIMAL(14,6) NULL,
  \`cost\` DECIMAL(14,6) NULL,
  \`profit\` DECIMAL(14,6) NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_call_billing_number\` (\`number\`),
  KEY \`idx_call_billing_start\` (\`start_time\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const DDL_DAILY_USAGE = `
CREATE TABLE IF NOT EXISTS \`daily_usage\` (
  \`number\` VARCHAR(64) NOT NULL,
  \`date\` DATE NOT NULL,
  \`total_calls\` INT NOT NULL DEFAULT 0,
  \`total_minutes\` BIGINT NOT NULL DEFAULT 0,
  \`cost\` DECIMAL(18,6) NOT NULL DEFAULT 0,
  PRIMARY KEY (\`number\`, \`date\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const DDL_CALL_LOGS = `
CREATE TABLE IF NOT EXISTS \`call_logs\` (
  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`caller\` VARCHAR(64) NULL,
  \`destination\` VARCHAR(64) NULL,
  \`duration\` INT NULL COMMENT 'seconds',
  \`status\` VARCHAR(32) NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_call_logs_created_at\` (\`created_at\`),
  KEY \`idx_call_logs_destination\` (\`destination\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/** Multi-tenant IPRN portal (dashboard login + allocation). Maps to spec: users / user_numbers / invoices (namespaced). */
const DDL_IPRN_USERS = `
CREATE TABLE IF NOT EXISTS \`iprn_users\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`username\` VARCHAR(64) NOT NULL,
  \`password_hash\` VARCHAR(128) NOT NULL,
  \`role\` VARCHAR(16) NOT NULL DEFAULT 'user',
  \`parent_user_id\` INT UNSIGNED NULL,
  \`balance\` DECIMAL(14,4) NOT NULL DEFAULT 0,
  \`status\` VARCHAR(24) NOT NULL DEFAULT 'active',
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_iprn_users_username\` (\`username\`),
  KEY \`idx_iprn_parent\` (\`parent_user_id\`),
  CONSTRAINT \`fk_iprn_users_parent\` FOREIGN KEY (\`parent_user_id\`) REFERENCES \`iprn_users\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

/** Maps portal users → DIDs; rows must exist in existing number_inventory (ODBC source of truth). */
const DDL_USER_NUMBERS = `
CREATE TABLE IF NOT EXISTS \`user_numbers\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`user_id\` INT UNSIGNED NOT NULL,
  \`number\` VARCHAR(64) NOT NULL,
  \`assigned_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`status\` VARCHAR(24) NOT NULL DEFAULT 'active',
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_user_numbers_user_num\` (\`user_id\`, \`number\`),
  KEY \`idx_user_numbers_number\` (\`number\`),
  CONSTRAINT \`fk_user_numbers_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`iprn_users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const DDL_IPRN_INVOICES = `
CREATE TABLE IF NOT EXISTS \`iprn_invoices\` (
  \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`user_id\` INT UNSIGNED NOT NULL,
  \`amount\` DECIMAL(14,4) NOT NULL,
  \`period_start\` DATE NOT NULL,
  \`period_end\` DATE NOT NULL,
  \`status\` VARCHAR(24) NOT NULL DEFAULT 'draft',
  \`meta\` JSON NULL,
  \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_iprn_inv_user\` (\`user_id\`),
  CONSTRAINT \`fk_iprn_inv_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`iprn_users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function migrateNumbersColumns(p) {
  const alters = [
    ['country', "VARCHAR(8) NOT NULL DEFAULT 'XX'"],
    ['country_code', "VARCHAR(32) NOT NULL DEFAULT ''"],
    ['prefix', "VARCHAR(64) NOT NULL DEFAULT ''"],
    ['extension', "VARCHAR(32) NOT NULL DEFAULT ''"],
    ['rate', "VARCHAR(32) NOT NULL DEFAULT '0.01'"],
    ['rate_currency', "VARCHAR(8) NOT NULL DEFAULT 'usd'"],
    ['payment_term', "VARCHAR(16) NOT NULL DEFAULT 'weekly'"],
    ['supplier_id', "VARCHAR(32) NOT NULL DEFAULT ''"],
    ['destination_type', "VARCHAR(16) NOT NULL DEFAULT 'ivr'"],
    ['destination_id', "VARCHAR(16) NOT NULL DEFAULT '1'"],
  ];
  for (const [col, def] of alters) {
    try {
      await p.execute(`ALTER TABLE \`numbers\` ADD COLUMN \`${col}\` ${def}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
  }
  try {
    await p.execute(
      'ALTER TABLE `numbers` ADD INDEX `idx_numbers_prefix` (`country`, `country_code`, `prefix`(16))'
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_KEYNAME') throw e;
  }
}

const IPRN_NUMBERS_ALTER = [
  ['routing_pjsip_endpoint', "VARCHAR(128) NOT NULL DEFAULT ''"],
  ['backup_pjsip_endpoint', "VARCHAR(128) NOT NULL DEFAULT ''"],
  ['iprn_route_status', "VARCHAR(32) NOT NULL DEFAULT 'active'"],
  ['cost_per_min', 'DECIMAL(14,6) NOT NULL DEFAULT 0'],
  ['iprn_priority', 'INT NOT NULL DEFAULT 0'],
];

async function migrateNumbersIprnColumns(p) {
  for (const [col, def] of IPRN_NUMBERS_ALTER) {
    try {
      await p.execute(`ALTER TABLE \`numbers\` ADD COLUMN \`${col}\` ${def}`);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') throw e;
    }
  }
}

/** Older deployments may have number_inventory without last_used; CREATE IF NOT EXISTS does not add columns. */
async function migrateNumberInventoryColumns(p) {
  try {
    await p.execute('ALTER TABLE `number_inventory` ADD COLUMN `last_used` DATETIME NULL');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
}

/** CDR → call_logs deduplication (sync job inserts with stable hash per Master.csv row). */
/** Catalog: countries → prefix rows (commercial + routing template). DIDs link via numbers.prefix_inventory_id. */
const DDL_PREFIX_COUNTRIES = `
CREATE TABLE IF NOT EXISTS \`prefix_countries\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(128) NOT NULL DEFAULT '',
  \`country\` VARCHAR(8) NOT NULL DEFAULT 'XX',
  \`dial_prefix\` VARCHAR(32) NOT NULL DEFAULT '',
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_prefix_countries_country\` (\`country\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const DDL_PREFIX_INVENTORY = `
CREATE TABLE IF NOT EXISTS \`prefix_inventory\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`country_id\` INT UNSIGNED NOT NULL,
  \`country_code\` VARCHAR(32) NOT NULL DEFAULT '',
  \`prefix\` VARCHAR(64) NOT NULL DEFAULT '',
  \`rate\` VARCHAR(32) NOT NULL DEFAULT '0.01',
  \`rate_currency\` VARCHAR(8) NOT NULL DEFAULT 'usd',
  \`payment_term\` VARCHAR(16) NOT NULL DEFAULT 'weekly',
  \`supplier_id\` VARCHAR(32) NOT NULL DEFAULT '',
  \`destination_id\` VARCHAR(16) NOT NULL DEFAULT '1',
  \`routes_logic\` TEXT NULL,
  \`test_number\` VARCHAR(64) NOT NULL DEFAULT '',
  \`status\` VARCHAR(16) NOT NULL DEFAULT 'active',
  \`notes\` TEXT NULL,
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_prefix_inv_cc_prefix\` (\`country_id\`, \`country_code\`(16), \`prefix\`(32)),
  KEY \`idx_prefix_inv_country\` (\`country_id\`),
  CONSTRAINT \`fk_prefix_inv_country\` FOREIGN KEY (\`country_id\`) REFERENCES \`prefix_countries\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function migrateNumbersPrefixInventoryId(p) {
  try {
    await p.execute(
      'ALTER TABLE `numbers` ADD COLUMN `prefix_inventory_id` INT UNSIGNED NULL COMMENT \'FK prefix_inventory template\''
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  try {
    await p.execute(
      'ALTER TABLE `numbers` ADD CONSTRAINT `fk_numbers_prefix_inventory` FOREIGN KEY (`prefix_inventory_id`) REFERENCES `prefix_inventory` (`id`) ON DELETE SET NULL'
    );
  } catch (e) {
    const msg = String(e?.message || e);
    if (e.code !== 'ER_DUP_KEY' && e.code !== 'ER_CANT_CREATE_TABLE' && e.code !== 'ER_FK_DUP_NAME' && !msg.includes('Duplicate')) {
      console.warn('[mysql] fk_numbers_prefix_inventory:', msg);
    }
  }
}

async function migrateCallLogsDedupHash(p) {
  try {
    await p.execute(
      'ALTER TABLE `call_logs` ADD COLUMN `dedup_hash` CHAR(64) NULL COMMENT \'sha256 CDR row fingerprint\''
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
  try {
    await p.execute('ALTER TABLE `call_logs` ADD UNIQUE KEY `uk_call_logs_dedup_hash` (`dedup_hash`)');
  } catch (e) {
    if (e.code !== 'ER_DUP_KEYNAME') throw e;
  }
  try {
    await p.execute(
      'ALTER TABLE `call_logs` ADD COLUMN `cdr_start` DATETIME NULL COMMENT \'Call start from CDR (for time windows)\''
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e;
  }
}

/** IPRN range inventory tables — /sql/iprn_inventory.sql (CREATE IF NOT EXISTS). */
async function ensureIprnInventorySchema(p) {
  const sqlPath = join(__dirnameMysql, '..', '..', 'sql', 'iprn_inventory.sql');
  if (!existsSync(sqlPath)) return;
  try {
    let raw = readFileSync(sqlPath, 'utf8');
    raw = raw.replace(/^\s*SET\s+[^;]+;/gim, '');
    const parts = raw
      .split(';')
      .map((s) => s.replace(/--[^\n]*/g, '').trim())
      .filter((s) => s.length > 0);
    for (const st of parts) {
      await p.query(st);
    }
  } catch (e) {
    console.error('[mysql] iprn_inventory.sql:', e?.message || e);
  }
}

export async function ensureMysqlSchema() {
  const p = getMysqlPool();
  if (!p) return { ok: false, skipped: true };
  await p.execute(DDL_NUMBERS);
  await p.execute(DDL_CALL_LOGS);
  await migrateCallLogsDedupHash(p);
  await migrateNumbersColumns(p);
  await migrateNumbersIprnColumns(p);
  await p.execute(DDL_NUMBER_INVENTORY);
  await migrateNumberInventoryColumns(p);
  await p.execute(DDL_CALL_BILLING);
  await p.execute(DDL_DAILY_USAGE);
  await p.execute(DDL_IPRN_USERS);
  await p.execute(DDL_USER_NUMBERS);
  await p.execute(DDL_IPRN_INVOICES);
  await ensureIprnInventorySchema(p);
  await p.execute(DDL_PREFIX_COUNTRIES);
  await p.execute(DDL_PREFIX_INVENTORY);
  await migrateNumbersPrefixInventoryId(p);
  return { ok: true };
}

/**
 * Connect and create tables. Safe to call on startup; failures are logged and do not exit the process.
 */
export async function initMysql() {
  initFailed = false;
  initError = null;
  if (!isMysqlEnabled()) {
    return { enabled: false, schemaOk: null, message: 'MySQL not configured (set MYSQL_ENABLED=1 and MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER)' };
  }
  try {
    await ensureMysqlSchema();
    return { enabled: true, schemaOk: true, message: 'MySQL connected and schema ensured' };
  } catch (e) {
    initFailed = true;
    initError = String(e?.message || e);
    console.error('[mysql] init failed:', initError);
    await closeMysqlPool();
    return { enabled: true, schemaOk: false, error: initError };
  }
}

export async function mysqlHealthCheck() {
  if (!isMysqlEnabled()) {
    return { enabled: false, connected: false, schemaOk: null };
  }
  if (initFailed) {
    return { enabled: true, connected: false, schemaOk: false, error: initError };
  }
  const p = getMysqlPool();
  if (!p) return { enabled: true, connected: false, schemaOk: false, error: 'pool unavailable' };
  try {
    await p.query('SELECT 1 AS ok');
    return { enabled: true, connected: true, schemaOk: !initFailed, numbersFromDb: isMysqlNumbersReady() };
  } catch (e) {
    return { enabled: true, connected: false, schemaOk: false, error: String(e?.message || e) };
  }
}

/**
 * Insert one row into `call_logs` using a single parameterized statement (pool + prepared stmt).
 * Expects a row already validated by validateAndNormalizeCallLog.
 */
/**
 * Per-number aggregates from call_billing (dashboard Numbers / reports).
 */
export async function getCallBillingSummaryByNumber(limit = 500) {
  const p = getMysqlPool();
  if (!p || initFailed) return [];
  const lim = Math.min(2000, Math.max(1, parseInt(String(limit), 10) || 500));
  try {
    const [rows] = await p.query(
      `SELECT \`number\`,
        COUNT(*) AS \`call_count\`,
        COALESCE(SUM(\`duration\`), 0) AS \`duration_seconds\`,
        COALESCE(SUM(\`cost\`), 0) AS \`total_cost\`,
        COALESCE(SUM(\`profit\`), 0) AS \`total_profit\`
       FROM \`call_billing\`
       GROUP BY \`number\`
       ORDER BY MAX(\`start_time\`) DESC
       LIMIT ?`,
      [lim]
    );
    return rows || [];
  } catch {
    return [];
  }
}

/**
 * Live IPRN call panel: DB connectivity + row counts (tolerates missing tables).
 */
export async function getIprnPanelTelemetry() {
  const out = {
    poolOk: false,
    numbersCount: null,
    inventoryCount: null,
    billing24hCount: null,
    lastBillingAt: null,
    tableErrors: [],
  };
  if (!isMysqlEnabled()) {
    return { ...out, skipped: true, reason: 'Set MYSQL_ENABLED=1 and DB env vars on the dashboard service.' };
  }
  if (initFailed) {
    return { ...out, error: initError };
  }
  const p = getMysqlPool();
  if (!p) {
    return { ...out, error: 'MySQL pool unavailable' };
  }
  try {
    await p.query('SELECT 1');
    out.poolOk = true;
  } catch (e) {
    return { ...out, error: String(e?.message || e) };
  }
  async function countRows(sql, label) {
    try {
      const [rows] = await p.query(sql);
      const v = rows && rows[0] != null ? rows[0].c : 0;
      return Number(v) || 0;
    } catch (e) {
      out.tableErrors.push(`${label}: ${String(e?.message || e)}`);
      return null;
    }
  }
  out.numbersCount = await countRows('SELECT COUNT(*) AS c FROM `numbers`', 'numbers');
  out.inventoryCount = await countRows('SELECT COUNT(*) AS c FROM `number_inventory`', 'number_inventory');
  out.billing24hCount = await countRows(
    'SELECT COUNT(*) AS c FROM `call_billing` WHERE `start_time` >= (NOW() - INTERVAL 1 DAY)',
    'call_billing_24h'
  );
  try {
    const [rows] = await p.query('SELECT MAX(`start_time`) AS m FROM `call_billing` LIMIT 1');
    const m = rows && rows[0] ? rows[0].m : null;
    if (m != null) {
      out.lastBillingAt = m instanceof Date ? m.toISOString() : String(m);
    }
  } catch (e) {
    out.tableErrors.push(`call_billing max: ${String(e?.message || e)}`);
  }
  return out;
}

export async function insertCallLog(row) {
  const p = getMysqlPool();
  if (!p || initFailed) {
    return { ok: false, skipped: true, error: 'MySQL unavailable' };
  }
  const { caller, destination, duration, status } = row;
  try {
    const [result] = await p.execute(
      'INSERT INTO `call_logs` (`caller`, `destination`, `duration`, `status`) VALUES (?, ?, ?, ?)',
      [caller, destination, duration, status]
    );
    const id = result.insertId != null ? String(result.insertId) : undefined;
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
