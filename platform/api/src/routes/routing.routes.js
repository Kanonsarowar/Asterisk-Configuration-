import { query, getPool } from '../db.js';
import { routesScopeSql, canAccessNumber } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function routingRoutes(fastify) {
  fastify.get('/routes', async (req) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client') return { routes: [] };
    const { where, params } = routesScopeSql(ctx);
    const r = await query(
      `SELECT r.id, r.number_id, r.supplier_id, r.priority, n.did, s.name AS supplier_name
       FROM routes r
       JOIN numbers n ON n.id = r.number_id
       JOIN suppliers s ON s.id = r.supplier_id
       WHERE ${where}
       ORDER BY n.did, r.priority`,
      params
    );
    return { routes: r.rows };
  });

  fastify.post('/routes', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client') return reply.code(403).send({ error: 'Forbidden' });
    const { number_id: numberId, routes: routeList } = req.body || {};
    if (!numberId || !Array.isArray(routeList)) {
      return reply.code(400).send({ error: 'number_id and routes[] required' });
    }
    const n = await query('SELECT * FROM numbers WHERE id = $1', [numberId]);
    const row = n.rows[0];
    if (!(await canAccessNumber(ctx, row))) return reply.code(403).send({ error: 'Forbidden' });

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM routes WHERE number_id = $1', [numberId]);
      let p = 0;
      for (const entry of routeList) {
        const sid = entry.supplier_id;
        if (!sid) continue;
        await client.query(
          'INSERT INTO routes (number_id, supplier_id, priority) VALUES ($1, $2, $3)',
          [numberId, sid, entry.priority != null ? entry.priority : p++]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    await auditLog('routes_update', ctx.id, { numberId });
    return { ok: true };
  });
}
