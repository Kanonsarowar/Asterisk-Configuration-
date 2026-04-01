import { query } from '../db.js';
import { cdrScopeSql } from '../lib/rbac.js';
import { cdrStats, asrFromStats } from '../lib/stats.js';

export default async function cdrRoutes(fastify) {
  fastify.get('/cdr', async (req) => {
    const ctx = req.userCtx;
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const { where, params } = cdrScopeSql(ctx);
    const base = params.length;
    const p = [...params, limit, offset];
    const r = await query(
      `SELECT cdr.* FROM cdr WHERE ${where} ORDER BY cdr.created_at DESC LIMIT $${base + 1} OFFSET $${base + 2}`,
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
}
