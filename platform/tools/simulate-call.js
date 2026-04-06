#!/usr/bin/env node
/**
 * CLI call simulator — POST CDR ingest for billing validation.
 * Usage: INTERNAL_API_KEY=... API_BASE=http://127.0.0.1:3010 node simulate-call.js 441234567890 30
 */
const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_API_KEY;
const dest = process.argv[2] || '441234567890';
const duration = parseInt(process.argv[3] || '45', 10);
if (!key) {
  console.error('INTERNAL_API_KEY required');
  process.exit(1);
}

const body = {
  call_id: `sim-${Date.now()}`,
  uniqueid: `${Date.now()}.${Math.floor(Math.random() * 1e6)}`,
  cli: process.env.CLI || '441112223334',
  destination: dest.replace(/\D/g, ''),
  start_time: new Date(Date.now() - duration * 1000).toISOString().slice(0, 19).replace('T', ' '),
  end_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
  duration,
  disposition: 'ANSWERED',
};

const res = await fetch(`${base}/api/cdr/ingest`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Internal-Key': key,
  },
  body: JSON.stringify(body),
});
console.log(res.status, await res.text());
