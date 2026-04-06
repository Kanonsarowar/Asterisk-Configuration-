#!/usr/bin/env node
/**
 * Prefix / route tester — GET /route/:number with optional CLI and user for fraud path.
 *
 * Usage:
 *   INTERNAL_API_KEY=... node prefix-tester.js <destination> [cli]
 *
 * Env:
 *   API_BASE    default http://127.0.0.1:3010
 *   USER_ID     X-User-Id for per-user rate limits (optional)
 *   JSON        set to 1 for raw JSON only
 *
 * Validates:
 *   - Routing: 200 + primarySupplier + failover chain order matches routing.failover_order
 *   - Failover: reports chain length and supplier ids for Dial sequence testing
 */
import { fetchJson } from './lib/http.js';

const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_API_KEY;
const num = process.argv[2];
const cliArg = process.argv[3];
if (!key || !num) {
  console.error('Usage: INTERNAL_API_KEY=... node prefix-tester.js <destination> [cli]');
  process.exit(1);
}

const did = num.replace(/\D/g, '');
const cliHeader = cliArg != null ? String(cliArg) : process.env.CLI || '';

const headers = { 'X-Internal-Key': key };
if (cliHeader) headers['X-Cli'] = cliHeader;
const uid = process.env.USER_ID;
if (uid) headers['X-User-Id'] = String(uid);

const url = new URL(`${base}/route/${did}`);
if (cliHeader) url.searchParams.set('cli', cliHeader);

const { ok, status, data } = await fetchJson(url.toString(), { headers });

if (process.env.JSON === '1') {
  console.log(JSON.stringify({ status, ok, data }, null, 2));
  process.exit(ok ? 0 : 1);
}

console.log('HTTP', status);
if (!ok) {
  console.log(typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  process.exit(1);
}

const j = data;
const chain = j.failoverSuppliers || [];
const fo = j.routing?.failover_order || chain.map((s) => s.supplier_id);
const chainIds = chain.map((s) => s.supplier_id);
const orderMatch =
  fo.length === chainIds.length && fo.every((id, i) => id === chainIds[i]);

console.log('\n--- Routing ---');
console.log('did:', j.did, 'status:', j.status, 'premium:', j.premium);
console.log('matched_prefix (number):', j.matched_prefix);
console.log('routing_mode:', j.routing?.routing_mode, 'lcr_active:', j.routing?.lcr_active);

console.log('\n--- Primary ---');
if (j.primarySupplier) {
  console.log(
    `  id=${j.primarySupplier.id} name=${j.primarySupplier.name} route_rate=${j.primarySupplier.route_rate} cost_per_min=${j.primarySupplier.cost_per_minute}`
  );
} else {
  console.log('  (none)');
}

console.log('\n--- Failover chain (try in order) ---');
chain.forEach((s, i) => {
  console.log(
    `  ${i + 1}. supplier_id=${s.supplier_id} name=${s.name} priority=${s.priority} rate=${s.rate} cost_per_min=${s.cost_per_minute}`
  );
});
console.log('failover_order matches API list:', orderMatch ? 'OK' : 'MISMATCH');

if (j.ivr) {
  console.log('\nIVR:', j.ivr.id, j.ivr.name);
}
