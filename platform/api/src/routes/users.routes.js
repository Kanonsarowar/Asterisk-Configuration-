import { query } from '../db.js';
import { requireRoles } from '../lib/rbac.js';
import { hashPassword } from '../lib/password.js';
import { auditLog } from '../lib/audit.js';

export default async function usersRoutes(fastify) {
  fastify.get('/users/me', async (req) => {
    const ctx = req.userCtx;
    const r = await query(
      'SELECT id, username, role, balance, status, parent_user_id, created_at FROM users WHERE id = ?',
      [ctx.id]
    );
    const perms = await query('SELECT perm FROM user_permissions WHERE user_id = ?', [ctx.id]);
    return { user: r.rows[0], permissions: perms.rows.map((x) => x.perm) };
  });

  fastify.get('/users', {
    preHandler: [requireRoles('admin', 'reseller')],
  }, async (req) => {
    const ctx = req.userCtx;
    if (ctx.role === 'admin') {
      const r = await query(
        'SELECT id, username, role, balance, status, parent_user_id, created_at FROM users ORDER BY id DESC LIMIT 500'
      );
      return { users: r.rows };
    }
    const r = await query(
      'SELECT id, username, role, balance, status, parent_user_id, created_at FROM users WHERE parent_user_id = ? ORDER BY id DESC',
      [ctx.id]
    );
    return { users: r.rows };
  });

  fastify.post('/users', {
    preHandler: [requireRoles('admin', 'reseller')],
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password', 'role'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
          role: { type: 'string', enum: ['reseller', 'user'] },
          balance: { type: 'number' },
        },
      },
    },
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const b = req.body;
    if (ctx.role === 'reseller' && b.role === 'reseller') {
      return reply.code(403).send({ error: 'Cannot create reseller' });
    }
    const parent = ctx.role === 'reseller' ? ctx.id : null;
    const h = await hashPassword(b.password);
    try {
      const ins = await query(
        `INSERT INTO users (username, password_hash, role, balance, parent_user_id) VALUES (?, ?, ?, ?, ?)`,
        [String(b.username).trim(), h, b.role, Number(b.balance) || 0, parent]
      );
      const id = ins.insertId;
      await auditLog('user_create', ctx.id, { id, role: b.role });
      const r = await query(
        'SELECT id, username, role, balance, status, parent_user_id, created_at FROM users WHERE id = ?',
        [id]
      );
      return r.rows[0];
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return reply.code(409).send({ error: 'Username exists' });
      throw e;
    }
  });

  fastify.post('/users/:id/balance', {
    preHandler: [requireRoles('admin', 'reseller')],
    schema: {
      body: {
        type: 'object',
        required: ['delta'],
        properties: { delta: { type: 'number' } },
      },
    },
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const id = parseInt(req.params.id, 10);
    const delta = Number(req.body.delta);
    if (ctx.role === 'reseller') {
      const u = await query('SELECT parent_user_id FROM users WHERE id = ?', [id]);
      if (u.rows[0]?.parent_user_id !== ctx.id) return reply.code(403).send({ error: 'Forbidden' });
    }
    await query(`UPDATE users SET balance = balance + ? WHERE id = ?`, [delta, id]);
    const r = await query('SELECT id, username, balance FROM users WHERE id = ?', [id]);
    if (!r.rows[0]) return reply.code(404).send({ error: 'Not found' });
    await auditLog('user_balance_adjust', ctx.id, { userId: id, delta });
    return r.rows[0];
  });

  fastify.post('/users/:id/permissions', {
    preHandler: [requireRoles('admin', 'reseller')],
    schema: {
      body: {
        type: 'object',
        required: ['perms'],
        properties: { perms: { type: 'array', items: { type: 'string' } } },
      },
    },
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const id = parseInt(req.params.id, 10);
    if (ctx.role === 'reseller') {
      const u = await query('SELECT parent_user_id FROM users WHERE id = ?', [id]);
      if (u.rows[0]?.parent_user_id !== ctx.id) return reply.code(403).send({ error: 'Forbidden' });
    }
    await query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
    for (const perm of req.body.perms) {
      await query('INSERT INTO user_permissions (user_id, perm) VALUES (?, ?)', [id, String(perm).slice(0, 64)]);
    }
    await auditLog('user_permissions', ctx.id, { userId: id });
    return { ok: true };
  });

  fastify.put('/users/:id/status', {
    preHandler: [requireRoles('admin')],
    schema: {
      body: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['active', 'suspended'] } },
      },
    },
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const id = parseInt(req.params.id, 10);
    await query('UPDATE users SET status = ? WHERE id = ?', [req.body.status, id]);
    await auditLog('user_status', ctx.id, { userId: id, status: req.body.status });
    return { ok: true };
  });
}
