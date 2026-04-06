import { getPool } from '../../db.js';
import { config } from '../../config.js';
import { notFound, badRequest } from '../../lib/errors.js';

export function computeBilledDuration(rawSeconds) {
  const inc = config.billing.incrementSeconds;
  const min = config.billing.minDurationSeconds;
  if (rawSeconds <= 0) return 0;
  const effective = Math.max(rawSeconds, min);
  return Math.ceil(effective / inc) * inc;
}

export function computeCost(billedSeconds, ratePerMin) {
  return Math.round((billedSeconds / 60) * ratePerMin * 1e6) / 1e6;
}

export async function processCall({ call_id, cli, destination, start_time, answer_time, end_time, duration, disposition, supplier_id, user_id }) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let costRate = 0;
    let sellRate = 0;
    let prefixMatched = '';

    const [routes] = await conn.execute('CALL sp_route_lookup(?)', [destination]);
    const matched = (routes[0] || [])[0];
    if (matched) {
      costRate = Number(matched.cost_per_min) || 0;
      prefixMatched = matched.prefix;
    }

    const [numRows] = await conn.execute(
      `SELECT rate_per_min FROM numbers
       WHERE LEFT(?, LENGTH(prefix)) = prefix AND status != 'blocked'
       ORDER BY LENGTH(prefix) DESC LIMIT 1`,
      [destination]
    );
    if (numRows.length) {
      sellRate = Number(numRows[0].rate_per_min) || 0;
    }

    const billedDuration = disposition === 'ANSWERED' ? computeBilledDuration(duration) : 0;
    const cost = computeCost(billedDuration, costRate);
    const revenue = computeCost(billedDuration, sellRate);

    const [ins] = await conn.execute(
      `INSERT INTO cdr (call_id, cli, destination, start_time, answer_time, end_time,
        duration, billed_duration, cost, revenue, disposition, supplier_id, user_id, prefix_matched)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [call_id, cli, destination, start_time, answer_time || null, end_time || null,
       duration, billedDuration, cost, revenue, disposition,
       supplier_id || (matched ? matched.supplier_id : null),
       user_id || null, prefixMatched]
    );

    if (user_id && cost > 0) {
      await conn.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [cost, user_id]);
    }

    await conn.commit();
    return {
      cdr_id: String(ins.insertId),
      billed_duration: billedDuration,
      cost,
      revenue,
      profit: Math.round((revenue - cost) * 1e6) / 1e6,
      prefix_matched: prefixMatched,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function listInvoices({ user_id, status, limit = 50, offset = 0 }) {
  const pool = getPool();
  let sql = `SELECT i.*, u.username FROM invoices i
    LEFT JOIN users u ON u.id = i.user_id WHERE 1=1`;
  const params = [];
  if (user_id) { sql += ' AND i.user_id = ?'; params.push(user_id); }
  if (status) { sql += ' AND i.status = ?'; params.push(status); }
  sql += ` ORDER BY i.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export async function getInvoice(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT i.*, u.username FROM invoices i
     LEFT JOIN users u ON u.id = i.user_id WHERE i.id = ?`,
    [id]
  );
  if (!rows.length) throw notFound('Invoice not found');
  return rows[0];
}

export async function generateInvoice({ user_id, period_start, period_end }) {
  const pool = getPool();

  const [userRows] = await pool.execute('SELECT id, username FROM users WHERE id = ?', [user_id]);
  if (!userRows.length) throw notFound('User not found');

  const [[summary]] = await pool.execute(
    `SELECT
       COUNT(*) AS total_calls,
       COALESCE(SUM(billed_duration), 0) AS total_billed_seconds,
       COALESCE(SUM(cost), 0) AS total_cost,
       COALESCE(SUM(revenue), 0) AS total_revenue,
       COALESCE(SUM(profit), 0) AS total_profit
     FROM cdr
     WHERE user_id = ? AND start_time >= ? AND start_time < DATE_ADD(?, INTERVAL 1 DAY)`,
    [user_id, period_start, period_end]
  );

  const totalAmount = Number(summary.total_revenue) || 0;
  const meta = {
    total_calls: summary.total_calls,
    total_billed_seconds: Number(summary.total_billed_seconds),
    total_cost: Number(summary.total_cost),
    total_revenue: Number(summary.total_revenue),
    total_profit: Number(summary.total_profit),
  };

  const [result] = await pool.execute(
    `INSERT INTO invoices (user_id, total_amount, period_start, period_end, status, meta)
     VALUES (?, ?, ?, ?, 'draft', ?)`,
    [user_id, totalAmount, period_start, period_end, JSON.stringify(meta)]
  );

  return getInvoice(result.insertId);
}

export async function updateInvoiceStatus(id, status) {
  const pool = getPool();
  const valid = ['draft', 'pending', 'paid', 'overdue', 'cancelled'];
  if (!valid.includes(status)) throw badRequest(`Invalid status. Must be: ${valid.join(', ')}`);
  const [result] = await pool.execute('UPDATE invoices SET status = ? WHERE id = ?', [status, id]);
  if (result.affectedRows === 0) throw notFound('Invoice not found');
  return getInvoice(id);
}
