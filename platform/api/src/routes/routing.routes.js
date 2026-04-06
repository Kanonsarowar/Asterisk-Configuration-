import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';
import { scheduleAsteriskSync } from '../services/autoSync.js';

export default async function routingRoutes(fastify) {
  fastify.get('/routes', async (req, reply) => {
    if (req.userCtx.role === 'user') return { routes: [] };
    const prefix = req.query.prefix ? String(req.query.prefix) : null;
    if (prefix) {
      const r = await query(
        `SELECT r.*, s.name AS supplier_name
         FROM routes r JOIN suppliers s ON s.id = r.supplier_id
         WHERE r.prefix = ?
         ORDER BY r.priority ASC, r.id`,
        [prefix.slice(0, 32)]
      );
      return { routes: r.rows };
    }
    const r = await query(
      `SELECT r.*, s.name AS supplier_name
       FROM routes r JOIN suppliers s ON s.id = r.supplier_id
       ORDER BY r.prefix, r.priority, r.id`
    );
    return { routes: r.rows };
  });

  fastify.post('/routes', {
    preHandler: [requireRoles('admin')],
    schema: {
      body: {
        type: 'object',
        required: ['prefix', 'supplier_id'],
        properties: {
          prefix: { type: 'string' },
          supplier_id: { type: 'integer' },
          priority: { type: 'integer' },
          rate: { type: 'number' },
          active: { type: 'boolean' },
          allowed_cli_regex: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const b = req.body;
    const ins = await query(
      `INSERT INTO routes (prefix, supplier_id, priority, rate, active, allowed_cli_regex)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(b.prefix).slice(0, 32),
        b.supplier_id,
        b.priority != null ? parseInt(b.priority, 10) : 0,
        Number(b.rate) || 0,
        b.active === false ? 0 : 1,
        b.allowed_cli_regex ? String(b.allowed_cli_regex).slice(0, 512) : null,
      ]
    );
    const id = ins.insertId;
    const r = await query(
      `SELECT r.*, s.name AS supplier_name FROM routes r JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = ?`,
      [id]
    );
    await auditLog('route_create', ctx.id, { id });
    scheduleAsteriskSync();
    return r.rows[0];
  });

  fastify.put('/routes/:id', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const cur = await query('SELECT * FROM routes WHERE id = ?', [id]);
    if (!cur.rows[0]) return reply.code(404).send({ error: 'Not found' });
    const row = cur.rows[0];
    const prefix = b.prefix != null ? String(b.prefix).slice(0, 32) : row.prefix;
    const supplierId = b.supplier_id != null ? b.supplier_id : row.supplier_id;
    const priority = b.priority != null ? parseInt(b.priority, 10) : row.priority;
    const rate = b.rate != null ? Number(b.rate) : row.rate;
    const active = b.active === false ? 0 : b.active === true ? 1 : row.active;
    const allowed =
      b.allowed_cli_regex !== undefined
        ? b.allowed_cli_regex
          ? String(b.allowed_cli_regex).slice(0, 512)
          : null
        : row.allowed_cli_regex;
    await query(
      `UPDATE routes SET prefix = ?, supplier_id = ?, priority = ?, rate = ?, active = ?, allowed_cli_regex = ? WHERE id = ?`,
      [prefix, supplierId, priority, rate, active, allowed, id]
    );
    const r = await query(
      `SELECT r.*, s.name AS supplier_name FROM routes r JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = ?`,
      [id]
    );
    scheduleAsteriskSync();
    return r.rows[0];
  });

  fastify.delete('/routes/:id', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const id = parseInt(req.params.id, 10);
    const r = await query('DELETE FROM routes WHERE id = ?', [id]);
    if (!r.affectedRows) return reply.code(404).send({ error: 'Not found' });
    await auditLog('route_delete', ctx.id, { id });
    scheduleAsteriskSync();
    return { ok: true };
  });
}
