#!/usr/bin/env node
/**
 * Failover behavior (API level) — confirms route lookup returns an ordered supplier chain.
 * Real SIP failover is validated in Asterisk dialplan (Dial + GotoIf); this script checks
 * the same order the PBX should try when using GET /route for AGI-driven routing.
 *
 * Usage:
 *   INTERNAL_API_KEY=... node failover-test.js <destination> [cli]
 *
 * Env:
 *   MIN_CHAIN   if set, exit 1 when failoverSuppliers.length < MIN_CHAIN
 */
import { fetchJson } from './lib/http.js';

const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_API_KEY;
const dest = process.argv[2];
const cli = process.argv[3] || process.env.CLI || '';

if (!key || !dest) {
  console.error('Usage: INTERNAL_API_KEY=... node failover-test.js <destination> [cli]');
  process.exit(1);
}

const did = dest.replace(/\D/g, '');
const headers = { 'X-Internal-Key': key };
if (cli) headers['X-Cli'] = cli;

const { ok, status, data } = await fetchJson(`${base}/route/${did}`, { headers });
if (!ok) {
  console.error('Route lookup failed', status, data);
  process.exit(1);
}

const chain = data.failoverSuppliers || [];
const order = data.routing?.failover_order || [];
const ids = chain.map((s) => s.supplier_id);

console.log(JSON.stringify({
  did: data.did,
  routing_mode: data.routing?.routing_mode,
  lcr_active: data.routing?.lcr_active,
  premium: data.premium,
  primary_supplier_id: data.primarySupplier?.id,
  failover_count: chain.length,
  failover_supplier_ids: ids,
  failover_order_from_meta: order,
  order_matches: order.length === ids.length && order.every((id, i) => id === ids[i]),
  dialplan_hint: 'Try PJSIP/${EXTEN}@supplier_' + ids.join(' then supplier_'),
}, null, 2));

const min = parseInt(process.env.MIN_CHAIN || '0', 10);
if (min > 0 && chain.length < min) {
  console.error(`FAIL: expected at least ${min} failover hops, got ${chain.length}`);
  process.exit(1);
}
