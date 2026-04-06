import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';
import { scheduleAsteriskSync } from '../services/autoSync.js';

export default async function suppliersRoutes(fastify) {
  fastify.get('/suppliers', async (req, reply) => {
    if (req.userCtx.role === 'user') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const r = await query(
      `SELECT id, name, host, port, username, protocol, active, cost_per_minute, routing_priority, created_at
       FROM suppliers ORDER BY routing_priority ASC, name`
    );
    return { suppliers: r.rows };
  });

  fastify.post('/suppliers', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const b = req.body || {};
    if (!b.name || !b.host) return reply.code(400).send({ error: 'name and host required' });
    const ins = await query(
      `INSERT INTO suppliers (name, host, port, username, password, protocol, active, cost_per_minute, routing_priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(b.name).slice(0, 255),
        String(b.host).slice(0, 255),
        parseInt(b.port, 10) || 5060,
        String(b.username || '').slice(0, 255),
        String(b.password || ''),
        b.protocol === 'sip' ? 'sip' : 'pjsip',
        b.active === false ? 0 : 1,
        Number(b.cost_per_minute) || 0,
        parseInt(b.routing_priority, 10) || 100,
      ]
    );
    const id = ins.insertId;
    const r = await query(
      `SELECT id, name, host, port, username, protocol, active, cost_per_minute, routing_priority, created_at
       FROM suppliers WHERE id = ?`,
      [id]
    );
    await auditLog('supplier_create', ctx.id, { id });
    scheduleAsteriskSync();
    return r.rows[0];
  });

  fastify.put('/suppliers/:id', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const cur = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!cur.rows[0]) return reply.code(404).send({ error: 'Not found' });
    const row = cur.rows[0];
    const name = b.name != null ? String(b.name).slice(0, 255) : row.name;
    const host = b.host != null ? String(b.host).slice(0, 255) : row.host;
    const port = b.port != null ? parseInt(b.port, 10) : row.port;
    const username = b.username != null ? String(b.username).slice(0, 255) : row.username;
    const password =
      b.password != null && String(b.password) !== '' ? String(b.password) : row.password;
    const protocol = b.protocol === 'sip' || b.protocol === 'pjsip' ? b.protocol : row.protocol;
    const active = b.active === false ? 0 : b.active === true ? 1 : row.active;
    const cost =
      b.cost_per_minute != null ? Number(b.cost_per_minute) : row.cost_per_minute;
    const rp =
      b.routing_priority != null ? parseInt(b.routing_priority, 10) : row.routing_priority;
    await query(
      `UPDATE suppliers SET name = ?, host = ?, port = ?, username = ?, password = ?, protocol = ?, active = ?, cost_per_minute = ?, routing_priority = ? WHERE id = ?`,
      [name, host, port, username, password, protocol, active, cost, rp, id]
    );
    const r = await query(
      `SELECT id, name, host, port, username, protocol, active, cost_per_minute, routing_priority, created_at FROM suppliers WHERE id = ?`,
      [id]
    );
    scheduleAsteriskSync();
    return r.rows[0];
  });
}
