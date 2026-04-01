import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function suppliersRoutes(fastify) {
  fastify.get('/suppliers', async (req, reply) => {
    if (req.userCtx.role === 'client') {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const r = await query('SELECT id, name, sip_host, sip_username, cost_per_minute, routing_priority, created_at FROM suppliers ORDER BY routing_priority ASC, name');
    return { suppliers: r.rows };
  });

  fastify.post('/suppliers', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const b = req.body || {};
    if (!b.name || !b.sip_host) return reply.code(400).send({ error: 'name and sip_host required' });
    const r = await query(
      `INSERT INTO suppliers (name, sip_host, sip_username, sip_password, cost_per_minute, routing_priority)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, name, sip_host, sip_username, cost_per_minute, routing_priority, created_at`,
      [
        String(b.name).slice(0, 255),
        String(b.sip_host).slice(0, 255),
        String(b.sip_username || '').slice(0, 255),
        String(b.sip_password || ''),
        Number(b.cost_per_minute) || 0,
        parseInt(b.routing_priority, 10) || 100,
      ]
    );
    await auditLog('supplier_create', ctx.id, { id: r.rows[0].id });
    return r.rows[0];
  });

  fastify.put('/suppliers/:id', {
    preHandler: [requireRoles('admin')],
  }, async (req, reply) => {
    const id = parseInt(req.params.id, 10);
    const b = req.body || {};
    const r = await query(
      `UPDATE suppliers SET
        name = COALESCE($1, name),
        sip_host = COALESCE($2, sip_host),
        sip_username = COALESCE($3, sip_username),
        sip_password = CASE WHEN $4::text IS NOT NULL AND $4::text <> '' THEN $4 ELSE sip_password END,
        cost_per_minute = COALESCE($5, cost_per_minute),
        routing_priority = COALESCE($6, routing_priority)
       WHERE id = $7
       RETURNING id, name, sip_host, sip_username, cost_per_minute, routing_priority, created_at`,
      [
        b.name ?? null,
        b.sip_host ?? null,
        b.sip_username ?? null,
        b.sip_password ?? null,
        b.cost_per_minute ?? null,
        b.routing_priority != null ? parseInt(b.routing_priority, 10) : null,
        id,
      ]
    );
    if (!r.rows[0]) return reply.code(404).send({ error: 'Not found' });
    return r.rows[0];
  });
}
