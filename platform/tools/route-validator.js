#!/usr/bin/env node
/**
 * Route validation — batch GET /route for DIDs; optional expectations file for routing correctness.
 *
 * Usage:
 *   INTERNAL_API_KEY=... node route-validator.js [numbers.txt]
 *   cat nums.txt | INTERNAL_API_KEY=... node route-validator.js
 *
 * Expectations file (JSON array or JSONL): one object per line or whole array
 *   [{ "did": "441234567890", "min_failover": 2, "expect_supplier_id": 1, "must_premium": false }, ...]
 *
 * Env:
 *   API_BASE, CLI, USER_ID, STRICT (1 = exit 1 on any expect failure)
 */
import { readFileSync } from 'fs';
import { fetchJson } from './lib/http.js';

const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_API_KEY;
const file = process.argv[2];
const strict = process.env.STRICT === '1';

if (!key) {
  console.error('INTERNAL_API_KEY required');
  process.exit(1);
}

async function readInput() {
  if (file) return readFileSync(file, 'utf8');
  let d = '';
  for await (const chunk of process.stdin) d += chunk;
  return d;
}

function parseExpectations(raw) {
  const t = raw.trim();
  if (!t) return new Map();
  try {
    const j = JSON.parse(t);
    const arr = Array.isArray(j) ? j : [j];
    const m = new Map();
    for (const row of arr) {
      const did = String(row.did || row.destination || '').replace(/\D/g, '');
      if (did) m.set(did, row);
    }
    return m;
  } catch {
    /* JSONL or invalid single JSON */
  }
  const m = new Map();
  for (const line of t.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    try {
      const row = JSON.parse(s);
      const did = String(row.did || row.destination || '').replace(/\D/g, '');
      if (did) m.set(did, row);
    } catch {
      /* plain DID line — no expectations */
    }
  }
  return m;
}

const raw = await readInput();
const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

let expectMap = new Map();
const firstLine = lines[0] || '';
if (firstLine.startsWith('[') || firstLine.startsWith('{')) {
  expectMap = parseExpectations(raw);
}

const headers = { 'X-Internal-Key': key };
if (process.env.CLI) headers['X-Cli'] = process.env.CLI;
if (process.env.USER_ID) headers['X-User-Id'] = process.env.USER_ID;

let ok = 0;
let fail = 0;
let expectFail = 0;

const dids =
  expectMap.size > 0
    ? [...expectMap.keys()]
    : lines.map((l) => l.replace(/\D/g, '')).filter(Boolean);

if (!dids.length) {
  console.error('No DIDs: pass a file of numbers or JSON expectations.');
  process.exit(1);
}

for (const did of dids) {
  const { ok: resOk, status, data } = await fetchJson(`${base}/route/${did}`, { headers });
  const exp = expectMap.get(did);

  if (!resOk) {
    fail++;
    console.log('FAIL', did, 'HTTP', status, typeof data === 'object' ? JSON.stringify(data) : data);
    continue;
  }

  ok++;
  const j = data;
  const primaryId = j.primarySupplier?.id;
  const chainLen = (j.failoverSuppliers || []).length;

  let line = `OK ${did} primary=${primaryId ?? 'none'} failover_n=${chainLen}`;
  if (j.routing?.routing_mode) line += ` mode=${j.routing.routing_mode}`;
  console.log(line);

  if (exp) {
    let bad = false;
    if (exp.expect_supplier_id != null && primaryId !== exp.expect_supplier_id) {
      console.error(`  EXPECT FAIL: primary ${primaryId} != ${exp.expect_supplier_id}`);
      bad = true;
    }
    if (exp.min_failover != null && chainLen < exp.min_failover) {
      console.error(`  EXPECT FAIL: failover_n ${chainLen} < min_failover ${exp.min_failover}`);
      bad = true;
    }
    if (exp.must_premium && !j.premium) {
      console.error(`  EXPECT FAIL: expected premium number`);
      bad = true;
    }
    if (bad) expectFail++;
  }
}

console.log(`\nSummary: ${ok} ok, ${fail} http_fail, ${expectFail} expectation_fail`);
const code = fail > 0 || (strict && expectFail > 0) ? 1 : 0;
process.exit(code);
