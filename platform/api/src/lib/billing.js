import { query, executeRaw } from '../db.js';
import { getBillingSettings } from './settings.js';
import {
  amountFromBilledRate,
  resolveBillingCurrency,
  resolveRatesForCall,
  computeCallFinancials,
  buildUserInvoiceSummary,
} from './billingEngine.js';

export {
  computeBilledSeconds,
  amountFromBilledRate,
  resolveBillingCurrency,
  currencyDecimals,
  resolveSupplierRouteRate,
  resolveRatesForCall,
  computeCallFinancials,
  buildUserInvoiceSummary,
} from './billingEngine.js';

/** Same as amountFromBilledRate — kept for older call sites */
export function costFromRate(billedSeconds, ratePerMin) {
  return amountFromBilledRate(billedSeconds, ratePerMin);
}

/**
 * After CDR row exists: identify prefix & rates, billed seconds (min + increment),
 * revenue / cost / profit, deduct user balance (revenue). Idempotent.
 */
export async function finalizeCdrFinancials(cdrId) {
  const settings = await getBillingSettings();
  const row = (
    await query(
      `SELECT c.id, c.duration, c.destination, c.cli, c.customer_id, c.number_id, c.supplier_id, c.user_id,
              c.matched_prefix, c.financials_applied_at
       FROM cdr c
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

  const destDigits = String(row.destination || '').replace(/\D/g, '');
  const rates = await resolveRatesForCall({
    destinationDigits: destDigits,
    cli: row.cli || '',
    supplierId: row.supplier_id,
    numberId: row.number_id,
    matchedPrefixFromCdr: row.matched_prefix,
  });

  const fin = computeCallFinancials(row.duration, rates.userRatePerMin, rates.supplierRatePerMin, settings);

  let billingCurrency = resolveBillingCurrency(null, settings);
  if (row.user_id) {
    const u = await query(`SELECT billing_currency FROM users WHERE id = ?`, [row.user_id]);
    billingCurrency = resolveBillingCurrency(u.rows[0]?.billing_currency, settings);
  }

  const matchedPrefix = rates.billingPrefix || row.matched_prefix || null;

  const upd = await executeRaw(
    `UPDATE cdr SET
       billed_duration = ?,
       revenue = ?,
       cost = ?,
       profit = ?,
       matched_prefix = COALESCE(?, matched_prefix),
       billing_currency = ?,
       user_rate_per_min = ?,
       supplier_rate_per_min = ?,
       financials_applied_at = UTC_TIMESTAMP(3)
     WHERE id = ? AND financials_applied_at IS NULL`,
    [
      fin.billed_seconds,
      fin.revenue,
      fin.cost,
      fin.profit,
      matchedPrefix,
      billingCurrency,
      rates.userRatePerMin,
      rates.supplierRatePerMin,
      cdrId,
    ]
  );

  if (!upd.affectedRows) {
    return { billed_duration: fin.billed_seconds, revenue: fin.revenue, cost: fin.cost, profit: fin.profit, skipped: true };
  }

  if (row.user_id && fin.revenue > 0) {
    await query(`UPDATE users SET balance = balance - ? WHERE id = ?`, [fin.revenue, row.user_id]);
  }

  return {
    billed_duration: fin.billed_seconds,
    revenue: fin.revenue,
    cost: fin.cost,
    profit: fin.profit,
    billing_prefix: matchedPrefix,
    billing_currency: billingCurrency,
    user_rate_per_min: rates.userRatePerMin,
    supplier_rate_per_min: rates.supplierRatePerMin,
  };
}
