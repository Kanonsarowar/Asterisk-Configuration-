import { query } from '../db.js';

export async function auditLog(action, userId, meta = null) {
  try {
    await query(
      'INSERT INTO audit_logs (action, user_id, meta) VALUES ($1, $2, $3)',
      [action, userId, meta == null ? null : JSON.stringify(meta)]
    );
  } catch (e) {
    console.error('[audit]', e.message);
  }
}
