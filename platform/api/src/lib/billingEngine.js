import { query } from '../db.js';
import { getBillingSettings } from './settings.js';
import { matchesCliRegex } from './routingEngine.js';

const ISO4217 = /^[A-Z]{3}$/;

/**
 * @typedef {object} BillingRoundingOptions
 * @property {number} minimum_bill_seconds
 * @property {number} increment_seconds
 */

/**
 * Billable seconds: minimum duration floor + round up to increment (telecom).
 * @param {number} rawSeconds
 * @param {BillingRoundingOptions} opts
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

/**
 * cost = billed_seconds / 60 * rate_per_minute
 * @param {number} billedSeconds
 * @param {number|string} ratePerMin
 */
export function amountFromBilledRate(billedSeconds, ratePerMin) {
  const r = Number(ratePerMin) || 0;
  const b = Math.max(0, Math.floor(Number(billedSeconds) || 0));
  return (b / 60) * r;
}

/**
 * Normalize ISO 4217 or fallback to settings default.
 */
export function resolveBillingCurrency(userCurrency, settings) {
  const def = String(settings.default_billing_currency || 'USD').toUpperCase();
  const u = String(userCurrency || '').toUpperCase();
  if (u && ISO4217.test(u)) return u;
  return def;
}

/**
 * @param {object} settings from getBillingSettings (may include currencies map)
 * @param {string} code
 */
export function currencyDecimals(settings, code) {
  const cur = settings.currencies && typeof settings.currencies === 'object' ? settings.currencies[code] : null;
  const d = cur && cur.decimals != null ? Number(cur.decimals) : 6;
  return Number.isFinite(d) && d >= 0 && d <= 8 ? d : 6;
}

/**
 * Longest matching route prefix for supplier + destination; respects allowed_cli_regex.
 * @returns {{ prefix: string, rate: number } | null}
 */
export async function resolveSupplierRouteRate(supplierId, destinationDigits, cli) {
  if (!supplierId || !destinationDigits) return null;
  const d = String(destinationDigits).replace(/\D/g, '');
  if (!d) return null;
  const rt = await query(
    `SELECT r.prefix, r.rate, r.allowed_cli_regex FROM routes r
     WHERE r.active = 1 AND r.supplier_id = ?
       AND ? LIKE CONCAT(r.prefix, '%')
     ORDER BY CHAR_LENGTH(r.prefix) DESC`,
    [supplierId, d]
  );
  const hit = rt.rows.find((r) => matchesCliRegex(r.allowed_cli_regex, cli));
  if (!hit) return null;
  const pfx = String(hit.prefix || '').replace(/\D/g, '');
  return { prefix: pfx, rate: Number(hit.rate) || 0 };
}

/**
 * For one call: identify billing prefix and per-minute rates (user sell vs supplier buy).
 *
 * @param {object} p
 * @param {string|null} p.destinationDigits
 * @param {string} p.cli
 * @param {number|null} p.supplierId
 * @param {number|null} p.numberId
 * @param {string|null} p.matchedPrefixFromCdr — already stored on CDR from routing
 * @returns {Promise<{ billingPrefix: string|null, userRatePerMin: number, supplierRatePerMin: number, rateSource: string }>}
 */
