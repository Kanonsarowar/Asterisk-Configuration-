import { query } from '../db.js';

export async function cdrStats(ctx, from, to) {
  const start = from || new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ');
  const end = to || new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (ctx.role === 'admin') {
    const r = await query(
      `SELECT
        COUNT(*) AS total_calls,
        SUM(CASE WHEN disposition IS NOT NULL AND UPPER(disposition) LIKE '%ANSWER%' THEN 1 ELSE 0 END) AS answered_calls,
        COALESCE(AVG(CASE WHEN UPPER(IFNULL(disposition,'')) LIKE '%ANSWER%' THEN duration END), 0) AS acd_seconds,
        COALESCE(SUM(revenue), 0) AS revenue,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(profit), 0) AS profit
      FROM cdr
      WHERE created_at >= ? AND created_at < ?`,
      [start, end]
    );
    return r.rows[0];
  }

  if (ctx.role === 'reseller') {
    const r = await query(
      `SELECT
        COUNT(*) AS total_calls,
        SUM(CASE WHEN disposition IS NOT NULL AND UPPER(disposition) LIKE '%ANSWER%' THEN 1 ELSE 0 END) AS answered_calls,
        COALESCE(AVG(CASE WHEN UPPER(IFNULL(disposition,'')) LIKE '%ANSWER%' THEN duration END), 0) AS acd_seconds,
        COALESCE(SUM(revenue), 0) AS revenue,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(profit), 0) AS profit
      FROM cdr
      WHERE created_at >= ? AND created_at < ?
        AND customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?)`,
      [start, end, ctx.id]
    );
    return r.rows[0];
  }

  if (ctx.role === 'user' && ctx.customerId) {
    const r = await query(
      `SELECT
        COUNT(*) AS total_calls,
        SUM(CASE WHEN disposition IS NOT NULL AND UPPER(disposition) LIKE '%ANSWER%' THEN 1 ELSE 0 END) AS answered_calls,
        COALESCE(AVG(CASE WHEN UPPER(IFNULL(disposition,'')) LIKE '%ANSWER%' THEN duration END), 0) AS acd_seconds,
        COALESCE(SUM(revenue), 0) AS revenue,
        COALESCE(SUM(cost), 0) AS cost,
        COALESCE(SUM(profit), 0) AS profit
      FROM cdr
      WHERE created_at >= ? AND created_at < ? AND customer_id = ?`,
      [start, end, ctx.customerId]
    );
    return r.rows[0];
  }

  return {
    total_calls: 0,
    answered_calls: 0,
    acd_seconds: 0,
    revenue: 0,
    cost: 0,
    profit: 0,
  };
}

export function asrFromStats(row) {
  const t = Number(row.total_calls) || 0;
  const a = Number(row.answered_calls) || 0;
  return t ? Math.round((10000 * a) / t) / 100 : 0;
}
