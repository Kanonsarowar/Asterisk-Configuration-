import { query } from '../db.js';
import { numbersScopeSql, cdrScopeSql } from '../lib/rbac.js';
import { cdrStats, asrFromStats } from '../lib/stats.js';

function utcDayStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0)).toISOString();
}

export default async function dashboardRoutes(fastify) {
  fastify.get('/dashboard/summary', async (req) => {
    const ctx = req.userCtx;
    const startDay = utcDayStart();
    const now = new Date().toISOString();
    const dayStats = await cdrStats(ctx, startDay, now);

    const { where, params } = numbersScopeSql(ctx);
    const cnt = await query(`SELECT COUNT(*)::int AS n FROM numbers n WHERE ${where}`, params);

    const { where: cw, params: cp } = cdrScopeSql(ctx);
    const recent = await query(
      `SELECT COUNT(*)::int AS n FROM cdr WHERE ${cw} AND created_at >= NOW() - INTERVAL '24 hours'`,
      cp
    );

    return {
      revenue_today: Number(dayStats.revenue) || 0,
      cost_today: Number(dayStats.cost) || 0,
      profit_today: Number(dayStats.profit) || 0,
      asr_percent: asrFromStats(dayStats),
      acd_seconds: Number(dayStats.acd_seconds) || 0,
      total_numbers: cnt.rows[0]?.n ?? 0,
      calls_24h: recent.rows[0]?.n ?? 0,
      active_calls: null,
      active_calls_note: 'Wire Asterisk AMI or `core show channels` poller to populate active_calls',
      system_status: 'ok',
    };
  });
}
