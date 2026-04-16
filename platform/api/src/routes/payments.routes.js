import { query } from '../db.js';
import { requireRoles, canAccessCustomer } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function paymentRoutes(fastify) {
  fastify.get('/payments', async (req) => {
    const ctx = req.userCtx;
    let sql = `SELECT p.*, cu.name AS customer_name FROM payments p
               LEFT JOIN customers cu ON cu.id = p.customer_id`;
    const where = []; const params = [];
    if (ctx.role === 'user' && ctx.customerId) {
      where.push('p.customer_id = ?'); params.push(ctx.customerId);
    } else if (ctx.role === 'reseller') {
      where.push('p.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?)');
      params.push(ctx.id);
    }
    if (req.query.customer_id) { where.push('p.customer_id = ?'); params.push(req.query.customer_id); }
    if (req.query.status) { where.push('p.status = ?'); params.push(req.query.status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY p.created_at DESC LIMIT 500';
    const { rows } = await query(sql, params);
    return { payments: rows };
  });

  fastify.post('/payments', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { customer_id, amount, currency = 'USD', method = 'manual', reference, notes, apply_balance = true } = req.body || {};
    if (!customer_id || !amount) return reply.code(400).send({ error: 'customer_id and amount required' });

    const { insertId } = await query(
      `INSERT INTO payments (customer_id, user_id, amount, currency, method, reference, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')`,
      [customer_id, req.userCtx?.id, amount, currency, method, reference || null, notes || null]
    );

    if (apply_balance) {
      const { rows } = await query('SELECT user_id FROM customers WHERE id = ?', [customer_id]);
      if (rows[0]?.user_id) {
        await query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, rows[0].user_id]);
      }
    }

    await auditLog('payment.create', req.userCtx?.id, { paymentId: insertId, customer_id, amount });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/payments/:id/status', { preHandler: requireRoles('admin') }, async (req, reply) => {
    const { status } = req.body || {};
    if (!['pending','completed','failed','refunded'].includes(status)) {
      return reply.code(400).send({ error: 'Invalid status' });
    }
    await query('UPDATE payments SET status = ? WHERE id = ?', [status, req.params.id]);
    await auditLog('payment.status', req.userCtx?.id, { paymentId: req.params.id, status });
    return { ok: true };
  });
}
