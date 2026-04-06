import { getPool } from '../../db.js';
import { hashPassword } from '../auth/auth.service.js';
import { notFound, badRequest } from '../../lib/errors.js';

export async function listUsers({ role, status, limit = 100, offset = 0 }) {
  const pool = getPool();
  let sql = 'SELECT id, username, role, balance, status, created_at, updated_at FROM users WHERE 1=1';
  const params = [];
  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ` ORDER BY id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getUser(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    'SELECT id, username, role, balance, status, created_at, updated_at FROM users WHERE id = ?',
    [id]
  );
  if (!rows.length) throw notFound('User not found');
  return rows[0];
}

export async function createUser({ username, password, role = 'user', balance = 0 }) {
  const pool = getPool();
  const hash = await hashPassword(password);
  try {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, role, balance) VALUES (?, ?, ?, ?)',
      [username, hash, role, balance]
    );
    return { id: String(result.insertId), username, role, balance };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw badRequest('Username already exists');
    throw e;
  }
}

export async function updateUser(id, fields) {
  const pool = getPool();
  const allowed = ['role', 'status'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      params.push(fields[key]);
    }
  }
  if (fields.password) {
    sets.push('password_hash = ?');
    params.push(await hashPassword(fields.password));
  }
  if (!sets.length) throw badRequest('No valid fields to update');
  params.push(id);
  const [result] = await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  if (result.affectedRows === 0) throw notFound('User not found');
  return getUser(id);
}

export async function adjustBalance(id, amount) {
  const pool = getPool();
  const delta = Number(amount);
  if (isNaN(delta)) throw badRequest('Invalid amount');
  const [result] = await pool.execute(
    'UPDATE users SET balance = balance + ? WHERE id = ?',
    [delta, id]
  );
  if (result.affectedRows === 0) throw notFound('User not found');
  return getUser(id);
}

export async function deleteUser(id) {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw notFound('User not found');
  return { deleted: true };
}
