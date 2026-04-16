import { query } from '../../../../packages/database/index.js';
import { getLiveCallCount } from '../../../../packages/telephony/index.js';

export default async function dashboardRoutes(fastify) {
  fastify.get('/dashboard/summary', async (req) => {
    const ctx = req.userCtx;
    const scope = ctx.role === 'client' ? `client_id = ${ctx.clientId}`
      : ctx.role === 'reseller'
        ? `client_id IN (SELECT cl.id FROM clients cl JOIN users u ON u.id = cl.user_id WHERE u.parent_id = ${ctx.id})`
        : 'TRUE';

    const [
      { rows: callStats },
      { rows: clientCount },
      { rows: didCount },
      { rows: providerCount },
      { rows: revenueToday },
      { rows: openTickets },
    ] = await Promise.all([
      query(`SELECT COUNT(*) AS total_calls,
        SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
        ROUND(SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) / GREATEST(COUNT(*),1) * 100, 2) AS asr,
        ROUND(AVG(CASE WHEN disposition = 'ANSWERED' THEN duration ELSE NULL END), 1) AS acd
        FROM cdr WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) AND ${scope}`),
      query(`SELECT COUNT(*) AS cnt FROM clients${ctx.role === 'reseller' ? ` WHERE user_id IN (SELECT id FROM users WHERE parent_id = ${ctx.id})` : ''}`),
      query(`SELECT COUNT(*) AS cnt FROM did_inventory WHERE ${ctx.role === 'client' ? `client_id = ${ctx.clientId}` : 'TRUE'}`),
      query('SELECT COUNT(*) AS cnt FROM providers WHERE status = ?', ['active']),
      query(`SELECT SUM(revenue) AS rev, SUM(profit) AS prof FROM cdr WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) AND ${scope}`),
      query(`SELECT COUNT(*) AS cnt FROM tickets WHERE status IN ('open','in_progress')${ctx.role === 'client' ? ` AND client_id = ${ctx.clientId}` : ''}`),
    ]);

    const activeCalls = await getLiveCallCount();

    return {
      active_calls: activeCalls,
      total_calls_24h: callStats[0]?.total_calls || 0,
      asr: callStats[0]?.asr || 0,
      acd: callStats[0]?.acd || 0,
      revenue_24h: revenueToday[0]?.rev || 0,
      profit_24h: revenueToday[0]?.prof || 0,
      total_clients: clientCount[0]?.cnt || 0,
      total_dids: didCount[0]?.cnt || 0,
      active_providers: providerCount[0]?.cnt || 0,
      open_tickets: openTickets[0]?.cnt || 0,
    };
  });
}
