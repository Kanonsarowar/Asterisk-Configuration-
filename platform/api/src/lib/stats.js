import { query } from '../db.js';

export async function cdrStats(ctx, from, to) {
  const start = from || new Date(Date.now() - 86400000).toISOString();
  const end = to || new Date().toISOString();

  if (ctx.role === 'admin') {
    const r = await query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE disposition IS NOT NULL AND UPPER(disposition) LIKE '%ANSWER%')::int AS answered_calls,
        COALESCE(AVG(duration_seconds) FILTER (WHERE UPPER(disposition) LIKE '%ANSWER%'), 0)::float AS acd_seconds,
        COALESCE(SUM(revenue), 0)::float AS revenue,
        COALESCE(SUM(cost), 0)::float AS cost,
        COALESCE(SUM(profit), 0)::float AS profit
      FROM cdr
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz`,
      [start, end]
    );
    return r.rows[0];
  }

  if (ctx.role === 'reseller') {
    const r = await query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE disposition IS NOT NULL AND UPPER(disposition) LIKE '%ANSWER%')::int AS answered_calls,
        COALESCE(AVG(duration_seconds) FILTER (WHERE UPPER(disposition) LIKE '%ANSWER%'), 0)::float AS acd_seconds,
        COALESCE(SUM(revenue), 0)::float AS revenue,
        COALESCE(SUM(cost), 0)::float AS cost,
        COALESCE(SUM(profit), 0)::float AS profit
      FROM cdr
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
        AND customer_id IN (SELECT id FROM customers WHERE reseller_user_id = $3)`,
      [start, end, ctx.id]
    );
    return r.rows[0];
  }

  if (ctx.role === 'client' && ctx.customerId) {
    const r = await query(
      `SELECT
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE disposition IS NOT NULL AND UPPER(disposition) LIKE '%ANSWER%')::int AS answered_calls,
        COALESCE(AVG(duration_seconds) FILTER (WHERE UPPER(disposition) LIKE '%ANSWER%'), 0)::float AS acd_seconds,
        COALESCE(SUM(revenue), 0)::float AS revenue,
        COALESCE(SUM(cost), 0)::float AS cost,
        COALESCE(SUM(profit), 0)::float AS profit
      FROM cdr
      WHERE created_at >= $1::timestamptz AND created_at < $2::timestamptz
        AND customer_id = $3`,
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
