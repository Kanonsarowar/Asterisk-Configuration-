#!/usr/bin/env node
/**
 * CLI call simulator — exercises CDR ingest + optional billing verification.
 *
 * Usage:
 *   INTERNAL_API_KEY=... node simulate-call.js <destination> [duration_sec]
 *
 * Env:
 *   API_BASE              default http://127.0.0.1:3010
 *   CLI                   caller ID (digits)
 *   DISPOSITION           default ANSWERED
 *   SUPPLIER_ID           optional override for ingest
 *   JWT_TOKEN             if set, after ingest GET /api/cdr and verify billed_duration + revenue vs engine rules
 *   MIN_BILL_SECONDS      default 30 (must match system_settings.billing when not using API)
 *   INCREMENT_SECONDS     default 6
 *
 * Billing accuracy: compares CDR row to local expectation (same formula as billingEngine).
 */
import { computeBilledSeconds, amountFromBilledRate, near } from './lib/billingExpect.js';
import { fetchJson } from './lib/http.js';

const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_API_KEY;
const dest = (process.argv[2] || '441234567890').replace(/\D/g, '');
const duration = parseInt(process.argv[3] || '45', 10);

const minBill = parseInt(process.env.MIN_BILL_SECONDS || '30', 10) || 30;
const inc = parseInt(process.env.INCREMENT_SECONDS || '6', 10) || 6;

if (!key) {
  console.error('INTERNAL_API_KEY required');
  process.exit(1);
}

const body = {
  call_id: `sim-${Date.now()}`,
  uniqueid: `${Date.now()}.${Math.floor(Math.random() * 1e6)}`,
  cli: (process.env.CLI || '441112223334').replace(/\D/g, ''),
  destination: dest,
  start_time: new Date(Date.now() - duration * 1000).toISOString().slice(0, 19).replace('T', ' '),
  end_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
  duration,
  disposition: process.env.DISPOSITION || 'ANSWERED',
};
if (process.env.SUPPLIER_ID) {
  body.supplier_id = parseInt(process.env.SUPPLIER_ID, 10);
}

const billedExpect = computeBilledSeconds(duration, {
  minimum_bill_seconds: minBill,
  increment_seconds: inc,
});

console.log('Ingest:', JSON.stringify({ ...body, _expected_billed_sec: billedExpect }, null, 2));

const res = await fetch(`${base}/api/cdr/ingest`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Key': key,
  },
  body: JSON.stringify(body),
});
const text = await res.text();
let ingestData;
try {
  ingestData = text ? JSON.parse(text) : null;
} catch {
  ingestData = text;
}

console.log('ingest HTTP', res.status, text);

const jwt = process.env.JWT_TOKEN;
if (res.ok && jwt && ingestData?.id) {
  const prefix = dest.slice(0, Math.min(6, dest.length));
  const cr = await fetchJson(`${base}/api/cdr?limit=30&prefix=${encodeURIComponent(prefix)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!cr.ok) {
    console.error('CDR fetch failed', cr.status, cr.data);
    process.exit(2);
  }
  const row = (cr.data.cdr || []).find((c) => c.id === ingestData.id || c.call_id === body.call_id);
  if (!row) {
    console.error('Billing verify: CDR row not found (need admin JWT with cdr scope). id=', ingestData.id);
    process.exit(2);
  }
  const revExpect = amountFromBilledRate(row.billed_duration, row.user_rate_per_min ?? 0);
  const profitOk = near(Number(row.profit), Number(row.revenue) - Number(row.cost), 0.02);
  const revOk = near(row.revenue, revExpect, 0.02);

  console.log('\n--- Billing verify (DB row) ---');
  console.log(
    JSON.stringify(
      {
        id: row.id,
        billed_duration: row.billed_duration,
        expected_billed_if_rules_match: billedExpect,
        billed_match: row.billed_duration === billedExpect,
        revenue: row.revenue,
        cost: row.cost,
        profit: row.profit,
        user_rate_per_min: row.user_rate_per_min,
        supplier_rate_per_min: row.supplier_rate_per_min,
        revenue_matches_rate_formula: revOk,
        profit_matches_rev_minus_cost: profitOk,
      },
      null,
      2
    )
  );
  if (row.billed_duration !== billedExpect) {
    console.warn('Note: billed_duration differs from MIN_BILL/INCREMENT env — align with GET /api/billing/settings');
  }
}
