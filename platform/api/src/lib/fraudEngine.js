import { query } from '../db.js';
import { getFraudSettings } from './settings.js';

export async function logFraudEvent({
  eventType, severity = 'medium', sourceIp = null, cli = null,
  destination = null, carrierId = null, customerId = null, details = null,
}) {
  try {
    await query(
      `INSERT INTO fraud_logs (event_type, severity, source_ip, cli, destination, carrier_id, customer_id, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [eventType, severity, sourceIp, cli, destination, carrierId, customerId, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    console.error('fraud_log insert failed:', e.message);
  }
}

const cliCounters = new Map();
const cpsCounters = new Map();

export function recordCli(cli) {
  const now = Date.now();
  let arr = cliCounters.get(cli);
  if (!arr) { arr = []; cliCounters.set(cli, arr); }
  arr.push(now);
  const hourAgo = now - 3_600_000;
  while (arr.length && arr[0] < hourAgo) arr.shift();
  return arr.length;
}

export function recordCps(carrierId) {
  const key = String(carrierId ?? 'global');
  const now = Date.now();
  let arr = cpsCounters.get(key);
  if (!arr) { arr = []; cpsCounters.set(key, arr); }
  arr.push(now);
  const oneSecAgo = now - 1000;
  while (arr.length && arr[0] < oneSecAgo) arr.shift();
  return arr.length;
}

export async function checkFraud({ cli, destination, sourceIp, carrierId, customerId }) {
  const settings = await getFraudSettings();
  if (!settings.enabled) return { blocked: false };

  const cliCount = recordCli(cli);
  if (cliCount > (settings.max_calls_per_cli_per_hour || 120)) {
    await logFraudEvent({
      eventType: 'cli_flood', severity: 'high', cli, destination, sourceIp, carrierId, customerId,
      details: { count: cliCount, threshold: settings.max_calls_per_cli_per_hour },
    });
    return { blocked: true, reason: 'CLI flood detected' };
  }

  const cps = recordCps(carrierId);
  const maxCps = settings.max_cps_global || 50;
  if (cps > maxCps) {
    await logFraudEvent({
      eventType: 'cps_exceeded', severity: 'critical', cli, destination, sourceIp, carrierId,
      details: { cps, threshold: maxCps },
    });
    return { blocked: true, reason: 'CPS limit exceeded' };
  }

  return { blocked: false };
}

setInterval(() => {
  const hourAgo = Date.now() - 3_600_000;
  for (const [k, arr] of cliCounters) {
    while (arr.length && arr[0] < hourAgo) arr.shift();
    if (!arr.length) cliCounters.delete(k);
  }
}, 300_000).unref();
