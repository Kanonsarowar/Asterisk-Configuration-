import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { getBillingSettings, setBillingSettings } from '../lib/settings.js';
import { auditLog } from '../lib/audit.js';
import { buildUserInvoiceSummary, resolveBillingCurrency } from '../lib/billing.js';

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

  fastify.get('/billing/invoice-summary', {
    preHandler: [requireRoles('admin', 'reseller', 'user')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    let userId = ctx.id;
    if (ctx.role === 'admin' && req.query.user_id != null) {
      userId = parseInt(String(req.query.user_id), 10);
    } else if (ctx.role === 'reseller' && req.query.user_id != null) {
      const target = parseInt(String(req.query.user_id), 10);
      const ok = await query(
        `SELECT 1 FROM users WHERE id = ? AND parent_user_id = ? LIMIT 1`,
        [target, ctx.id]
      );
      if (ok.rows.length) userId = target;
      else return reply.code(403).send({ error: 'Forbidden' });
    }
    if (!Number.isFinite(userId)) {
      return reply.code(400).send({ error: 'Invalid user' });
    }
    if (ctx.role === 'user' && userId !== ctx.id) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const ps = req.query.period_start || null;
    const pe = req.query.period_end || null;
    const summary = await buildUserInvoiceSummary(userId, ps, pe);
    const u = await query(`SELECT username, billing_currency FROM users WHERE id = ?`, [userId]);
    summary.user = u.rows[0] || null;
    return summary;
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
    const settings = await getBillingSettings();
    const urow = (await query(`SELECT billing_currency FROM users WHERE id = ?`, [userId])).rows[0];
    const currency = resolveBillingCurrency(urow?.billing_currency, settings);

    const bounds = {
      ps: ps || '1970-01-01 00:00:00',
      pe: pe || '9999-12-31 23:59:59',
    };

    const sum = await query(
      `SELECT COALESCE(SUM(revenue), 0) AS total FROM cdr
       WHERE user_id = ? AND financials_applied_at IS NOT NULL AND created_at >= ? AND created_at < ?`,
      [userId, bounds.ps, bounds.pe]
    );
    const total = Number(sum.rows[0]?.total) || 0;

    const summary = await buildUserInvoiceSummary(userId, bounds.ps, bounds.pe);
    summary.currency = currency;

    const ins = await query(
      `INSERT INTO invoices (user_id, total_amount, currency, status, period_start, period_end, summary_json)
       VALUES (?, ?, ?, 'issued', ?, ?, CAST(? AS JSON))`,
      [userId, total, currency, ps, pe, JSON.stringify(summary)]
    );
    const invId = ins.insertId;

    const lines = await query(
      `SELECT id, revenue, destination FROM cdr
       WHERE user_id = ? AND financials_applied_at IS NOT NULL AND created_at >= ? AND created_at < ? LIMIT 5000`,
      [userId, bounds.ps, bounds.pe]
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
      const uid = req.query.user_id != null ? parseInt(String(req.query.user_id), 10) : null;
      if (Number.isFinite(uid)) {
        const r = await query('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 200', [uid]);
        return { invoices: r.rows };
      }
      const r = await query('SELECT * FROM invoices ORDER BY created_at DESC LIMIT 200');
      return { invoices: r.rows };
    }
    const r = await query('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC', [ctx.id]);
    return { invoices: r.rows };
  });
}
