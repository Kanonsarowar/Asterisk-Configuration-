import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { getBillingSettings, setBillingSettings } from '../lib/settings.js';
import { auditLog } from '../lib/audit.js';

export default async function billingRoutes(fastify) {
  fastify.get('/billing/settings', {
    preHandler: [requireRoles('admin')],
  }, async () => {
    return await getBillingSettings();
  });

  fastify.put('/billing/settings', {
    preHandler: [requireRoles('admin')],
  }, async (req) => {
    const ctx = req.userCtx;
    const next = await setBillingSettings(req.body || {});
    await auditLog('billing_settings', ctx.id, next);
    return next;
  });

  fastify.post('/billing/invoices', {
    preHandler: [requireRoles('admin')],
    schema: {
      body: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'integer' },
          period_start: { type: 'string' },
          period_end: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const userId = req.body.user_id;
    const ps = req.body.period_start || null;
    const pe = req.body.period_end || null;
    const sum = await query(
      `SELECT COALESCE(SUM(revenue), 0) AS total FROM cdr WHERE user_id = ? AND created_at >= ? AND created_at < ?`,
      [userId, ps || '1970-01-01 00:00:00', pe || '9999-12-31 23:59:59']
    );
    const total = Number(sum.rows[0]?.total) || 0;
    const ins = await query(
      `INSERT INTO invoices (user_id, total_amount, status, period_start, period_end) VALUES (?, ?, 'issued', ?, ?)`,
      [userId, total, ps, pe]
    );
    const invId = ins.insertId;
    const lines = await query(
      `SELECT id, revenue, destination FROM cdr WHERE user_id = ? AND created_at >= ? AND created_at < ? LIMIT 5000`,
      [userId, ps || '1970-01-01 00:00:00', pe || '9999-12-31 23:59:59']
    );
    for (const row of lines.rows) {
      await query(
        `INSERT INTO invoice_lines (invoice_id, cdr_id, description, amount) VALUES (?, ?, ?, ?)`,
        [invId, row.id, `CDR ${row.destination}`, row.revenue]
      );
    }
    await auditLog('invoice_create', ctx.id, { invoiceId: invId, userId });
    const inv = await query('SELECT * FROM invoices WHERE id = ?', [invId]);
    return inv.rows[0];
  });

  fastify.get('/billing/invoices', async (req) => {
    const ctx = req.userCtx;
    if (ctx.role === 'admin') {
      const r = await query('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 200');
      return { invoices: r.rows };
    }
    const r = await query('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC', [ctx.id]);
    return { invoices: r.rows };
  });
}
