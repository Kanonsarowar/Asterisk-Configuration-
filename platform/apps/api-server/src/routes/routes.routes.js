import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';

export default async function routeRoutes(fastify) {
  fastify.addHook('preHandler', requireRoles('superadmin', 'admin'));

  fastify.get('/routes', async (req) => {
    const { rows } = await query(
      `SELECT r.*, p.name AS provider_name, p.host AS provider_host, p.quality_score
       FROM routes r JOIN providers p ON p.id = r.provider_id ORDER BY r.prefix, r.priority`
    );
    return { routes: rows };
  });

  fastify.post('/routes', async (req, reply) => {
    const b = req.body || {};
    if (!b.prefix || !b.provider_id) return reply.code(400).send({ error: 'prefix and provider_id required' });
    const { insertId } = await query(
      `INSERT INTO routes (prefix, provider_id, priority, weight, rate, min_asr, min_acd, margin_min, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [b.prefix, b.provider_id, b.priority ?? 0, b.weight ?? 100, b.rate ?? 0,
       b.min_asr ?? 0, b.min_acd ?? 0, b.margin_min ?? 0, b.active ?? 1]
    );
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/routes/:id', async (req, reply) => {
    const fields = ['prefix','provider_id','priority','weight','rate','min_asr','min_acd','margin_min','active'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE routes SET ${updates.join(', ')} WHERE id = ?`, params);
    return { ok: true };
  });

  fastify.delete('/routes/:id', async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM routes WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
