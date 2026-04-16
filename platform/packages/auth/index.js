import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../database/index.js';
import { ADMIN_ROLES } from '../shared/index.js';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload, expiresIn = '12h') {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign(payload, secret, { expiresIn });
}

export function verifyToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.verify(token, secret);
}

export async function authenticateUser(username, password) {
  const { rows } = await query(
    'SELECT id, username, email, password_hash, role, status FROM users WHERE username = ?',
    [String(username).trim()]
  );
  const user = rows[0];
  if (!user) return null;
  if (user.status !== 'active') return null;
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  let clientId = null;
  let balance = null;
  if (user.role === 'client') {
    const { rows: clients } = await query('SELECT id, balance FROM clients WHERE user_id = ?', [user.id]);
    clientId = clients[0]?.id ?? null;
    balance = clients[0]?.balance ?? null;
  }

  await query('UPDATE users SET last_login_at = NOW(3) WHERE id = ?', [user.id]);

  const token = signToken({
    sub: String(user.id),
    role: user.role,
    clientId,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      clientId,
      balance,
    },
  };
}

export async function loadUserContext(userId) {
  const { rows } = await query(
    'SELECT id, username, role, parent_id, status FROM users WHERE id = ?',
    [userId]
  );
  const user = rows[0];
  if (!user || user.status !== 'active') return null;

  let clientId = null;
  let balance = null;
  if (user.role === 'client') {
    const { rows: c } = await query('SELECT id, balance FROM clients WHERE user_id = ?', [userId]);
    clientId = c[0]?.id ?? null;
    balance = c[0]?.balance ?? null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    parentId: user.parent_id,
    clientId,
    balance,
    isAdmin: ADMIN_ROLES.includes(user.role),
  };
}

export function requireRoles(...roles) {
  return async function (req, reply) {
    if (!req.userCtx) return reply.code(401).send({ error: 'Unauthorized' });
    if (!roles.includes(req.userCtx.role)) return reply.code(403).send({ error: 'Forbidden' });
  };
}
