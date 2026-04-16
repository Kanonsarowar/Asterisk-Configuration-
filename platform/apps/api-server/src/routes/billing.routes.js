import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';
import { generateInvoice, addBalance, getBillingSettings } from '../../../../packages/billing/index.js';
import { auditLog } from '../lib/audit.js';

export default async function billingRoutes(fastify) {
  fastify.get('/billing/settings', { preHandler: requireRoles('superadmin', 'admin') }, async () => {
    return getBillingSettings();
  });

  fastify.put('/billing/settings', { preHandler: requireRoles('superadmin', 'admin') }, async (req) => {
    const current = await getBillingSettings();
    const merged = { ...current, ...req.body };
    await query("UPDATE system_settings SET svalue = ? WHERE skey = 'billing'", [JSON.stringify(merged)]);
    return { ok: true };
  });

  fastify.get('/invoices', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT i.*, c.company_name AS client_name FROM invoices i LEFT JOIN clients c ON c.id = i.client_id';
    const where = []; const params = [];
    if (ctx.role === 'client') { where.push('i.client_id = ?'); params.push(ctx.clientId); }
    if (req.query.status) { where.push('i.status = ?'); params.push(req.query.status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY i.created_at DESC';
    const { rows } = await query(sql, params);
    return { invoices: rows };
  });

  fastify.get('/invoices/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const ctx = req.userCtx;
    if (ctx.role === 'client' && rows[0].client_id !== ctx.clientId) return reply.code(403).send({ error: 'Forbidden' });
    const { rows: lines } = await query('SELECT * FROM invoice_lines WHERE invoice_id = ?', [req.params.id]);
    return { ...rows[0], lines };
  });

  fastify.post('/invoices', { preHandler: requireRoles('superadmin', 'admin') }, async (req, reply) => {
    const { client_id, period_start, period_end } = req.body || {};
    if (!client_id || !period_start || !period_end) return reply.code(400).send({ error: 'client_id, period_start, period_end required' });
    const result = await generateInvoice(client_id, period_start, period_end);
    await auditLog('invoice.generate', req.userCtx.id, { entityType: 'invoice', entityId: result.invoiceId, ip: req.ip });
    return reply.code(201).send(result);
  });

  fastify.get('/payments', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT p.*, c.company_name AS client_name FROM payments p LEFT JOIN clients c ON c.id = p.client_id';
    const where = []; const params = [];
    if (ctx.role === 'client') { where.push('p.client_id = ?'); params.push(ctx.clientId); }
    if (req.query.client_id) { where.push('p.client_id = ?'); params.push(req.query.client_id); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY p.created_at DESC LIMIT 500';
    const { rows } = await query(sql, params);
    return { payments: rows };
  });

  fastify.post('/payments', { preHandler: requireRoles('superadmin', 'admin', 'reseller') }, async (req, reply) => {
    const { client_id, amount, currency = 'USD', method = 'manual', reference, invoice_id, notes } = req.body || {};
    if (!client_id || !amount) return reply.code(400).send({ error: 'client_id and amount required' });
    const { insertId } = await query(
      `INSERT INTO payments (client_id, amount, currency, method, reference, invoice_id, status, processed_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?)`,
      [client_id, amount, currency, method, reference || null, invoice_id || null, req.userCtx.id, notes || null]
    );
    await addBalance(client_id, amount);
    if (invoice_id) {
      await query("UPDATE invoices SET status = 'paid' WHERE id = ?", [invoice_id]);
    }
    await auditLog('payment.create', req.userCtx.id, { entityType: 'payment', entityId: insertId, ip: req.ip,
      newValues: { client_id, amount } });
    return reply.code(201).send({ id: insertId });
  });
}
