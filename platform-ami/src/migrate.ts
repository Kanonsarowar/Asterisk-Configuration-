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

async function indexExists(p: Pool, table: string, index: string): Promise<boolean> {
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index]
  );
  return rows?.[0] ? Number(rows[0].c) > 0 : false;
}

async function widenCallLogsPrefixForDid(p: Pool): Promise<void> {
  if (!(await columnExists(p, 'call_logs', 'prefix'))) return;
  const [rows] = await p.query<RowDataPacket[]>(
    `SELECT CHARACTER_MAXIMUM_LENGTH AS ml FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'call_logs' AND COLUMN_NAME = 'prefix'`
  );
  const ml = rows?.[0] != null ? Number((rows[0] as RowDataPacket).ml) : 0;
  if (ml > 0 && ml < 32) {
    try {
      await p.execute('ALTER TABLE `call_logs` MODIFY COLUMN `prefix` VARCHAR(32) NULL');
    } catch (e) {
      console.warn('[platform-ami] widen call_logs.prefix:', (e as Error)?.message || e);
    }
  }
}

/** Idempotent `call_logs` columns for AMI (matches platform-db reference DDL). */
export async function migrateCallLogsForAmi(p: Pool): Promise<void> {
  const [tbl] = await p.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS c FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'call_logs'`
  );
  if (!tbl?.[0] || Number(tbl[0].c) < 1) {
    console.warn('[platform-ami] call_logs missing; skip migration');
    return;
  }

  const cols: [string, string][] = [
    ['uniqueid', '`uniqueid` VARCHAR(50) NULL'],
    ['linkedid', '`linkedid` VARCHAR(64) NULL'],
    ['vendor_id', '`vendor_id` INT UNSIGNED NULL'],
    ['start_time', '`start_time` DATETIME NULL'],
    ['prefix', '`prefix` VARCHAR(32) NULL'],
    ['disposition', '`disposition` VARCHAR(64) NULL'],
  ];
  for (const [name, ddl] of cols) {
    if (await columnExists(p, 'call_logs', name)) continue;
    try {
      await p.execute(`ALTER TABLE \`call_logs\` ADD COLUMN ${ddl}`);
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      if (!msg.includes('Duplicate column')) throw e;
    }
  }
  await widenCallLogsPrefixForDid(p);
  if (!(await indexExists(p, 'call_logs', 'uk_call_logs_uniqueid'))) {
    try {
      await p.execute('CREATE UNIQUE INDEX `uk_call_logs_uniqueid` ON `call_logs` (`uniqueid`)');
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      if (!msg.includes('Duplicate') && !msg.includes('already exists')) throw e;
    }
  }
  if (!(await indexExists(p, 'call_logs', 'idx_call_logs_linkedid'))) {
    try {
      await p.execute('CREATE INDEX `idx_call_logs_linkedid` ON `call_logs` (`linkedid`)');
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      if (!msg.includes('Duplicate') && !msg.includes('already exists')) throw e;
    }
  }
}
