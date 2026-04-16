import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function rateCardRoutes(fastify) {
  fastify.addHook('preHandler', requireRoles('admin', 'reseller'));

  fastify.get('/rate-cards', async (req) => {
    const { card_type, status } = req.query;
    let sql = 'SELECT rc.*, u.username AS created_by_name FROM rate_cards rc LEFT JOIN users u ON u.id = rc.created_by';
    const where = []; const params = [];
    if (card_type) { where.push('rc.card_type = ?'); params.push(card_type); }
    if (status) { where.push('rc.status = ?'); params.push(status); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY rc.effective_date DESC';
    const { rows } = await query(sql, params);
    return { rate_cards: rows };
  });

  fastify.get('/rate-cards/:id', async (req, reply) => {
    const { rows } = await query('SELECT * FROM rate_cards WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const { rows: entries } = await query(
      'SELECT * FROM rate_card_entries WHERE rate_card_id = ? ORDER BY prefix', [req.params.id]
    );
    return { ...rows[0], entries };
  });

  fastify.post('/rate-cards', async (req, reply) => {
    const { name, card_type = 'sell', effective_date, expiry_date, status = 'draft', entries = [] } = req.body || {};
    if (!name || !effective_date) return reply.code(400).send({ error: 'name and effective_date required' });

    const { insertId } = await query(
      `INSERT INTO rate_cards (name, card_type, effective_date, expiry_date, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, card_type, effective_date, expiry_date || null, status, req.userCtx?.id]
    );

    if (entries.length) {
      for (const e of entries) {
        await query(
          `INSERT INTO rate_card_entries (rate_card_id, prefix, destination, rate_per_minute, connection_fee, min_duration, increment)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [insertId, e.prefix, e.destination || '', e.rate_per_minute || 0, e.connection_fee || 0, e.min_duration || 0, e.increment || 1]
        );
      }
    }
    await auditLog('rate_card.create', req.userCtx?.id, { id: insertId, name });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/rate-cards/:id', async (req, reply) => {
    const id = req.params.id;
    const fields = ['name','card_type','effective_date','expiry_date','status'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(id);
    await query(`UPDATE rate_cards SET ${updates.join(', ')} WHERE id = ?`, params);
    await auditLog('rate_card.update', req.userCtx?.id, { id });
    return { ok: true };
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

  fastify.delete('/rate-cards/:id', { preHandler: requireRoles('admin') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM rate_cards WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
