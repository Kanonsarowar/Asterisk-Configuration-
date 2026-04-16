import crypto from 'crypto';
import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';

export default async function sipRoutes(fastify) {
  fastify.get('/sip-accounts', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT sa.*, c.company_name AS client_name FROM sip_accounts sa LEFT JOIN clients c ON c.id = sa.client_id';
    const where = []; const params = [];
    if (ctx.role === 'client') { where.push('sa.client_id = ?'); params.push(ctx.clientId); }
    else if (ctx.role === 'reseller') {
      where.push('sa.client_id IN (SELECT cl.id FROM clients cl JOIN users u ON u.id = cl.user_id WHERE u.parent_id = ?)');
      params.push(ctx.id);
    }
    if (req.query.client_id) { where.push('sa.client_id = ?'); params.push(req.query.client_id); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY sa.name';
    const { rows } = await query(sql, params);
    return { sip_accounts: rows };
  });

  fastify.post('/sip-accounts', async (req, reply) => {
    const ctx = req.userCtx;
    const b = req.body || {};
    const clientId = ctx.role === 'client' ? ctx.clientId : b.client_id;
    if (!clientId || !b.name) return reply.code(400).send({ error: 'client_id and name required' });

    const sipUser = b.username || `sip_${crypto.randomBytes(4).toString('hex')}`;
    const sipPass = b.password || crypto.randomBytes(16).toString('base64url');

    const { insertId } = await query(
      `INSERT INTO sip_accounts (client_id, name, username, password, allowed_ips, codecs, max_channels, transport, nat)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clientId, b.name, sipUser, sipPass, b.allowed_ips ? JSON.stringify(b.allowed_ips) : null,
       b.codecs || 'g729,alaw,ulaw', b.max_channels || 2, b.transport || 'udp', b.nat !== false ? 1 : 0]
    );
    return reply.code(201).send({ id: insertId, username: sipUser, password: sipPass });
  });

  fastify.put('/sip-accounts/:id', async (req, reply) => {
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
    await query(`UPDATE sip_accounts SET ${updates.join(', ')} WHERE id = ?`, params);
    return { ok: true };
  });

  fastify.delete('/sip-accounts/:id', { preHandler: requireRoles('superadmin', 'admin', 'reseller') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM sip_accounts WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
