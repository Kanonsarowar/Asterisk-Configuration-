import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';
import { auditLog } from '../lib/audit.js';

export default async function providerRoutes(fastify) {
  fastify.addHook('preHandler', requireRoles('superadmin', 'admin'));

  fastify.get('/providers', async (req) => {
    const { status } = req.query;
    let sql = 'SELECT * FROM providers';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY name';
    const { rows } = await query(sql, params);
    return { providers: rows };
  });

  fastify.get('/providers/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM providers WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    return rows[0];
  });

  fastify.post('/providers', async (req, reply) => {
    const b = req.body || {};
    if (!b.name || !b.host) return reply.code(400).send({ error: 'name and host required' });
    const { insertId } = await query(
      `INSERT INTO providers (name, host, port, transport, auth_type, auth_user, auth_password,
        allowed_ips, codecs, max_channels, max_cps, cost_per_minute, connection_fee, tech_prefix, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.name, b.host, b.port || 5060, b.transport || 'udp', b.auth_type || 'ip',
       b.auth_user || '', b.auth_password || '', b.allowed_ips ? JSON.stringify(b.allowed_ips) : null,
       b.codecs || 'g729,alaw,ulaw', b.max_channels || 0, b.max_cps || 0,
       b.cost_per_minute || 0, b.connection_fee || 0, b.tech_prefix || '', b.status || 'active', b.notes || null]
    );
    await auditLog('provider.create', req.userCtx.id, { entityType: 'provider', entityId: insertId, ip: req.ip });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/providers/:id', async (req, reply) => {
    const fields = ['name','host','port','transport','auth_type','auth_user','auth_password',
      'codecs','max_channels','max_cps','cost_per_minute','connection_fee','tech_prefix','quality_score','status','notes'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body?.allowed_ips !== undefined) {
      updates.push('allowed_ips = ?'); params.push(JSON.stringify(req.body.allowed_ips));
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE providers SET ${updates.join(', ')} WHERE id = ?`, params);
    await auditLog('provider.update', req.userCtx.id, { entityType: 'provider', entityId: req.params.id, ip: req.ip });
    return { ok: true };
  });

  fastify.delete('/providers/:id', async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM providers WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    await auditLog('provider.delete', req.userCtx.id, { entityType: 'provider', entityId: req.params.id, ip: req.ip });
    return { ok: true };
  });
}
