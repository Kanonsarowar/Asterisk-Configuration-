import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';

export default async function fraudRoutes(fastify) {
  fastify.addHook('preHandler', requireRoles('superadmin', 'admin'));

  fastify.get('/fraud-logs', async (req) => {
    const { severity, event_type, resolved, limit = 100 } = req.query;
    let sql = `SELECT fl.*, c.company_name AS client_name, p.name AS provider_name
               FROM fraud_logs fl LEFT JOIN clients c ON c.id = fl.client_id
               LEFT JOIN providers p ON p.id = fl.provider_id`;
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
    const { rows: summary } = await query(`
      SELECT event_type, severity, COUNT(*) AS cnt FROM fraud_logs
      WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) GROUP BY event_type, severity
    `);
    const { rows: unresolved } = await query('SELECT COUNT(*) AS total FROM fraud_logs WHERE resolved = 0');
    return { last_24h: summary, unresolved: unresolved[0]?.total || 0 };
  });

  fastify.put('/fraud-logs/:id/resolve', async (req) => {
    await query('UPDATE fraud_logs SET resolved = 1, resolved_by = ?, resolved_at = NOW(3) WHERE id = ?',
      [req.userCtx.id, req.params.id]);
    return { ok: true };
  });

  fastify.get('/ip-whitelist', async () => {
    const { rows } = await query('SELECT * FROM ip_whitelist ORDER BY ip_address');
    return { whitelist: rows };
  });

  fastify.post('/ip-whitelist', async (req, reply) => {
    const { ip_address, cidr_mask = 32, description, entity_type = 'system', entity_id } = req.body || {};
    if (!ip_address) return reply.code(400).send({ error: 'ip_address required' });
    const { insertId } = await query(
      `INSERT INTO ip_whitelist (ip_address, cidr_mask, description, entity_type, entity_id) VALUES (?, ?, ?, ?, ?)`,
      [ip_address, cidr_mask, description || null, entity_type, entity_id || null]
    );
    return reply.code(201).send({ id: insertId });
  });

  fastify.delete('/ip-whitelist/:id', async (req) => {
    await query('DELETE FROM ip_whitelist WHERE id = ?', [req.params.id]);
    return { ok: true };
  });
}
