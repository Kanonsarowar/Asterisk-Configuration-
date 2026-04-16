import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function carrierRoutes(fastify) {
  fastify.addHook('preHandler', requireRoles('admin'));

  fastify.get('/carriers', async (req) => {
    const { status } = req.query;
    let sql = 'SELECT * FROM carriers';
    const params = [];
    if (status) { sql += ' WHERE status = ?'; params.push(status); }
    sql += ' ORDER BY name';
    const { rows } = await query(sql, params);
    return { carriers: rows };
  });

  fastify.get('/carriers/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM carriers WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Carrier not found' });
    return rows[0];
  });

  fastify.post('/carriers', async (req, reply) => {
    const { name, host, port = 5060, transport = 'udp', auth_type = 'ip', username = '',
      password = '', allowed_ips, codecs = 'g729,alaw,ulaw', max_channels = 0,
      cps_limit = 0, cost_per_minute = 0, connection_fee = 0, status = 'active', notes = '' } = req.body || {};
    if (!name || !host) return reply.code(400).send({ error: 'name and host required' });

    const { insertId } = await query(
      `INSERT INTO carriers (name, host, port, transport, auth_type, username, password,
        allowed_ips, codecs, max_channels, cps_limit, cost_per_minute, connection_fee, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, host, port, transport, auth_type, username, password,
        allowed_ips ? JSON.stringify(allowed_ips) : null, codecs, max_channels,
        cps_limit, cost_per_minute, connection_fee, status, notes]
    );
    await auditLog('carrier.create', req.userCtx?.id, { carrierId: insertId, name });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/carriers/:id', async (req, reply) => {
    const id = req.params.id;
    const fields = ['name','host','port','transport','auth_type','username','password',
      'codecs','max_channels','cps_limit','cost_per_minute','connection_fee','status','notes'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body?.allowed_ips !== undefined) {
      updates.push('allowed_ips = ?');
      params.push(JSON.stringify(req.body.allowed_ips));
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields to update' });
    params.push(id);
    await query(`UPDATE carriers SET ${updates.join(', ')} WHERE id = ?`, params);
    await auditLog('carrier.update', req.userCtx?.id, { carrierId: id });
    return { ok: true };
  });

  fastify.delete('/carriers/:id', async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM carriers WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    await auditLog('carrier.delete', req.userCtx?.id, { carrierId: req.params.id });
    return { ok: true };
  });
}
