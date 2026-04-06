import { query } from '../db.js';
import { digitsOnly } from './rbac.js';
import { findNumberForDestination, resolveRouteSuppliers } from './routingEngine.js';
import { finalizeCdrFinancials } from './billing.js';

function isDup(e) {
  return e && (e.code === 'ER_DUP_ENTRY' || e.errno === 1062);
}

/**
 * Build CDR row from PBX / ODBC payload and persist with billing finalize.
 * @param {object} b
 * @param {{ skipFinalize?: boolean }} opts
 */
export async function insertCdrFromPbx(b, opts = {}) {
  const dest = digitsOnly(b.destination);
  const num = await findNumberForDestination(dest);
  const customerId = num?.customer_id ?? null;
  const userRow = customerId
    ? (await query('SELECT user_id FROM customers WHERE id = ?', [customerId])).rows[0]
    : null;
  const userId = userRow?.user_id ?? null;
  const suppliers = await resolveRouteSuppliers(dest, b.cli || '', num);
  const supplierId = b.supplier_id ?? suppliers[0]?.supplier_id ?? num?.supplier_id ?? null;

  const matchedPrefix =
    b.matched_prefix != null && String(b.matched_prefix).length > 0
      ? String(b.matched_prefix).replace(/\D/g, '')
      : suppliers[0]?.prefix != null
        ? String(suppliers[0].prefix).replace(/\D/g, '')
        : num?.prefix != null
          ? String(num.prefix).replace(/\D/g, '')
          : null;

  const params = [
    b.call_id || null,
    b.uniqueid || null,
    b.cli ? digitsOnly(b.cli) || b.cli : null,
    dest || null,
    b.start_time || null,
    b.answer_time || null,
    b.end_time || null,
    b.duration ?? 0,
    b.disposition || null,
    supplierId,
    userId,
    customerId,
    num?.id ?? null,
    matchedPrefix || null,
  ];

  let id;
  try {
    const ins = await query(
      `INSERT INTO cdr (call_id, uniqueid, cli, destination, start_time, answer_time, end_time, duration, disposition, supplier_id, user_id, customer_id, number_id, matched_prefix)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params
    );
    id = ins.insertId;
  } catch (e) {
    if (isDup(e) && b.uniqueid) {
      const ex = (await query('SELECT id FROM cdr WHERE uniqueid = ? LIMIT 1', [b.uniqueid])).rows[0];
      if (ex) {
        id = ex.id;
        if (!opts.skipFinalize) {
          await finalizeCdrFinancials(id);
        }
        return { id, deduped: true };
      }
    }
    throw e;
  }

  if (!opts.skipFinalize) {
    await finalizeCdrFinancials(id);
  }
  return { id };
}
