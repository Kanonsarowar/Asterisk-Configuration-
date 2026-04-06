import { getPool } from '../../db.js';

export async function listCdr({
  start_from, start_to, cli, destination, disposition,
  supplier_id, user_id, prefix_matched, limit = 100, offset = 0,
}) {
  const pool = getPool();
  let sql = `SELECT c.*, s.name AS supplier_name, u.username
    FROM cdr c
    LEFT JOIN suppliers s ON s.id = c.supplier_id
    LEFT JOIN users u ON u.id = c.user_id
    WHERE 1=1`;
  const params = [];

  if (start_from) { sql += ' AND c.start_time >= ?'; params.push(start_from); }
  if (start_to) { sql += ' AND c.start_time <= ?'; params.push(start_to); }
  if (cli) { sql += ' AND c.cli LIKE ?'; params.push(`%${cli}%`); }
  if (destination) { sql += ' AND c.destination LIKE ?'; params.push(`%${destination}%`); }
  if (disposition) { sql += ' AND c.disposition = ?'; params.push(disposition); }
  if (supplier_id) { sql += ' AND c.supplier_id = ?'; params.push(supplier_id); }
  if (user_id) { sql += ' AND c.user_id = ?'; params.push(user_id); }
  if (prefix_matched) { sql += ' AND c.prefix_matched = ?'; params.push(prefix_matched); }

  const countSql = sql.replace(/SELECT c\.\*.*FROM/, 'SELECT COUNT(*) AS total FROM');
  const [[{ total }]] = await pool.execute(countSql, params);

  sql += ` ORDER BY c.start_time DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  const [rows] = await pool.execute(sql, params);

  return { total, limit, offset, data: rows };
}

export async function getCdr(id) {
  const pool = getPool();
  const [rows] = await pool.execute('SELECT * FROM cdr WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function getCdrCsv(filters) {
  const result = await listCdr({ ...filters, limit: 50000, offset: 0 });
  const headers = [
    'id', 'call_id', 'cli', 'destination', 'start_time', 'answer_time', 'end_time',
    'duration', 'billed_duration', 'cost', 'revenue', 'profit', 'disposition',
    'supplier_id', 'user_id', 'prefix_matched',
  ];

  const escCsv = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  let csv = headers.join(',') + '\n';
  for (const row of result.data) {
    csv += headers.map(h => escCsv(row[h])).join(',') + '\n';
  }
  return csv;
}

export async function getSummary({ start_from, start_to }) {
  const pool = getPool();
  let sql = `SELECT
    COUNT(*) AS total_calls,
    SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
    COALESCE(SUM(duration), 0) AS total_duration,
    COALESCE(SUM(billed_duration), 0) AS total_billed,
    COALESCE(SUM(cost), 0) AS total_cost,
    COALESCE(SUM(revenue), 0) AS total_revenue,
    COALESCE(SUM(profit), 0) AS total_profit,
    COALESCE(AVG(CASE WHEN disposition = 'ANSWERED' THEN duration ELSE NULL END), 0) AS acd
    FROM cdr WHERE 1=1`;
  const params = [];
  if (start_from) { sql += ' AND start_time >= ?'; params.push(start_from); }
  if (start_to) { sql += ' AND start_time <= ?'; params.push(start_to); }

  const [[row]] = await pool.execute(sql, params);
  const asr = row.total_calls > 0 ? (row.answered / row.total_calls * 100) : 0;
  return { ...row, asr: Math.round(asr * 100) / 100 };
}