export async function resolveRatesForCall(p) {
  const dest = String(p.destinationDigits || '').replace(/\D/g, '');
  const cli = String(p.cli || '');

  let numRow = null;
  if (p.numberId) {
    const n = await query(
      `SELECT id, prefix, rate_per_min FROM numbers WHERE id = ?`,
      [p.numberId]
    );
    numRow = n.rows[0] || null;
  }

  const userRate = Number(numRow?.rate_per_min) || 0;

  let billingPrefix =
    (p.matchedPrefixFromCdr && String(p.matchedPrefixFromCdr).replace(/\D/g, '')) ||
    (numRow?.prefix != null ? String(numRow.prefix).replace(/\D/g, '') : '') ||
    null;

  let supplierRate = 0;
  if (p.supplierId) {
    const s = await query(`SELECT cost_per_minute FROM suppliers WHERE id = ?`, [p.supplierId]);
    supplierRate = Number(s.rows[0]?.cost_per_minute) || 0;
  }

  if (p.supplierId && dest) {
    const route = await resolveSupplierRouteRate(p.supplierId, dest, cli);
    if (route && route.rate > 0) {
      supplierRate = route.rate;
      if (!billingPrefix && route.prefix) billingPrefix = route.prefix;
    }
  }

  if (!billingPrefix && dest && numRow?.prefix) {
    billingPrefix = String(numRow.prefix).replace(/\D/g, '') || null;
  }

  return {
    billingPrefix: billingPrefix || null,
    userRatePerMin: userRate,
    supplierRatePerMin: supplierRate,
    rateSource: 'number_user_rate_and_supplier_or_route',
  };
}

/**
 * Pure financial snapshot for one call (amounts in account currency).
 */
export function computeCallFinancials(durationSeconds, userRatePerMin, supplierRatePerMin, roundingOpts) {
  const billed = computeBilledSeconds(durationSeconds, roundingOpts);
  const revenue = amountFromBilledRate(billed, userRatePerMin);
  const cost = amountFromBilledRate(billed, supplierRatePerMin);
  const profit = revenue - cost;
  return { billed_seconds: billed, revenue, cost, profit };
}

/**
 * Aggregate CDR rows for invoice / statement (same currency as stored amounts).
 */
export async function buildUserInvoiceSummary(userId, periodStart, periodEnd) {
  const ps = periodStart || '1970-01-01';
  const pe = periodEnd || '9999-12-31';
  const totals = await query(
    `SELECT
       COUNT(*) AS call_count,
       COALESCE(SUM(duration), 0) AS raw_duration_seconds,
       COALESCE(SUM(billed_duration), 0) AS billed_duration_seconds,
       COALESCE(SUM(revenue), 0) AS total_revenue,
       COALESCE(SUM(cost), 0) AS total_cost,
       COALESCE(SUM(profit), 0) AS total_profit
     FROM cdr
     WHERE user_id = ?
       AND financials_applied_at IS NOT NULL
       AND created_at >= ?
       AND created_at < ?`,
    [userId, ps, pe]
  );

  const byPrefix = await query(
    `SELECT
       COALESCE(matched_prefix, '') AS prefix,
       COUNT(*) AS calls,
       COALESCE(SUM(billed_duration), 0) AS billed_seconds,
       COALESCE(SUM(revenue), 0) AS revenue,
       COALESCE(SUM(cost), 0) AS cost,
       COALESCE(SUM(profit), 0) AS profit
     FROM cdr
     WHERE user_id = ?
       AND financials_applied_at IS NOT NULL
       AND created_at >= ?
       AND created_at < ?
     GROUP BY COALESCE(matched_prefix, '')
     ORDER BY revenue DESC`,
    [userId, ps, pe]
  );

  const t = totals.rows[0] || {};
  return {
    user_id: userId,
    period: { start: periodStart, end: periodEnd },
    calls: Number(t.call_count) || 0,
    raw_duration_seconds: Number(t.raw_duration_seconds) || 0,
    billed_duration_seconds: Number(t.billed_duration_seconds) || 0,
    total_revenue: Number(t.total_revenue) || 0,
    total_cost: Number(t.total_cost) || 0,
    total_profit: Number(t.total_profit) || 0,
    by_prefix: byPrefix.rows.map((r) => ({
      prefix: r.prefix || '(none)',
      calls: Number(r.calls) || 0,
      billed_seconds: Number(r.billed_seconds) || 0,
      revenue: Number(r.revenue) || 0,
      cost: Number(r.cost) || 0,
      profit: Number(r.profit) || 0,
    })),
  };
}
