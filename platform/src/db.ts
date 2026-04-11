import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool | null {
  return pool;
}

/** Phase 1: optional `routes` + `vendors` if missing (idempotent). */
const DDL_VENDORS = `
CREATE TABLE IF NOT EXISTS \`vendors\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(128) NOT NULL DEFAULT '',
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'active',
  \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_vendors_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

const DDL_ROUTES = `
CREATE TABLE IF NOT EXISTS \`routes\` (
  \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  \`prefix\` VARCHAR(32) NOT NULL DEFAULT '',
  \`vendor_id\` INT UNSIGNED NULL,
  \`priority\` INT NOT NULL DEFAULT 1,
  \`status\` VARCHAR(32) NOT NULL DEFAULT 'active',
  \`meta\` JSON NULL,
  \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uk_routes_prefix\` (\`prefix\`(32)),
  KEY \`idx_routes_vendor\` (\`vendor_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

export async function initDb(): Promise<{ ok: boolean; error?: string }> {
  const host = (process.env.MYSQL_HOST || '127.0.0.1').trim();
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10) || 3306;
  const database = (process.env.MYSQL_DATABASE || '').trim();
  const user = (process.env.MYSQL_USER || '').trim();
  const password = process.env.MYSQL_PASSWORD != null ? String(process.env.MYSQL_PASSWORD) : '';

  if (!database || !user) {
    return { ok: false, error: 'MYSQL_DATABASE and MYSQL_USER are required' };
  }

  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      enableKeepAlive: true,
    });
    await pool.query('SELECT 1 AS ok');
    await pool.execute(DDL_VENDORS);
    await pool.execute(DDL_ROUTES);
    await pool.execute(
      "INSERT IGNORE INTO `vendors` (`id`, `name`, `status`) VALUES (1, 'Default Vendor', 'active')"
    );
    await pool.execute(
      "INSERT IGNORE INTO `routes` (`id`, `prefix`, `vendor_id`, `priority`, `status`) VALUES (1, '971', 1, 1, 'active')"
    );
    return { ok: true };
  } catch (e) {
    pool = null;
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}
