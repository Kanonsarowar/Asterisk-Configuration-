#!/usr/bin/env node
/**
 * Prefix tester — calls internal route lookup.
 * Usage: INTERNAL_API_KEY=... node prefix-tester.js 441234567890
 */
const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_API_KEY;
const num = process.argv[2];
if (!key || !num) {
  console.error('Usage: INTERNAL_API_KEY=... node prefix-tester.js <destination>');
  process.exit(1);
}
const res = await fetch(`${base}/route/${num.replace(/\D/g, '')}`, {
  headers: { 'X-Internal-Key': key },
});
console.log(res.status, await res.text());
