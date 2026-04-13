/**
 * Resolve IPRN range row for a dialed number (digits only).
 * Uses tables iprn_inv_* (see /sql/iprn_inventory.sql).
 * Numeric comparison on range_start / range_end when both are digit-only.
 */

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function inRange(did, start, end) {
  const d = digitsOnly(did);
  const a = digitsOnly(start);
  const b = digitsOnly(end);
  if (!d || !a || !b) return false;
  if (a.length !== b.length) {
    const dn = BigInt(d);
    try {
      return dn >= BigInt(a) && dn <= BigInt(b);
    } catch {
      return false;
    }
  }
  return d >= a && d <= b;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {string} number - full DID digits
 * @returns {Promise<object|null>}
 */
export async function getRoute(pool, number) {
  if (!pool) return null;
  const d = digitsOnly(number);
  if (!d) return null;
  const [rows] = await pool.query(
    `SELECT n.*, s.name AS supplier_name, s.sip_host
     FROM iprn_inv_numbers n
     LEFT JOIN iprn_inv_suppliers s ON s.id = n.supplier_id
     WHERE n.status = 'ACTIVE'`
  );
  const list = rows || [];
  for (const row of list) {
    if (inRange(d, row.range_start, row.range_end)) return row;
  }
  return null;
}
