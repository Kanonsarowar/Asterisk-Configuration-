/**
 * IPRN range inventory (iprn_inv_* tables). Requires MySQL + migrated schema.
 */
import { getMysqlPool } from './mysql.js';

export async function insertIprnSupplier(body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const name = String(body?.name || '').slice(0, 100) || 'Supplier';
  const country = String(body?.country || '').slice(0, 50);
  const sip_host = String(body?.sip_host || '').slice(0, 100);
  const protocol = body?.protocol === 'IAX' ? 'IAX' : 'SIP';
  const rel = parseFloat(body?.reliability_score) || 0;
  const [r] = await p.execute(
    'INSERT INTO iprn_inv_suppliers (name, country, sip_host, protocol, reliability_score) VALUES (?, ?, ?, ?, ?)',
    [name, country, sip_host, protocol, rel]
  );
  return { id: r.insertId };
}

export async function listIprnSuppliers() {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows] = await p.query(
    'SELECT id, name, country, sip_host, protocol, reliability_score FROM iprn_inv_suppliers ORDER BY name ASC'
  );
  return rows || [];
}

export async function listIprnRangeNumbers() {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows] = await p.query(
    `SELECT n.*, s.name AS supplier_name
     FROM iprn_inv_numbers n
     LEFT JOIN iprn_inv_suppliers s ON s.id = n.supplier_id
     ORDER BY n.id DESC`
  );
  return rows || [];
}

export async function insertIprnRange(body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const {
    country = '',
    prefix = '',
    range_start = '',
    range_end = '',
    supplier_id = null,
    access_type = 'IVR',
    type = 'IPRN',
  } = body || {};
  const [r] = await p.execute(
    `INSERT INTO iprn_inv_numbers
     (country, prefix, range_start, range_end, supplier_id, access_type, type, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW')`,
    [
      String(country).slice(0, 50),
      String(prefix).slice(0, 20),
      String(range_start).slice(0, 20),
      String(range_end).slice(0, 20),
      supplier_id ? parseInt(String(supplier_id), 10) : null,
      ['IVR', 'DIRECT', 'SIP'].includes(access_type) ? access_type : 'IVR',
      type === 'TEST' ? 'TEST' : 'IPRN',
    ]
  );
  const id = r.insertId;
  await p.execute(
    'INSERT INTO iprn_inv_pricing (number_id, buy_rate, sell_rate, billing_type, margin) VALUES (?, 0, 0, \'PER_MIN\', 0)',
    [id]
  );
  await p.execute(
    'INSERT INTO iprn_inv_stats (number_id, asr, acd, total_calls, revenue) VALUES (?, 0, 0, 0, 0)',
    [id]
  );
  return { id };
}

export async function updateIprnRangeStatus(id, status) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const allowed = ['NEW', 'TESTING', 'ACTIVE', 'DEGRADED', 'BLOCKED', 'ARCHIVED'];
  if (!allowed.includes(status)) throw new Error('Invalid status');
  await p.execute('UPDATE iprn_inv_numbers SET status = ? WHERE id = ?', [status, parseInt(id, 10)]);
  return { success: true };
}

export async function listIprnRangeStats() {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows] = await p.query(
    `SELECT s.*, n.range_start, n.range_end, n.prefix
     FROM iprn_inv_stats s
     JOIN iprn_inv_numbers n ON n.id = s.number_id`
  );
  return rows || [];
}
