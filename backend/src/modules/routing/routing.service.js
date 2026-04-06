import { getPool } from '../../db.js';
import { notFound, badRequest } from '../../lib/errors.js';

export async function listRoutes({ prefix, supplier_id, active, limit = 100, offset = 0 }) {
  const pool = getPool();
  let sql = `SELECT r.*, s.name AS supplier_name, s.host AS supplier_host
    FROM routes r LEFT JOIN suppliers s ON s.id = r.supplier_id WHERE 1=1`;
  const params = [];
  if (prefix) { sql += ' AND r.prefix LIKE ?'; params.push(`${prefix}%`); }
  if (supplier_id) { sql += ' AND r.supplier_id = ?'; params.push(supplier_id); }
  if (active !== undefined) { sql += ' AND r.active = ?'; params.push(active ? 1 : 0); }
  sql += ` ORDER BY r.prefix, r.priority LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getRoute(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT r.*, s.name AS supplier_name FROM routes r
     LEFT JOIN suppliers s ON s.id = r.supplier_id WHERE r.id = ?`,
    [id]
  );
  if (!rows.length) throw notFound('Route not found');
  return rows[0];
}

export async function createRoute(data) {
  const pool = getPool();
  try {
    const [result] = await pool.execute(
      `INSERT INTO routes (prefix, supplier_id, priority, rate, active)
       VALUES (?, ?, ?, ?, ?)`,
      [data.prefix, data.supplier_id, data.priority ?? 100, data.rate || 0,
       data.active !== undefined ? (data.active ? 1 : 0) : 1]
    );
    return getRoute(result.insertId);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw badRequest('Route with this prefix+supplier already exists');
    throw e;
  }
}

export async function updateRoute(id, data) {
  const pool = getPool();
  const allowed = ['prefix', 'supplier_id', 'priority', 'rate', 'active'];
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
  try {
    const [result] = await pool.execute(`UPDATE routes SET ${sets.join(', ')} WHERE id = ?`, params);
    if (result.affectedRows === 0) throw notFound('Route not found');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') throw badRequest('Route with this prefix+supplier already exists');
    throw e;
  }
  return getRoute(id);
}

export async function deleteRoute(id) {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM routes WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw notFound('Route not found');
  return { deleted: true };
}

export async function lookupRoute(destination) {
  const pool = getPool();
  const [rows] = await pool.execute('CALL sp_route_lookup(?)', [destination]);
  return rows[0] || [];
}
