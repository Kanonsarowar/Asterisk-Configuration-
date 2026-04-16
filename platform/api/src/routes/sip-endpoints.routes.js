import { query } from '../db.js';
import { requireRoles, canAccessCustomer } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';
import crypto from 'crypto';

export default async function sipEndpointRoutes(fastify) {
  fastify.get('/sip-endpoints', async (req) => {
    const ctx = req.userCtx;
    let sql = `SELECT se.*, cu.name AS customer_name FROM sip_endpoints se
               LEFT JOIN customers cu ON cu.id = se.customer_id`;
    const where = []; const params = [];

    if (ctx.role === 'user' && ctx.customerId) {
      where.push('se.customer_id = ?'); params.push(ctx.customerId);
    } else if (ctx.role === 'reseller') {
      where.push('se.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?)');
      params.push(ctx.id);
    }
    if (req.query.customer_id) { where.push('se.customer_id = ?'); params.push(req.query.customer_id); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY se.name';
    const { rows } = await query(sql, params);
    return { endpoints: rows };
  });

  fastify.post('/sip-endpoints', async (req, reply) => {
    const ctx = req.userCtx;
    const { customer_id, name, username, password, allowed_ips, codecs = 'g729,alaw,ulaw',
      max_channels = 2, transport = 'udp', nat = true } = req.body || {};
    if (!customer_id || !name) return reply.code(400).send({ error: 'customer_id and name required' });

    if (ctx.role !== 'admin') {
      const ok = await canAccessCustomer(ctx, customer_id);
      if (!ok) return reply.code(403).send({ error: 'Forbidden' });
    }

    const sipUser = username || `sip_${crypto.randomBytes(4).toString('hex')}`;
    const sipPass = password || crypto.randomBytes(12).toString('base64url');

    const { insertId } = await query(
      `INSERT INTO sip_endpoints (customer_id, name, username, password, allowed_ips, codecs, max_channels, transport, nat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [customer_id, name, sipUser, sipPass, allowed_ips ? JSON.stringify(allowed_ips) : null,
        codecs, max_channels, transport, nat ? 1 : 0]
    );
    await auditLog('sip_endpoint.create', ctx.id, { endpointId: insertId, customer_id });
    return reply.code(201).send({ id: insertId, username: sipUser, password: sipPass });
  });

  fastify.put('/sip-endpoints/:id', async (req, reply) => {
    const ctx = req.userCtx;
    const { rows } = await query('SELECT * FROM sip_endpoints WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    if (ctx.role !== 'admin') {
      const ok = await canAccessCustomer(ctx, rows[0].customer_id);
      if (!ok) return reply.code(403).send({ error: 'Forbidden' });
    }

    const fields = ['name','password','codecs','max_channels','transport','nat','status'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body?.allowed_ips !== undefined) {
      updates.push('allowed_ips = ?'); params.push(JSON.stringify(req.body.allowed_ips));
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE sip_endpoints SET ${updates.join(', ')} WHERE id = ?`, params);
    return { ok: true };
  });

  fastify.delete('/sip-endpoints/:id', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM sip_endpoints WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
