import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function fraudRoutes(fastify) {
  fastify.addHook('preHandler', requireRoles('admin'));

  fastify.get('/fraud-logs', async (req) => {
    const { severity, event_type, resolved, limit = 100 } = req.query;
    let sql = `SELECT fl.*, cu.name AS customer_name, ca.name AS carrier_name
               FROM fraud_logs fl
               LEFT JOIN customers cu ON cu.id = fl.customer_id
               LEFT JOIN carriers ca ON ca.id = fl.carrier_id`;
    const where = []; const params = [];
    if (severity) { where.push('fl.severity = ?'); params.push(severity); }
    if (event_type) { where.push('fl.event_type = ?'); params.push(event_type); }
    if (resolved !== undefined) { where.push('fl.resolved = ?'); params.push(resolved === 'true' ? 1 : 0); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ` ORDER BY fl.created_at DESC LIMIT ${Math.min(parseInt(limit) || 100, 1000)}`;
    const { rows } = await query(sql, params);
    return { fraud_logs: rows };
  });

  fastify.get('/fraud-logs/stats', async () => {
    const { rows } = await query(`
      SELECT event_type, severity, COUNT(*) AS cnt
      FROM fraud_logs WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY event_type, severity ORDER BY cnt DESC
    `);
    const { rows: unresolved } = await query(
      'SELECT COUNT(*) AS total FROM fraud_logs WHERE resolved = 0'
    );
    return { last_24h: rows, unresolved: unresolved[0]?.total || 0 };
  });

  fastify.put('/fraud-logs/:id/resolve', async (req, reply) => {
    const { affectedRows } = await query(
      'UPDATE fraud_logs SET resolved = 1, resolved_by = ?, resolved_at = NOW(3) WHERE id = ?',
      [req.userCtx?.id, req.params.id]
    );
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    await auditLog('fraud.resolve', req.userCtx?.id, { fraudLogId: req.params.id });
    return { ok: true };
  });

  fastify.get('/sip-whitelist', async () => {
    const { rows } = await query('SELECT * FROM sip_whitelist ORDER BY ip_address');
    return { whitelist: rows };
  });

  fastify.post('/sip-whitelist', async (req, reply) => {
    const { ip_address, cidr_mask = 32, description = '', entity_type = 'system', entity_id = null } = req.body || {};
    if (!ip_address) return reply.code(400).send({ error: 'ip_address required' });
    const { insertId } = await query(
      `INSERT INTO sip_whitelist (ip_address, cidr_mask, description, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)`,
      [ip_address, cidr_mask, description, entity_type, entity_id]
    );
    await auditLog('sip_whitelist.add', req.userCtx?.id, { ip_address, cidr_mask });
    return reply.code(201).send({ id: insertId });
  });

  fastify.delete('/sip-whitelist/:id', async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM sip_whitelist WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    await auditLog('sip_whitelist.remove', req.userCtx?.id, { id: req.params.id });
    return { ok: true };
  });
}
