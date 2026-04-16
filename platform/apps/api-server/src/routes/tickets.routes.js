import { query } from '../../../../packages/database/index.js';

export default async function ticketRoutes(fastify) {
  fastify.get('/tickets', async (req) => {
    const ctx = req.userCtx;
    let sql = `SELECT t.*, u.username AS created_by, a.username AS assigned_to_name
               FROM tickets t JOIN users u ON u.id = t.user_id LEFT JOIN users a ON a.id = t.assigned_to`;
    const where = []; const params = [];
    if (ctx.role === 'client') { where.push('t.client_id = ?'); params.push(ctx.clientId); }
    if (req.query.status) { where.push('t.status = ?'); params.push(req.query.status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY t.created_at DESC';
    const { rows } = await query(sql, params);
    return { tickets: rows };
  });

  fastify.get('/tickets/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM tickets WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const ctx = req.userCtx;
    if (ctx.role === 'client' && rows[0].client_id !== ctx.clientId) return reply.code(403).send({ error: 'Forbidden' });
    const { rows: messages } = await query(
      `SELECT tm.*, u.username FROM ticket_messages tm JOIN users u ON u.id = tm.user_id
       WHERE tm.ticket_id = ? ${ctx.role === 'client' ? 'AND tm.is_internal = 0' : ''}
       ORDER BY tm.created_at`,
      [req.params.id]
    );
    return { ...rows[0], messages };
  });

  fastify.post('/tickets', async (req, reply) => {
    const ctx = req.userCtx;
    const { subject, body, priority = 'normal' } = req.body || {};
    if (!subject || !body) return reply.code(400).send({ error: 'subject and body required' });
    const { insertId } = await query(
      `INSERT INTO tickets (client_id, user_id, subject, body, priority) VALUES (?, ?, ?, ?, ?)`,
      [ctx.clientId || null, ctx.id, subject, body, priority]
    );
    return reply.code(201).send({ id: insertId });
  });

  fastify.post('/tickets/:id/messages', async (req, reply) => {
    const ctx = req.userCtx;
    const { body, is_internal = false } = req.body || {};
    if (!body) return reply.code(400).send({ error: 'body required' });
    const { insertId } = await query(
      `INSERT INTO ticket_messages (ticket_id, user_id, body, is_internal) VALUES (?, ?, ?, ?)`,
      [req.params.id, ctx.id, body, ctx.isAdmin && is_internal ? 1 : 0]
    );
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/tickets/:id/status', async (req) => {
    const { status } = req.body || {};
    const updates = ['status = ?'];
    const params = [status];
    if (status === 'resolved') { updates.push('resolved_at = NOW(3)'); }
    params.push(req.params.id);
    await query(`UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`, params);
    return { ok: true };
  });
}
