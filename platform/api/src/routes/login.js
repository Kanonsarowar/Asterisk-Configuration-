import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { verifyPassword } from '../lib/password.js';
import { loadUserContext } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function loginRoutes(fastify, _opts) {
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { username, password } = req.body;
    const u = await query(
      'SELECT id, username, password_hash, role, status FROM users WHERE username = ?',
      [String(username).trim()]
    );
    const row = u.rows[0];
    if (!row || row.status === 'suspended' || !(await verifyPassword(password, row.password_hash))) {
      return reply.code(401).send({ error: 'Invalid credentials' });
    }
    const ctx = await loadUserContext(row.id);
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return reply.code(500).send({ error: 'Server misconfigured' });
    }
    const token = jwt.sign(
      {
        sub: String(row.id),
        role: row.role,
        customerId: ctx.customerId,
      },
      secret,
      { expiresIn: '12h' }
    );
    await auditLog('login', row.id, { username: row.username });
    return {
      token,
      user: {
        id: row.id,
        username: row.username,
        role: row.role,
        customerId: ctx.customerId,
        balance: ctx.balance,
      },
    };
  });
}
