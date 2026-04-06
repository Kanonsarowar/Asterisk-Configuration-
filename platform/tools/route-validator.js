#!/usr/bin/env node
/**
 * Route validator — checks GET /route for a list of DIDs (stdin or file).
 * Usage: INTERNAL_API_KEY=... node route-validator.js numbers.txt
 */
import { readFileSync } from 'fs';

const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_API_KEY;
const file = process.argv[2];
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

const raw = await readInput();
const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
let ok = 0;
let fail = 0;
for (const line of lines) {
  const did = line.replace(/\D/g, '');
  const res = await fetch(`${base}/route/${did}`, { headers: { 'X-Internal-Key': key } });
  if (res.ok) {
    ok++;
    const j = await res.json();
    console.log('OK', did, j.primarySupplier?.name || 'no-supplier');
  } else {
    fail++;
    console.log('FAIL', did, res.status);
  }
}
console.log(`Summary: ${ok} ok, ${fail} fail`);
