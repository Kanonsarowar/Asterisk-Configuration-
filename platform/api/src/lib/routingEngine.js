import { query } from '../db.js';
import { digitsOnly } from './rbac.js';
import { getBillingSettings, getFraudSettings } from './settings.js';

/** In-process CPS + CLI counters (reset hourly buckets) */
const cpsBuckets = new Map();
const cliHourly = new Map();

/** Per calendar-minute per-user: { calls, dests: Set } */
const userMinuteStats = new Map();

function currentSecond() {
  return Math.floor(Date.now() / 1000);
}

function currentHour() {
  return Math.floor(Date.now() / 3600000);
}

function currentMinuteBucket() {
  return Math.floor(Date.now() / 60000);
}

function pruneCps() {
  const sec = currentSecond();
  for (const [k, t] of cpsBuckets) {
    if (t < sec - 2) cpsBuckets.delete(k);
  }
}

function pruneUserMinuteStats(nowBucket) {
  for (const k of userMinuteStats.keys()) {
    const m = parseInt(k.split(':')[0], 10);
    if (!Number.isFinite(m) || nowBucket - m > 2) userMinuteStats.delete(k);
  }
}

export function recordCpsEvent() {
  pruneCps();
  const sec = currentSecond();
  cpsBuckets.set(sec, (cpsBuckets.get(sec) || 0) + 1);
  let sum = 0;
  for (const [s, n] of cpsBuckets) {
    if (s >= sec - 1) sum += n;
  }
  return sum;
}

export function recordCliCall(cliDigits) {
  const h = currentHour();
  const key = `${h}:${cliDigits}`;
  cliHourly.set(key, (cliHourly.get(key) || 0) + 1);
  return cliHourly.get(key);
}

/**
 * Track routing attempts per user per wall-clock minute (approx. rolling minute).
 * @returns {{ calls: number, uniqueDestinations: number }}
 */
export function recordUserRoutingMinute(userId, destinationDigits) {
  if (userId == null || !Number.isFinite(Number(userId))) {
    return { calls: 0, uniqueDestinations: 0 };
  }
  const bucket = currentMinuteBucket();
  pruneUserMinuteStats(bucket);
  const key = `${bucket}:${userId}`;
  let b = userMinuteStats.get(key);
  if (!b) {
    b = { calls: 0, dests: new Set() };
    userMinuteStats.set(key, b);
  }
  b.calls += 1;
  const d = String(destinationDigits || '').replace(/\D/g, '').slice(0, 24);
  if (d) b.dests.add(d);
  return { calls: b.calls, uniqueDestinations: b.dests.size };
}

function compileRegexList(patterns) {
  const out = [];
  if (!Array.isArray(patterns)) return out;
  for (const p of patterns) {
    if (!p || typeof p !== 'string') continue;
    try {
      out.push(new RegExp(p));
    } catch {
      /* skip invalid */
    }
  }
  return out;
}

/**
 * Block anonymous / obviously forged CLIs. Stricter rules when `premium` number.
 */
export function validateCli(cli, fraudSettings, { premium = false } = {}) {
  const f = fraudSettings || {};
  const d = digitsOnly(cli);

  if (f.block_empty_cli !== false && !d) {
    return { allow: false, reason: 'cli_empty' };
  }

  const minLen = Math.max(0, Number(f.cli_min_digits) || 0);
  if (minLen > 0 && d.length > 0 && d.length < minLen) {
    return { allow: false, reason: 'cli_too_short' };
  }

  for (const re of compileRegexList(f.cli_blocked_regexes)) {
    if (re.test(String(cli || '')) || re.test(d)) {
      return { allow: false, reason: 'cli_blocked_pattern' };
    }
  }

  if (f.block_repeated_digit_cli !== false && d.length >= 6) {
    const first = d[0];
    if ([...d].every((ch) => ch === first)) {
      return { allow: false, reason: 'cli_repeated_digits' };
    }
  }

  const strict = premium && f.strict_cli_on_premium !== false;
  if (strict) {
    for (const re of compileRegexList(f.premium_cli_extra_regexes)) {
      if (re.test(String(cli || '')) || re.test(d)) {
        return { allow: false, reason: 'cli_premium_rule' };
      }
    }
  }

  return { allow: true };
}

