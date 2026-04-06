import { getPool } from '../../db.js';
import { notFound, badRequest } from '../../lib/errors.js';

const COLUMNS = `id, prefix, range_start, range_end, country, supplier_id, customer_id,
  rate_per_min, type, status, ivr_slot, created_at, updated_at`;

export async function listNumbers({ prefix, country, type, status, supplier_id, limit = 100, offset = 0 }) {
  const pool = getPool();
  let sql = `SELECT ${COLUMNS} FROM numbers WHERE 1=1`;
  const params = [];
  if (prefix) { sql += ' AND prefix LIKE ?'; params.push(`${prefix}%`); }
  if (country) { sql += ' AND country = ?'; params.push(country); }
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (supplier_id) { sql += ' AND supplier_id = ?'; params.push(supplier_id); }
  sql += ` ORDER BY prefix, range_start LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getNumber(id) {
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM numbers WHERE id = ?`, [id]);
  if (!rows.length) throw notFound('Number not found');
  return rows[0];
}

export async function createNumber(data) {
  const pool = getPool();
  const [result] = await pool.execute(
    `INSERT INTO numbers (prefix, range_start, range_end, country, supplier_id, customer_id, rate_per_min, type, status, ivr_slot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.prefix, data.range_start || '', data.range_end || '',
      data.country || '', data.supplier_id || null, data.customer_id || null,
      data.rate_per_min || 0, data.type || 'premium',
      data.status || 'available', data.ivr_slot || null,
    ]
  );
  return getNumber(result.insertId);
}

export async function bulkCreateNumbers(rows) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const ids = [];
    for (const data of rows) {
      const [result] = await conn.execute(
        `INSERT INTO numbers (prefix, range_start, range_end, country, supplier_id, rate_per_min, type, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [data.prefix, data.range_start || '', data.range_end || '',
         data.country || '', data.supplier_id || null,
         data.rate_per_min || 0, data.type || 'premium', 'available']
      );
      ids.push(result.insertId);
    }
    await conn.commit();
    return { inserted: ids.length, ids };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateNumber(id, data) {
  const pool = getPool();
  const allowed = ['prefix', 'range_start', 'range_end', 'country', 'supplier_id',
    'customer_id', 'rate_per_min', 'type', 'status', 'ivr_slot'];
  const sets = [];
  const params = [];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      sets.push(`\`${key}\` = ?`);
      params.push(data[key] === '' && ['supplier_id', 'customer_id', 'ivr_slot'].includes(key) ? null : data[key]);
    }
  }
  if (!sets.length) throw badRequest('No valid fields to update');
  params.push(id);
  const [result] = await pool.execute(`UPDATE numbers SET ${sets.join(', ')} WHERE id = ?`, params);
  if (result.affectedRows === 0) throw notFound('Number not found');
  return getNumber(id);
}

export async function deleteNumber(id) {
  const pool = getPool();
  const [result] = await pool.execute('DELETE FROM numbers WHERE id = ?', [id]);
  if (result.affectedRows === 0) throw notFound('Number not found');
  return { deleted: true };
}
