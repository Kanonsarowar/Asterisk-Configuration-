import { query } from '../db.js';
import { digitsOnly } from './rbac.js';
import { getBillingSettings, getFraudSettings } from './settings.js';

/** In-process CPS + CLI counters (reset hourly buckets) */
const cpsBuckets = new Map();
const cliHourly = new Map();

function currentSecond() {
  return Math.floor(Date.now() / 1000);
}

function currentHour() {
  return Math.floor(Date.now() / 3600000);
}

function pruneCps() {
  const sec = currentSecond();
  for (const [k, t] of cpsBuckets) {
    if (t < sec - 2) cpsBuckets.delete(k);
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

export async function checkFraudAndCps(cli) {
  const fraud = await getFraudSettings();
  const billing = await getBillingSettings();
  const cps = recordCpsEvent();
  if (cps > (billing.max_cps_global || 50)) {
    return { allow: false, reason: 'cps_limit' };
  }
  if (!fraud.enabled) return { allow: true };
  const d = digitsOnly(cli);
  if (d) {
    const n = recordCliCall(d);
    if (n > (fraud.max_calls_per_cli_per_hour || 120)) {
      return { allow: false, reason: 'cli_hourly_limit' };
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

function matchesCliRegex(pattern, cli) {
  if (!pattern) return true;
  try {
    const re = new RegExp(pattern);
    return re.test(String(cli || ''));
  } catch {
    return true;
  }
}

/**
 * Ordered supplier list for destination: failover + LCR + premium flag.
 */
export async function resolveRouteSuppliers(dest, cli, numberRow) {
  const d = digitsOnly(dest);
  const settings = await getBillingSettings();
  const mode = settings.routing_mode || 'priority';
  const premium = numberRow?.type === 'premium';

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
          ...s.rows[0],
        },
      ];
    }
  }

  if (mode === 'lcr') {
    list = [...list].sort((a, b) => Number(a.rate) - Number(b.rate) || a.priority - b.priority);
  } else {
    list = [...list].sort((a, b) => a.priority - b.priority || Number(a.rate) - Number(b.rate));
  }

  void premium;

  return list;
}

export function longestPrefix(did, len) {
  const d = digitsOnly(did);
  const n = Math.min(len || 5, d.length);
  return d.slice(0, n);
}
