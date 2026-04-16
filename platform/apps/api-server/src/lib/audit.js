import { query } from '../../../../packages/database/index.js';

export async function auditLog(action, userId = null, opts = {}) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, old_values, new_values)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, opts.entityType || null, opts.entityId || null,
       opts.ip || null, opts.oldValues ? JSON.stringify(opts.oldValues) : null,
       opts.newValues ? JSON.stringify(opts.newValues) : null]
    );
  } catch (e) {
    console.error('audit_log insert failed:', e.message);
  }
}
