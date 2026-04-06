import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getPool } from '../../db.js';
import { config } from '../../config.js';
import { unauthorized } from '../../lib/errors.js';

const SALT_ROUNDS = 12;

export async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}

export async function login(username, password) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, role, balance, status FROM users WHERE username = ?',
    [username]
  );
  if (!rows.length) throw unauthorized('Invalid credentials');
  const user = rows[0];
  if (user.status !== 'active') throw unauthorized('Account is not active');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw unauthorized('Invalid credentials');

  const token = signToken({ sub: String(user.id), role: user.role });
  return {
    token,
    user: { id: String(user.id), username: user.username, role: user.role, balance: user.balance },
  };
}
