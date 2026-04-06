import { getPool } from '../db.js';

export async function logAudit(action, userId, entityType, entityId, ipAddress, metadata) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO audit_logs (action, user_id, entity_type, entity_id, ip_address, metadata)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [action, userId || null, entityType || null, entityId || null, ipAddress || null,
     metadata ? JSON.stringify(metadata) : null]
  );
}
