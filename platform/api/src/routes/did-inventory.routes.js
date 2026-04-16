import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function didInventoryRoutes(fastify) {
  fastify.get('/did-inventory', async (req) => {
    const { status, customer_id, country_code, carrier_id, page = 1, limit = 50 } = req.query;
    const ctx = req.userCtx;
    let sql = `SELECT d.*, c.name AS carrier_name, cu.name AS customer_name
               FROM did_inventory d
               LEFT JOIN carriers c ON c.id = d.carrier_id
               LEFT JOIN customers cu ON cu.id = d.customer_id`;
    const where = []; const params = [];

    if (ctx.role === 'user' && ctx.customerId) {
      where.push('d.customer_id = ?'); params.push(ctx.customerId);
    } else if (ctx.role === 'reseller') {
      where.push('(d.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?) OR d.customer_id IS NULL)');
      params.push(ctx.id);
    }
    if (status) { where.push('d.status = ?'); params.push(status); }
    if (customer_id) { where.push('d.customer_id = ?'); params.push(customer_id); }
    if (country_code) { where.push('d.country_code = ?'); params.push(country_code); }
    if (carrier_id) { where.push('d.carrier_id = ?'); params.push(carrier_id); }

    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY d.did_number';

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;

    const { rows } = await query(sql, params);

    const countSql = `SELECT COUNT(*) AS total FROM did_inventory d` +
      (where.length ? ' WHERE ' + where.join(' AND ') : '');
    const { rows: countRows } = await query(countSql, params);

    return { dids: rows, total: countRows[0]?.total || 0, page: parseInt(page), limit: parseInt(limit) };
  });

  fastify.get('/did-inventory/:id', async (req, reply) => {
    const { rows } = await query(
      `SELECT d.*, c.name AS carrier_name, cu.name AS customer_name
       FROM did_inventory d
       LEFT JOIN carriers c ON c.id = d.carrier_id
       LEFT JOIN customers cu ON cu.id = d.customer_id
       WHERE d.id = ?`, [req.params.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'DID not found' });
    return rows[0];
  });

  fastify.post('/did-inventory', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { did_number, carrier_id, status = 'available', monthly_cost = 0, monthly_price = 0,
      setup_fee = 0, country_code = '', city = '', billing_type = 'prepaid', notes = '' } = req.body || {};
    if (!did_number) return reply.code(400).send({ error: 'did_number required' });

    const { insertId } = await query(
      `INSERT INTO did_inventory (did_number, carrier_id, status, monthly_cost, monthly_price,
        setup_fee, country_code, city, billing_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [did_number, carrier_id, status, monthly_cost, monthly_price, setup_fee, country_code, city, billing_type, notes]
    );
    await auditLog('did.create', req.userCtx?.id, { didId: insertId, did_number });
    return reply.code(201).send({ id: insertId });
  });

  fastify.post('/did-inventory/bulk', { preHandler: requireRoles('admin') }, async (req, reply) => {
    const { dids } = req.body || {};
    if (!Array.isArray(dids) || !dids.length) return reply.code(400).send({ error: 'dids array required' });

    let created = 0;
    for (const d of dids) {
      try {
        await query(
          `INSERT INTO did_inventory (did_number, carrier_id, status, monthly_cost, monthly_price,
            country_code, city, billing_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [d.did_number, d.carrier_id || null, d.status || 'available', d.monthly_cost || 0,
            d.monthly_price || 0, d.country_code || '', d.city || '', d.billing_type || 'prepaid']
        );
        created++;
      } catch (e) {
        if (e.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    await auditLog('did.bulk_create', req.userCtx?.id, { count: created });
    return { created, total: dids.length };
  });

  fastify.put('/did-inventory/:id', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'user') return reply.code(403).send({ error: 'Forbidden' });

    const id = req.params.id;
    const fields = ['did_number','carrier_id','customer_id','status','monthly_cost','monthly_price',
      'setup_fee','country_code','city','route_type','route_target','failover_target',
      'time_condition_id','billing_type','rate_card_id','notes'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (req.body?.customer_id && !updates.some(u => u.startsWith('assigned_at'))) {
      updates.push('assigned_at = NOW(3)');
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(id);
    await query(`UPDATE did_inventory SET ${updates.join(', ')} WHERE id = ?`, params);
    await auditLog('did.update', req.userCtx?.id, { didId: id });
    return { ok: true };
  });

  fastify.post('/did-inventory/:id/route', async (req, reply) => {
    const ctx = req.userCtx;
    const { route_type, route_target, failover_target, time_condition_id } = req.body || {};
    if (!route_type) return reply.code(400).send({ error: 'route_type required' });

    const { rows } = await query('SELECT * FROM did_inventory WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'DID not found' });
    const did = rows[0];
    if (ctx.role === 'user' && did.customer_id !== ctx.customerId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    await query(
      `UPDATE did_inventory SET route_type = ?, route_target = ?, failover_target = ?, time_condition_id = ? WHERE id = ?`,
      [route_type, route_target || null, failover_target || null, time_condition_id || null, req.params.id]
    );
    await auditLog('did.route', req.userCtx?.id, { didId: req.params.id, route_type, route_target });
    return { ok: true };
  });

  fastify.delete('/did-inventory/:id', { preHandler: requireRoles('admin') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM did_inventory WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    await auditLog('did.delete', req.userCtx?.id, { didId: req.params.id });
    return { ok: true };
  });
}
