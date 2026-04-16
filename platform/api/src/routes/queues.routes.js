import { query } from '../db.js';
import { requireRoles, canAccessCustomer } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function queueRoutes(fastify) {
  fastify.get('/queues', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT q.*, cu.name AS customer_name FROM call_queues q LEFT JOIN customers cu ON cu.id = q.customer_id';
    const where = []; const params = [];
    if (ctx.role === 'user' && ctx.customerId) {
      where.push('q.customer_id = ?'); params.push(ctx.customerId);
    } else if (ctx.role === 'reseller') {
      where.push('(q.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?) OR q.customer_id IS NULL)');
      params.push(ctx.id);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY q.name';
    const { rows } = await query(sql, params);
    return { queues: rows };
  });

  fastify.get('/queues/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM call_queues WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const { rows: members } = await query(
      `SELECT qm.*, se.name AS endpoint_name FROM queue_members qm
       LEFT JOIN sip_endpoints se ON se.id = qm.endpoint_id WHERE qm.queue_id = ?`,
      [req.params.id]
    );
    return { ...rows[0], members };
  });

  fastify.post('/queues', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { customer_id, name, strategy = 'ringall', timeout = 30, max_wait = 300,
      wrapup_time = 5, music_on_hold = 'default', announce_frequency = 30 } = req.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });

    const { insertId } = await query(
      `INSERT INTO call_queues (customer_id, name, strategy, timeout, max_wait, wrapup_time, music_on_hold, announce_frequency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id || null, name, strategy, timeout, max_wait, wrapup_time, music_on_hold, announce_frequency]
    );
    await auditLog('queue.create', req.userCtx?.id, { queueId: insertId, name });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/queues/:id', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const fields = ['name','strategy','timeout','max_wait','wrapup_time','music_on_hold','announce_frequency','status'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE call_queues SET ${updates.join(', ')} WHERE id = ?`, params);
    return { ok: true };
  });

  fastify.post('/queues/:id/members', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { endpoint_id, interface: iface, penalty = 0 } = req.body || {};
    if (!iface) return reply.code(400).send({ error: 'interface required' });
    const { insertId } = await query(
      `INSERT INTO queue_members (queue_id, endpoint_id, interface, penalty) VALUES (?, ?, ?, ?)`,
      [req.params.id, endpoint_id || null, iface, penalty]
    );
    return reply.code(201).send({ id: insertId });
  });

  fastify.delete('/queues/:id/members/:memberId', { preHandler: requireRoles('admin', 'reseller') }, async (req) => {
    await query('DELETE FROM queue_members WHERE id = ? AND queue_id = ?', [req.params.memberId, req.params.id]);
    return { ok: true };
  });

  fastify.delete('/queues/:id', { preHandler: requireRoles('admin') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM call_queues WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
