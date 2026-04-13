import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool | null {
  return pool;
}

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

async function migrateRoutesVendorFk(p: mysql.Pool): Promise<void> {
  try {
    const [rows] = await p.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.TABLE_CONSTRAINTS
       WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'routes' AND CONSTRAINT_NAME = 'fk_routes_vendor'`
    );
    const first = (rows as RowDataPacket[])[0];
    if (first && Number(first.cnt) > 0) return;
    await p.execute(`
      ALTER TABLE \`routes\`
      ADD CONSTRAINT \`fk_routes_vendor\`
      FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`)
      ON DELETE RESTRICT ON UPDATE CASCADE
    `);
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (msg.includes('Duplicate') || msg.includes('already exists')) return;
    if (msg.includes('Cannot add foreign key') || msg.includes('1452')) {
      await p.execute(`
        DELETE FROM \`routes\` WHERE \`vendor_id\` IS NOT NULL
        AND \`vendor_id\` NOT IN (SELECT \`id\` FROM \`vendors\`)
      `);
      await p.execute(`
        ALTER TABLE \`routes\`
        ADD CONSTRAINT \`fk_routes_vendor\`
        FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`)
        ON DELETE RESTRICT ON UPDATE CASCADE
      `);
      return;
    }
    throw e;
  }
}

export async function initDb(): Promise<{ ok: boolean; error?: string }> {
  const host = (process.env.MYSQL_HOST || '127.0.0.1').trim();
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10) || 3306;
  const database = (process.env.MYSQL_DATABASE || '').trim();
  const user = (process.env.MYSQL_USER || '').trim();
  const password = process.env.MYSQL_PASSWORD != null ? String(process.env.MYSQL_PASSWORD) : '';

  if (!database || !user) {
    return { ok: false, error: 'MYSQL_DATABASE and MYSQL_USER are required' };
  }
  if (password === '') {
    return { ok: false, error: 'MYSQL_PASSWORD is required (empty or not loaded — check .env)' };
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
    await migrateRoutesVendorFk(pool);
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
