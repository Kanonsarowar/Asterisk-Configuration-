import { query } from '../db.js';
import { cdrScopeSql } from '../lib/rbac.js';
import { cdrStats, asrFromStats } from '../lib/stats.js';
import { finalizeCdrFinancials } from '../lib/billing.js';

export default async function cdrRoutes(fastify) {
  fastify.get('/cdr', async (req) => {
    const ctx = req.userCtx;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const { where, params } = cdrScopeSql(ctx);
    const prefix = req.query.prefix ? String(req.query.prefix).replace(/%/g, '') : null;
    let sqlWhere = where;
    const p = [...params];
    if (prefix) {
      sqlWhere += ' AND destination LIKE ?';
      p.push(`${prefix}%`);
    }
    p.push(limit, offset);
    const r = await query(
      `SELECT cdr.* FROM cdr WHERE ${sqlWhere} ORDER BY cdr.created_at DESC LIMIT ? OFFSET ?`,
      p
    );
    return { cdr: r.rows, limit, offset };
  });

  fastify.get('/cdr/stats', async (req) => {
    const ctx = req.userCtx;
    const from = req.query.from;
    const to = req.query.to;
    const row = await cdrStats(ctx, from, to);
    const asr = asrFromStats(row);
    return {
      ...row,
      asr_percent: asr,
      acd_seconds: row.acd_seconds,
    };
  });

  fastify.get('/cdr/export.csv', async (req, reply) => {
    const ctx = req.userCtx;
    const { where, params } = cdrScopeSql(ctx);
    const r = await query(
      `SELECT id, call_id, uniqueid, cli, destination, start_time, answer_time, end_time, duration, billed_duration, disposition, cost, revenue, profit, supplier_id, user_id, created_at
       FROM cdr WHERE ${where} ORDER BY created_at DESC LIMIT 10000`,
      params
    );
    const headers = Object.keys(r.rows[0] || { id: '' });
    const lines = [headers.join(',')];
    for (const row of r.rows) {
      lines.push(headers.map((h) => JSON.stringify(row[h] ?? '')).join(','));
    }
    reply.header('Content-Type', 'text/csv; charset=utf-8');
    return lines.join('\n');
  });

  fastify.post('/cdr/:id/finalize', async (req, reply) => {
    if (req.userCtx.role !== 'admin') return reply.code(403).send({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const out = await finalizeCdrFinancials(id);
    if (!out) return reply.code(404).send({ error: 'Not found' });
    return out;
  });
}
