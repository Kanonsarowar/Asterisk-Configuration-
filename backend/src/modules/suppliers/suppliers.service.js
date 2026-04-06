import { getPool } from '../../db.js';
import { notFound, badRequest } from '../../lib/errors.js';

const COLUMNS = 'id, name, host, port, username, protocol, codecs, max_channels, cost_per_min, active, created_at, updated_at';

export async function listSuppliers({ active, limit = 100, offset = 0 }) {
  const pool = getPool();
  let sql = `SELECT ${COLUMNS} FROM suppliers WHERE 1=1`;
  const params = [];
  if (active !== undefined) { sql += ' AND active = ?'; params.push(active ? 1 : 0); }
  sql += ` ORDER BY id DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getSupplier(id) {
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM suppliers WHERE id = ?`, [id]);
  if (!rows.length) throw notFound('Supplier not found');
  return rows[0];
}

export async function createSupplier(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO suppliers (name, host, port, username, password, protocol, codecs, max_channels, cost_per_min, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.name, data.host, data.port || 5060,
      data.username || '', data.password || '',
      data.protocol || 'pjsip', data.codecs || 'g729,alaw,ulaw',
      data.max_channels || 0, data.cost_per_min || 0,
      data.active !== undefined ? (data.active ? 1 : 0) : 1,
    ]
  );
  return getSupplier(result.insertId);
}

export async function updateSupplier(id, data) {
  const pool = getPool();
  const allowed = ['name', 'host', 'port', 'username', 'password', 'protocol', 'codecs', 'max_channels', 'cost_per_min', 'active'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      const val = key === 'active' ? (data[key] ? 1 : 0) : data[key];
      sets.push(`\`${key}\` = ?`);
      params.push(val);
    }
  }
  if (!sets.length) throw badRequest('No valid fields to update');
  params.push(id);
  const [result] = await pool.execute(`UPDATE suppliers SET ${sets.join(', ')} WHERE id = ?`, params);
  if (result.affectedRows === 0) throw notFound('Supplier not found');
  return getSupplier(id);
}

export async function deleteSupplier(id) {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM suppliers WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw notFound('Supplier not found');
  return { deleted: true };
}
