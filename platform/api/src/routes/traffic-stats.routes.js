import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';

export default async function trafficStatsRoutes(fastify) {
  fastify.get('/traffic/summary', async (req) => {
    const ctx = req.userCtx;
    const hours = parseInt(req.query.hours) || 24;
    const interval = `DATE_SUB(NOW(), INTERVAL ${hours} HOUR)`;

    const scope = ctx.role === 'admin' ? 'TRUE'
      : ctx.role === 'reseller'
        ? `cdr.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ${ctx.id})`
        : ctx.customerId ? `cdr.customer_id = ${ctx.customerId}` : 'FALSE';

    const { rows: summary } = await query(`
      SELECT
        COUNT(*) AS total_calls,
        SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
        SUM(CASE WHEN disposition != 'ANSWERED' THEN 1 ELSE 0 END) AS failed,
        ROUND(SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1) * 100, 2) AS asr,
        ROUND(AVG(CASE WHEN disposition = 'ANSWERED' THEN duration ELSE NULL END), 1) AS acd,
        SUM(revenue) AS total_revenue,
        SUM(cost) AS total_cost,
        SUM(profit) AS total_profit,
        SUM(billed_duration) AS total_billed_seconds
      FROM cdr WHERE created_at > ${interval} AND ${scope}
    `);

    const { rows: perHour } = await query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m-%d %H:00') AS hour,
        COUNT(*) AS calls,
        SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
        SUM(revenue) AS revenue
      FROM cdr WHERE created_at > ${interval} AND ${scope}
      GROUP BY hour ORDER BY hour
    `);

    const { rows: topDest } = await query(`
      SELECT destination, COUNT(*) AS calls, SUM(revenue) AS revenue
      FROM cdr WHERE created_at > ${interval} AND ${scope}
      GROUP BY destination ORDER BY calls DESC LIMIT 20
    `);

    const { rows: perCarrier } = await query(`
      SELECT s.name AS carrier, COUNT(*) AS calls,
        SUM(CASE WHEN cdr.disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
        SUM(cdr.cost) AS cost
      FROM cdr JOIN suppliers s ON s.id = cdr.supplier_id
      WHERE cdr.created_at > ${interval} AND ${scope}
      GROUP BY cdr.supplier_id ORDER BY calls DESC
    `);

    return {
      summary: summary[0],
      per_hour: perHour,
      top_destinations: topDest,
      per_carrier: perCarrier,
    };
  });

  fastify.get('/traffic/live-stats', { preHandler: requireRoles('admin') }, async () => {
    const { rows: activeCalls } = await query('SELECT COUNT(*) AS count FROM live_calls');
    const { rows: cps } = await query(`
      SELECT COUNT(*) AS count FROM cdr WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 SECOND)
    `);
    const { rows: last5min } = await query(`
      SELECT COUNT(*) AS count FROM cdr WHERE created_at > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
    `);
    return {
      active_calls: activeCalls[0]?.count || 0,
      current_cps: cps[0]?.count || 0,
      last_5min_calls: last5min[0]?.count || 0,
    };
  });
}
