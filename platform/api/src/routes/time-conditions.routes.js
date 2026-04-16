import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function timeConditionRoutes(fastify) {
  fastify.get('/time-conditions', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT tc.*, cu.name AS customer_name FROM time_conditions tc LEFT JOIN customers cu ON cu.id = tc.customer_id';
    const where = []; const params = [];
    if (ctx.role === 'user' && ctx.customerId) {
      where.push('tc.customer_id = ?'); params.push(ctx.customerId);
    } else if (ctx.role === 'reseller') {
      where.push('(tc.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?) OR tc.customer_id IS NULL)');
      params.push(ctx.id);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY tc.name';
    const { rows } = await query(sql, params);
    return { time_conditions: rows };
  });

  fastify.get('/time-conditions/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM time_conditions WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const { rows: rules } = await query(
      'SELECT * FROM time_condition_rules WHERE time_condition_id = ? ORDER BY day_of_week, start_time',
      [req.params.id]
    );
    return { ...rows[0], rules };
  });

  fastify.post('/time-conditions', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { customer_id, name, timezone = 'UTC', match_route_type = 'ivr', match_route_target,
      nomatch_route_type = 'voicemail', nomatch_route_target, rules = [] } = req.body || {};
    if (!name) return reply.code(400).send({ error: 'name required' });

    const { insertId } = await query(
      `INSERT INTO time_conditions (customer_id, name, timezone, match_route_type, match_route_target,
        nomatch_route_type, nomatch_route_target) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [customer_id || null, name, timezone, match_route_type, match_route_target || null,
        nomatch_route_type, nomatch_route_target || null]
    );

    for (const r of rules) {
      await query(
        `INSERT INTO time_condition_rules (time_condition_id, day_of_week, start_time, end_time)
         VALUES (?, ?, ?, ?)`,
        [insertId, r.day_of_week || '*', r.start_time || '09:00:00', r.end_time || '17:00:00']
      );
    }
    await auditLog('time_condition.create', req.userCtx?.id, { tcId: insertId, name });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/time-conditions/:id/rules', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { rules } = req.body || {};
    if (!Array.isArray(rules)) return reply.code(400).send({ error: 'rules array required' });
    await query('DELETE FROM time_condition_rules WHERE time_condition_id = ?', [req.params.id]);
    for (const r of rules) {
      await query(
        `INSERT INTO time_condition_rules (time_condition_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)`,
        [req.params.id, r.day_of_week || '*', r.start_time || '09:00:00', r.end_time || '17:00:00']
      );
    }
    return { ok: true };
  });

  fastify.delete('/time-conditions/:id', { preHandler: requireRoles('admin') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM time_conditions WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
