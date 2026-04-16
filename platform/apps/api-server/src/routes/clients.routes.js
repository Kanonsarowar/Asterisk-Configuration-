import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';
import { auditLog } from '../lib/audit.js';

export default async function clientRoutes(fastify) {
  fastify.get('/clients', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT c.*, u.username FROM clients c JOIN users u ON u.id = c.user_id';
    const where = []; const params = [];
    if (ctx.role === 'client') {
      where.push('c.id = ?'); params.push(ctx.clientId);
    } else if (ctx.role === 'reseller') {
      where.push('u.parent_id = ?'); params.push(ctx.id);
    }
    if (req.query.status) { where.push('c.status = ?'); params.push(req.query.status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY c.company_name';
    const { rows } = await query(sql, params);
    return { clients: rows };
  });

  fastify.get('/clients/:id', async (req, reply) => {
    const { rows } = await query('SELECT c.*, u.username FROM clients c JOIN users u ON u.id = c.user_id WHERE c.id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const ctx = req.userCtx;
    if (ctx.role === 'client' && rows[0].id !== ctx.clientId) return reply.code(403).send({ error: 'Forbidden' });
    return rows[0];
  });

  fastify.post('/clients', { preHandler: requireRoles('superadmin', 'admin', 'reseller') }, async (req, reply) => {
    const { company_name, contact_name, contact_email, contact_phone, address, tax_id,
      billing_type = 'prepaid', credit_limit = 0, currency = 'USD', username, password, notes } = req.body || {};
    if (!company_name || !username || !password) {
      return reply.code(400).send({ error: 'company_name, username, password required' });
    }

    const { hashPassword } = await import('../../../../packages/auth/index.js');
    const hash = await hashPassword(password);
    const parentId = req.userCtx.role === 'reseller' ? req.userCtx.id : null;

    const { insertId: userId } = await query(
      `INSERT INTO users (username, email, password_hash, role, status, parent_id) VALUES (?, ?, ?, 'client', 'active', ?)`,
      [username, contact_email || null, hash, parentId]
    );

    const { insertId: clientId } = await query(
      `INSERT INTO clients (user_id, company_name, contact_name, contact_email, contact_phone, address, tax_id,
        billing_type, credit_limit, currency, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, company_name, contact_name || null, contact_email || null, contact_phone || null,
       address || null, tax_id || null, billing_type, credit_limit, currency, notes || null]
    );

    await auditLog('client.create', req.userCtx.id, { entityType: 'client', entityId: clientId, ip: req.ip });
    return reply.code(201).send({ id: clientId, userId });
  });

  fastify.put('/clients/:id', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client' && Number(req.params.id) !== ctx.clientId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const adminFields = ['billing_type','credit_limit','rate_card_id','status'];
    const fields = ['company_name','contact_name','contact_email','contact_phone','address','tax_id','currency','notes'];
    if (ctx.isAdmin || ctx.role === 'reseller') fields.push(...adminFields);

    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields to update' });
    params.push(req.params.id);
    await query(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`, params);
    await auditLog('client.update', ctx.id, { entityType: 'client', entityId: req.params.id, ip: req.ip });
    return { ok: true };
  });
}
