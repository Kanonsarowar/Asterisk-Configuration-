import { query } from '../../../../packages/database/index.js';

export default async function cdrRoutes(fastify) {
  fastify.get('/cdr', async (req) => {
    const ctx = req.userCtx;
    const { prefix, from, to, disposition, limit = 200, page = 1 } = req.query;
    let sql = 'SELECT * FROM cdr';
    const where = []; const params = [];
    if (ctx.role === 'client') { where.push('client_id = ?'); params.push(ctx.clientId); }
    else if (ctx.role === 'reseller') {
      where.push('client_id IN (SELECT cl.id FROM clients cl JOIN users u ON u.id = cl.user_id WHERE u.parent_id = ?)');
      params.push(ctx.id);
    }
    if (prefix) { where.push('dst LIKE ?'); params.push(prefix + '%'); }
    if (from) { where.push('created_at >= ?'); params.push(from); }
    if (to) { where.push('created_at <= ?'); params.push(to); }
    if (disposition) { where.push('disposition = ?'); params.push(disposition); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const off = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    sql += ` LIMIT ${parseInt(limit)} OFFSET ${off}`;
    const { rows } = await query(sql, params);
    return { rows };
  });

  fastify.get('/cdr/stats', async (req) => {
    const ctx = req.userCtx;
    const scope = ctx.role === 'client' ? `client_id = ${ctx.clientId}`
      : ctx.role === 'reseller'
        ? `client_id IN (SELECT cl.id FROM clients cl JOIN users u ON u.id = cl.user_id WHERE u.parent_id = ${ctx.id})`
        : 'TRUE';
    const hours = parseInt(req.query.hours) || 24;
    const { rows } = await query(`
      SELECT COUNT(*) AS total_calls,
        SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
        ROUND(SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1) * 100, 2) AS asr,
        ROUND(AVG(CASE WHEN disposition = 'ANSWERED' THEN duration ELSE NULL END), 1) AS acd,
        SUM(revenue) AS total_revenue, SUM(cost) AS total_cost, SUM(profit) AS total_profit,
        SUM(billed_duration) AS total_billed_seconds
      FROM cdr WHERE created_at > DATE_SUB(NOW(), INTERVAL ${hours} HOUR) AND ${scope}
    `);
    return rows[0] || {};
  });

  fastify.get('/cdr/export.csv', async (req, reply) => {
    const ctx = req.userCtx;
    let sql = 'SELECT uniqueid,src,dst,did_number,start_time,duration,billed_duration,disposition,revenue,cost FROM cdr';
    const where = []; const params = [];
    if (ctx.role === 'client') { where.push('client_id = ?'); params.push(ctx.clientId); }
    if (req.query.from) { where.push('created_at >= ?'); params.push(req.query.from); }
    if (req.query.to) { where.push('created_at <= ?'); params.push(req.query.to); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY created_at DESC LIMIT 10000';
    const { rows } = await query(sql, params);
    const header = 'uniqueid,src,dst,did_number,start_time,duration,billed_duration,disposition,revenue,cost\n';
    const csv = header + rows.map(r =>
      `${r.uniqueid},${r.src},${r.dst},${r.did_number},${r.start_time},${r.duration},${r.billed_duration},${r.disposition},${r.revenue},${r.cost}`
    ).join('\n');
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="cdr_export.csv"');
    return csv;
  });
}
