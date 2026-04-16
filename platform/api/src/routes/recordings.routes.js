import { query } from '../db.js';
import { canAccessCustomer } from '../lib/rbac.js';
import { existsSync, createReadStream } from 'fs';
import { join } from 'path';

const RECORDING_PATH = process.env.RECORDING_PATH || '/var/spool/asterisk/recording';

export default async function recordingRoutes(fastify) {
  fastify.get('/recordings', async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT r.*, cu.name AS customer_name FROM recordings r LEFT JOIN customers cu ON cu.id = r.customer_id';
    const where = []; const params = [];
    if (ctx.role === 'user' && ctx.customerId) {
      where.push('r.customer_id = ?'); params.push(ctx.customerId);
    } else if (ctx.role === 'reseller') {
      where.push('r.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?)');
      params.push(ctx.id);
    }
    if (req.query.customer_id) { where.push('r.customer_id = ?'); params.push(req.query.customer_id); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY r.created_at DESC LIMIT 200';
    const { rows } = await query(sql, params);
    return { recordings: rows };
  });

  fastify.get('/recordings/:id/play', async (req, reply) => {
    const ctx = req.userCtx;
    const { rows } = await query('SELECT * FROM recordings WHERE id = ?', [req.params.id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const rec = rows[0];
    if (ctx.role === 'user' && rec.customer_id !== ctx.customerId) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const filepath = join(RECORDING_PATH, rec.filename);
    if (!existsSync(filepath)) return reply.code(404).send({ error: 'File not found' });

    const ext = rec.filename.split('.').pop()?.toLowerCase();
    const mime = ext === 'wav' ? 'audio/wav' : ext === 'mp3' ? 'audio/mpeg' : 'application/octet-stream';
    reply.header('Content-Type', mime);
    reply.header('Content-Disposition', `inline; filename="${rec.filename}"`);
    return reply.send(createReadStream(filepath));
  });
}
