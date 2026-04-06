import { query } from '../db.js';
import { numbersScopeSql, cdrScopeSql } from '../lib/rbac.js';
import { cdrStats, asrFromStats } from '../lib/stats.js';

function utcDayStartMysql() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day} 00:00:00`;
}

export default async function dashboardRoutes(fastify) {
  fastify.get('/dashboard/summary', async (req) => {
    const ctx = req.userCtx;
    const startDay = utcDayStartMysql();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const dayStats = await cdrStats(ctx, startDay, now);

    const { where, params } = numbersScopeSql(ctx);
    const cnt = await query(`SELECT COUNT(*) AS n FROM numbers n WHERE ${where}`, params);

    const { where: cw, params: cp } = cdrScopeSql(ctx);
    const recent = await query(
      `SELECT COUNT(*) AS n FROM cdr WHERE ${cw} AND created_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR`,
      cp
    );

    const live = await query('SELECT COUNT(*) AS n FROM live_calls WHERE last_seen_at >= UTC_TIMESTAMP() - INTERVAL 2 MINUTE');

    return {
      revenue_today: Number(dayStats.revenue) || 0,
      cost_today: Number(dayStats.cost) || 0,
      profit_today: Number(dayStats.profit) || 0,
      asr_percent: asrFromStats(dayStats),
      acd_seconds: Number(dayStats.acd_seconds) || 0,
      total_numbers: cnt.rows[0]?.n ?? 0,
      calls_24h: recent.rows[0]?.n ?? 0,
      active_calls: live.rows[0]?.n ?? 0,
      system_status: 'ok',
    };
  });
}
