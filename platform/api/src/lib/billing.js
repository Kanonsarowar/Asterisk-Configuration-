import { query, executeRaw } from '../db.js';
import { getBillingSettings } from './settings.js';
import { matchesCliRegex } from './routingEngine.js';

/**
 * Billable seconds: apply minimum + round up to increment (telecom rounding).
 */
export function computeBilledSeconds(rawSeconds, opts) {
  const min = Math.max(0, Number(opts.minimum_bill_seconds) || 0);
  const inc = Math.max(1, Number(opts.increment_seconds) || 1);
  let s = Math.max(0, Math.floor(Number(rawSeconds) || 0));
  if (s > 0 && s < min) s = min;
  if (s > 0 && inc > 1) {
    const rem = s % inc;
    if (rem !== 0) s = s + (inc - rem);
  }
  return s;
}

export function costFromRate(billedSeconds, ratePerMin) {
  const r = Number(ratePerMin) || 0;
  return (billedSeconds / 60) * r;
}

/**
 * After CDR row exists: compute revenue (user rate), cost (supplier), profit, deduct balance.
 */
export async function finalizeCdrFinancials(cdrId) {
  const settings = await getBillingSettings();
  const row = (
    await query(
      `SELECT c.id, c.duration, c.destination, c.cli, c.customer_id, c.number_id, c.supplier_id, c.user_id,
              c.matched_prefix,
              n.rate_per_min, s.cost_per_minute, c.financials_applied_at
       FROM cdr c
       LEFT JOIN numbers n ON n.id = c.number_id
       LEFT JOIN suppliers s ON s.id = c.supplier_id
       WHERE c.id = ?`,
      [cdrId]
    )
  ).rows[0];
  if (!row) return null;
  if (row.financials_applied_at) {
    return {
      billed_duration: null,
      revenue: null,
      cost: null,
      profit: null,
      skipped: true,
    };
  }

  const billed = computeBilledSeconds(row.duration, settings);
  const userRate = Number(row.rate_per_min) || 0;

  let supplierRate = Number(row.cost_per_minute) || 0;
  const d = String(row.destination || '').replace(/\D/g, '');
  const cli = String(row.cli || '');
  if (d && row.supplier_id) {
    const rt = await query(
      `SELECT r.rate, r.allowed_cli_regex FROM routes r
       WHERE r.active = 1 AND r.supplier_id = ?
         AND ? LIKE CONCAT(r.prefix, '%')
       ORDER BY CHAR_LENGTH(r.prefix) DESC`,
      [row.supplier_id, d]
    );
    const hit = rt.rows.find((r) => matchesCliRegex(r.allowed_cli_regex, cli));
    const routeRate = hit?.rate;
    if (routeRate != null && Number(routeRate) > 0) {
      supplierRate = Number(routeRate);
    }
  }

  const revenue = costFromRate(billed, userRate);
  const cost = costFromRate(billed, supplierRate);
  const profit = revenue - cost;

  const upd = await executeRaw(
    `UPDATE cdr SET billed_duration = ?, revenue = ?, cost = ?, profit = ?, financials_applied_at = UTC_TIMESTAMP(3) WHERE id = ? AND financials_applied_at IS NULL`,
    [billed, revenue, cost, profit, cdrId]
  );

  if (!upd.affectedRows) {
    return { billed_duration: billed, revenue, cost, profit, skipped: true };
  }

  if (row.user_id && revenue > 0) {
    await query(`UPDATE users SET balance = balance - ? WHERE id = ?`, [revenue, row.user_id]);
  }

  return { billed_duration: billed, revenue, cost, profit };
}