/**
 * Global CPS, per-CLI hourly, per-user per-minute, unique-dest burst, CLI shape.
 * @param {string} cli
 * @param {{ userId?: number, destinationDigits?: string }} ctx
 */
export async function checkFraudAndCps(cli, ctx = {}) {
  const fraud = await getFraudSettings();
  const billing = await getBillingSettings();
  const cps = recordCpsEvent();
  if (cps > (billing.max_cps_global || 50)) {
    return { allow: false, reason: 'cps_limit' };
  }

  const destDigits = ctx.destinationDigits ? digitsOnly(ctx.destinationDigits) : '';
  let premium = false;
  if (destDigits) {
    const num = await findNumberForDestination(destDigits);
    premium = num?.type === 'premium';
  }

  const cliCheck = validateCli(cli, fraud, { premium });
  if (!cliCheck.allow) return cliCheck;

  if (!fraud.enabled) {
    return { allow: true };
  }

  const d = digitsOnly(cli);
  if (d) {
    const n = recordCliCall(d);
    if (n > (fraud.max_calls_per_cli_per_hour || 120)) {
      return { allow: false, reason: 'cli_hourly_limit' };
    }
  }

  if (ctx.userId != null && Number.isFinite(Number(ctx.userId))) {
    const { calls, uniqueDestinations } = recordUserRoutingMinute(ctx.userId, destDigits);
    const maxU = Number(fraud.max_calls_per_user_per_minute);
    if (Number.isFinite(maxU) && maxU > 0 && calls > maxU) {
      return { allow: false, reason: 'user_cpm_limit' };
    }
    const maxD = Number(fraud.max_unique_destinations_per_user_per_minute);
    if (Number.isFinite(maxD) && maxD > 0 && uniqueDestinations > maxD) {
      return { allow: false, reason: 'user_dest_burst' };
    }
  }

  return { allow: true };
}

/**
 * Find inventory row for destination (longest prefix / range match).
 */
export async function findNumberForDestination(dest) {
  const d = digitsOnly(dest);
  if (!d) return null;
  const r = await query(
    `SELECT n.*, i.name AS ivr_name, i.audio_file AS ivr_file, i.language AS ivr_language,
            s.name AS supplier_name, s.host AS sip_host, s.port AS sip_port,
            s.username AS sip_username, s.password AS sip_password, s.protocol,
            s.cost_per_minute
     FROM numbers n
     LEFT JOIN ivr i ON i.id = n.ivr_id
     LEFT JOIN suppliers s ON s.id = n.supplier_id
     WHERE n.status <> 'blocked'
       AND (
         (n.did IS NOT NULL AND n.did = ?)
         OR (
           CAST(? AS UNSIGNED) BETWEEN CAST(n.range_start AS UNSIGNED) AND CAST(n.range_end AS UNSIGNED)
         )
       )
     ORDER BY CHAR_LENGTH(COALESCE(n.prefix, '')) DESC, n.id
     LIMIT 1`,
    [d, d]
  );
  return r.rows[0] || null;
}

export function matchesCliRegex(pattern, cli) {
  if (!pattern) return true;
  try {
    const re = new RegExp(pattern);
    return re.test(String(cli || ''));
  } catch {
    return true;
  }
}

/** Effective buy rate for LCR: route.rate if set, else supplier cost. */
export function effectiveSupplierCost(row) {
  const rr = Number(row.rate);
  if (Number.isFinite(rr) && rr > 0) return rr;
  return Number(row.cost_per_minute) || 0;
}

/**
 * Ordered supplier list for failover: try index 0, then 1, …
 * - routing_mode `priority`: sort by route priority, then cost, then supplier_id
 * - routing_mode `lcr`: sort by effective cost (least first), then priority, then supplier_id
 */
