import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';
import { auditLog } from '../lib/audit.js';

export default async function didRoutes(fastify) {
  fastify.get('/dids', async (req) => {
    const ctx = req.userCtx;
    const { status, client_id, country_code, provider_id, page = 1, limit = 100 } = req.query;
    let sql = `SELECT d.*, p.name AS provider_name, c.company_name AS client_name
               FROM did_inventory d LEFT JOIN providers p ON p.id = d.provider_id
               LEFT JOIN clients c ON c.id = d.client_id`;
    const where = []; const params = [];
    if (ctx.role === 'client') { where.push('d.client_id = ?'); params.push(ctx.clientId); }
    else if (ctx.role === 'reseller') {
      where.push('(d.client_id IN (SELECT cl.id FROM clients cl JOIN users u ON u.id = cl.user_id WHERE u.parent_id = ?) OR d.client_id IS NULL)');
      params.push(ctx.id);
    }
    if (status) { where.push('d.status = ?'); params.push(status); }
    if (client_id) { where.push('d.client_id = ?'); params.push(client_id); }
    if (country_code) { where.push('d.country_code = ?'); params.push(country_code); }
    if (provider_id) { where.push('d.provider_id = ?'); params.push(provider_id); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY d.did_number';
    const off = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${off}`;
    const { rows } = await query(sql, params);
    return { dids: rows };
  });

  fastify.post('/dids', { preHandler: requireRoles('superadmin', 'admin', 'reseller') }, async (req, reply) => {
    const b = req.body || {};
    if (!b.did_number) return reply.code(400).send({ error: 'did_number required' });
    const { insertId } = await query(
      `INSERT INTO did_inventory (did_number, provider_id, country_code, city, did_type, status,
        billing_type, rate_per_minute, monthly_cost, monthly_price, setup_fee, recording, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.did_number, b.provider_id || null, b.country_code || '', b.city || '', b.did_type || 'local',
       b.status || 'available', b.billing_type || 'prepaid', b.rate_per_minute || 0,
       b.monthly_cost || 0, b.monthly_price || 0, b.setup_fee || 0, b.recording ? 1 : 0, b.notes || null]
    );
    await auditLog('did.create', req.userCtx.id, { entityType: 'did', entityId: insertId, ip: req.ip });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/dids/:id', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client') {
      const { rows } = await query('SELECT client_id FROM did_inventory WHERE id = ?', [req.params.id]);
      if (!rows.length || rows[0].client_id !== ctx.clientId) return reply.code(403).send({ error: 'Forbidden' });
    }
    const allFields = ['did_number','provider_id','client_id','country_code','city','did_type','status',
      'billing_type','rate_per_minute','monthly_cost','monthly_price','setup_fee',
      'route_type','route_target','failover_target','ivr_id','recording','notes'];
    const clientFields = ['route_type','route_target','failover_target','ivr_id'];
    const allowed = ctx.role === 'client' ? clientFields : allFields;
    const updates = []; const params = [];
    for (const f of allowed) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body?.client_id && !updates.some(u => u.startsWith('assigned_at'))) {
      updates.push('assigned_at = NOW(3)');
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE did_inventory SET ${updates.join(', ')} WHERE id = ?`, params);
    await auditLog('did.update', req.userCtx.id, { entityType: 'did', entityId: req.params.id, ip: req.ip });
    return { ok: true };
  });

  fastify.post('/dids/:id/route', async (req, reply) => {
    const { route_type, route_target, failover_target, ivr_id } = req.body || {};
    if (!route_type) return reply.code(400).send({ error: 'route_type required' });
    const ctx = req.userCtx;
    if (ctx.role === 'client') {
      const { rows } = await query('SELECT client_id FROM did_inventory WHERE id = ?', [req.params.id]);
      if (!rows.length || rows[0].client_id !== ctx.clientId) return reply.code(403).send({ error: 'Forbidden' });
    }
    await query(
      `UPDATE did_inventory SET route_type = ?, route_target = ?, failover_target = ?, ivr_id = ? WHERE id = ?`,
      [route_type, route_target || null, failover_target || null, ivr_id || null, req.params.id]
    );
    await auditLog('did.route', req.userCtx.id, { entityType: 'did', entityId: req.params.id, ip: req.ip });
    return { ok: true };
  });

  fastify.delete('/dids/:id', { preHandler: requireRoles('superadmin', 'admin') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM did_inventory WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
