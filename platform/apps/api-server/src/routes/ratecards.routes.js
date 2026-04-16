import { query } from '../../../../packages/database/index.js';
import { requireRoles } from '../../../../packages/auth/index.js';

export default async function rateCardRoutes(fastify) {
  fastify.addHook('preHandler', requireRoles('superadmin', 'admin', 'reseller'));

  fastify.get('/rate-cards', async () => {
    const { rows } = await query('SELECT * FROM rate_cards ORDER BY effective_date DESC');
    return { rate_cards: rows };
  });

  fastify.get('/rate-cards/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM rate_cards WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const { rows: entries } = await query('SELECT * FROM rate_card_entries WHERE rate_card_id = ? ORDER BY prefix', [req.params.id]);
    return { ...rows[0], entries };
  });

  fastify.post('/rate-cards', async (req, reply) => {
    const b = req.body || {};
    if (!b.name || !b.effective_date) return reply.code(400).send({ error: 'name and effective_date required' });
    const { insertId } = await query(
      `INSERT INTO rate_cards (name, card_type, currency, effective_date, expiry_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [b.name, b.card_type || 'sell', b.currency || 'USD', b.effective_date, b.expiry_date || null, b.status || 'draft', req.userCtx.id]
    );
    return reply.code(201).send({ id: insertId });
  });

  fastify.post('/rate-cards/:id/entries', async (req, reply) => {
    const { entries } = req.body || {};
    if (!Array.isArray(entries)) return reply.code(400).send({ error: 'entries array required' });
    await query('DELETE FROM rate_card_entries WHERE rate_card_id = ?', [req.params.id]);
    for (const e of entries) {
      await query(
        `INSERT INTO rate_card_entries (rate_card_id, prefix, destination, rate_per_minute, connection_fee, min_duration, increment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.params.id, e.prefix, e.destination || '', e.rate_per_minute || 0, e.connection_fee || 0, e.min_duration || 0, e.increment || 1]
      );
    }
    return { ok: true, count: entries.length };
  });

  fastify.delete('/rate-cards/:id', { preHandler: requireRoles('superadmin', 'admin') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM rate_cards WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