export async function resolveRouteSuppliers(dest, cli, numberRow, ctx = {}) {
  const d = digitsOnly(dest);
  const settings = await getBillingSettings();
  const mode = settings.routing_mode || 'priority';
  const premium = numberRow?.type === 'premium';
  void ctx;

  const routes = await query(
    `SELECT r.*, s.name, s.host, s.port, s.username, s.password, s.protocol, s.active, s.cost_per_minute
     FROM routes r
     JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.active = 1 AND s.active = 1
       AND ? LIKE CONCAT(r.prefix, '%')
     ORDER BY LENGTH(r.prefix) DESC`,
    [d]
  );

  let list = routes.rows.filter((row) => matchesCliRegex(row.allowed_cli_regex, cli));
  let longestRoutePrefixLen = 0;
  for (const row of list) {
    const plen = String(row.prefix || '').replace(/\D/g, '').length;
    if (plen > longestRoutePrefixLen) longestRoutePrefixLen = plen;
  }

  if (!list.length && numberRow?.supplier_id) {
    const s = await query(
      `SELECT id AS supplier_id, name, host, port, username, password, protocol, active, cost_per_minute
       FROM suppliers WHERE id = ? AND active = 1`,
      [numberRow.supplier_id]
    );
    if (s.rows[0]) {
      list = [
        {
          prefix: numberRow.prefix || '',
          supplier_id: s.rows[0].supplier_id,
          priority: 0,
          rate: Number(numberRow.rate_per_min) || 0,
          allowed_cli_regex: null,
          ...s.rows[0],
        },
      ];
    }
  }

  const tie = settings.lcr_tie_break || 'priority_then_supplier_id';

  const decorated = list.map((row) => ({
    ...row,
    _effective_cost: effectiveSupplierCost(row),
    _route_prefix_len: String(row.prefix || '').replace(/\D/g, '').length,
    premium_number: premium,
  }));

  if (mode === 'lcr') {
    decorated.sort((a, b) => {
      const c = a._effective_cost - b._effective_cost;
      if (c !== 0) return c;
      if (tie === 'supplier_id') return a.supplier_id - b.supplier_id;
      const p = a.priority - b.priority;
      if (p !== 0) return p;
      return a.supplier_id - b.supplier_id;
    });
  } else {
    decorated.sort((a, b) => {
      const p = a.priority - b.priority;
      if (p !== 0) return p;
      const c = a._effective_cost - b._effective_cost;
      if (c !== 0) return c;
      return a.supplier_id - b.supplier_id;
    });
  }

  const suppliers = decorated.map(({ _effective_cost, _route_prefix_len, ...rest }) => rest);

  const meta = {
    routing_mode: mode,
    premium_number: premium,
    failover_order: suppliers.map((s) => s.supplier_id),
    longest_route_prefix_length: longestRoutePrefixLen,
    lcr_active: mode === 'lcr',
  };

  return { suppliers, meta };
}

export function longestPrefix(did, len) {
  const d = digitsOnly(did);
  const n = Math.min(len || 5, d.length);
  return d.slice(0, n);
}

/**
 * Asterisk dialplan failover order for one prefix (matches resolveRouteSuppliers; ignores CLI regex).
 * @param {Array<{ supplier_id: number, priority: number, rate: unknown, cost_per_minute: unknown }>} routeRows
 */
export function orderSupplierIdsForPrefix(routeRows, settings) {
  const mode = (settings && settings.routing_mode) || 'priority';
  const tie = (settings && settings.lcr_tie_break) || 'priority_then_supplier_id';
  const arr = [...routeRows];
  if (mode === 'lcr') {
    arr.sort((a, b) => {
      const c = effectiveSupplierCost(a) - effectiveSupplierCost(b);
      if (c !== 0) return c;
      if (tie === 'supplier_id') return a.supplier_id - b.supplier_id;
      const p = Number(a.priority) - Number(b.priority);
      if (p !== 0) return p;
      return a.supplier_id - b.supplier_id;
    });
  } else {
    arr.sort((a, b) => {
      const p = Number(a.priority) - Number(b.priority);
      if (p !== 0) return p;
      const c = effectiveSupplierCost(a) - effectiveSupplierCost(b);
      if (c !== 0) return c;
      return a.supplier_id - b.supplier_id;
    });
  }
  return arr.map((r) => r.supplier_id);
}
