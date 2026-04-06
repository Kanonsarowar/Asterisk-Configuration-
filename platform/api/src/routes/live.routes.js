import { query } from '../db.js';

export default async function liveRoutes(fastify) {
  fastify.get('/live/calls', async (req) => {
    const ctx = req.userCtx;
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    if (ctx.role === 'admin' || ctx.role === 'reseller') {
      const r = await query(
        `SELECT * FROM live_calls WHERE last_seen_at >= UTC_TIMESTAMP() - INTERVAL 5 MINUTE ORDER BY started_at DESC LIMIT ?`,
        [limit]
      );
      return { calls: r.rows };
    }
    if (!ctx.customerId) return { calls: [] };
    const r = await query(
      `SELECT lc.* FROM live_calls lc
       WHERE lc.last_seen_at >= UTC_TIMESTAMP() - INTERVAL 5 MINUTE
         AND EXISTS (
           SELECT 1 FROM numbers n
           WHERE n.customer_id = ?
             AND CAST(lc.destination AS UNSIGNED) BETWEEN CAST(n.range_start AS UNSIGNED) AND CAST(n.range_end AS UNSIGNED)
         )
       ORDER BY lc.started_at DESC
       LIMIT ?`,
      [ctx.customerId, limit]
    );
    return { calls: r.rows };
  });
}
