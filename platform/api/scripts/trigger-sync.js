/**
 * Trigger config sync via API (admin JWT or INTERNAL for automation).
 * Usage: INTERNAL_API_KEY=... node scripts/trigger-sync.js
 */
import 'dotenv/config';

const base = process.env.API_BASE || 'http://127.0.0.1:3010';
const key = process.env.INTERNAL_SYNC_KEY || process.env.INTERNAL_API_KEY;
if (!key) {
  console.error('Set INTERNAL_API_KEY');
  process.exit(1);
}

const res = await fetch(`${base}/api/config/sync`, {
  method: 'POST',
  headers: { 'X-Internal-Key': key },
});
console.log(await res.text());
