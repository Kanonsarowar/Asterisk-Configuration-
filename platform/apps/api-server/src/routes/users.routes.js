import { query } from '../../../../packages/database/index.js';
import { requireRoles, hashPassword } from '../../../../packages/auth/index.js';

export default async function userRoutes(fastify) {
  fastify.get('/users/me', async (req) => {
    return req.userCtx;
  });

  fastify.get('/users', { preHandler: requireRoles('superadmin', 'admin', 'reseller') }, async (req) => {
    const ctx = req.userCtx;
    let sql = 'SELECT id, username, email, role, status, parent_id, last_login_at, created_at FROM users';
    const where = []; const params = [];
    if (ctx.role === 'reseller') { where.push('parent_id = ?'); params.push(ctx.id); }
    if (req.query.role) { where.push('role = ?'); params.push(req.query.role); }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const { rows } = await query(sql, params);
    return { users: rows };
  });

  fastify.post('/users', { preHandler: requireRoles('superadmin', 'admin', 'reseller') }, async (req, reply) => {
    const { username, email, password, role = 'client' } = req.body || {};
    if (!username || !password) return reply.code(400).send({ error: 'username and password required' });
    const ctx = req.userCtx;
    if (ctx.role === 'reseller' && !['client'].includes(role)) {
      return reply.code(403).send({ error: 'Resellers can only create client users' });
    }
    const hash = await hashPassword(password);
    const parentId = ctx.role === 'reseller' ? ctx.id : null;
    const { insertId } = await query(
      `INSERT INTO users (username, email, password_hash, role, status, parent_id) VALUES (?, ?, ?, ?, 'active', ?)`,
      [username, email || null, hash, role, parentId]
    );
    return reply.code(201).send({ id: insertId });
  });

  fastify.put('/users/:id/status', { preHandler: requireRoles('superadmin', 'admin') }, async (req) => {
    const { status } = req.body || {};
    if (!['active','suspended','pending'].includes(status)) return { error: 'Invalid status' };
    await query('UPDATE users SET status = ? WHERE id = ?', [status, req.params.id]);
    return { ok: true };
  });

  fastify.put('/users/:id/password', async (req, reply) => {
    const ctx = req.userCtx;
    const targetId = parseInt(req.params.id);
    if (ctx.role === 'client' && ctx.id !== targetId) return reply.code(403).send({ error: 'Forbidden' });
    const { password } = req.body || {};
    if (!password || password.length < 8) return reply.code(400).send({ error: 'Password must be 8+ characters' });
    const hash = await hashPassword(password);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, targetId]);
    return { ok: true };
  });
}
