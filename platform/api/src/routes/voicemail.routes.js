import { query } from '../db.js';
import { requireRoles, canAccessCustomer } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function voicemailRoutes(fastify) {
  fastify.get('/voicemail', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT v.*, cu.name AS customer_name FROM voicemail_boxes v LEFT JOIN customers cu ON cu.id = v.customer_id';
    const where = []; const params = [];
    if (ctx.role === 'user' && ctx.customerId) {
      where.push('v.customer_id = ?'); params.push(ctx.customerId);
    } else if (ctx.role === 'reseller') {
      where.push('(v.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?) OR v.customer_id IS NULL)');
      params.push(ctx.id);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY v.mailbox';
    const { rows } = await query(sql, params);
    return { voicemail_boxes: rows };
  });

  fastify.post('/voicemail', { preHandler: requireRoles('admin', 'reseller') }, async (req, reply) => {
    const { customer_id, mailbox, password = '1234', email, max_messages = 50 } = req.body || {};
    if (!mailbox) return reply.code(400).send({ error: 'mailbox required' });

    const { insertId } = await query(
      `INSERT INTO voicemail_boxes (customer_id, mailbox, password, email, max_messages) VALUES (?, ?, ?, ?, ?)`,
      [customer_id || null, mailbox, password, email || null, max_messages]
    );
    await auditLog('voicemail.create', req.userCtx?.id, { vmId: insertId, mailbox });
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/voicemail/:id', async (req, reply) => {
    const fields = ['password','email','max_messages','status'];
    const updates = []; const params = [];
    for (const f of fields) {
      if (req.body?.[f] !== undefined) { updates.push(`${f} = ?`); params.push(req.body[f]); }
    }
    if (!updates.length) return reply.code(400).send({ error: 'No fields' });
    params.push(req.params.id);
    await query(`UPDATE voicemail_boxes SET ${updates.join(', ')} WHERE id = ?`, params);
    return { ok: true };
  });

  fastify.delete('/voicemail/:id', { preHandler: requireRoles('admin') }, async (req, reply) => {
    const { affectedRows } = await query('DELETE FROM voicemail_boxes WHERE id = ?', [req.params.id]);
    if (!affectedRows) return reply.code(404).send({ error: 'Not found' });
    return { ok: true };
  });
}
