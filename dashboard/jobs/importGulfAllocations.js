#!/usr/bin/env node
/**
 * Import Gulf Telecom allocation list into DID inventory (numbers table).
 * Source: dashboard/data/gulf-telecom-allocations.tsv (Country, Range, Rate_USD).
 *
 *   node dashboard/jobs/importGulfAllocations.js
 *   ALLOCATION_FILE=/path/to/file.tsv IVR_DEST_ID=1 node dashboard/jobs/importGulfAllocations.js
 *
 * Env: MYSQL_* (same as dashboard). Optional: IVR_DEST_ID (default 1), ALLOCATION_FILE.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initMysql, isMysqlNumbersReady } from '../lib/mysql.js';
import { mysqlBulkUpsert } from '../lib/numbers-mysql.js';
import { parseAllocationsText } from '../lib/gulf-allocations-parse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnv() {
  const p = join(root, '.env');
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith('#')) continue;
    const eq = l.indexOf('=');
    if (eq < 1) continue;
    const k = l.slice(0, eq).trim();
    let v = l.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnv();

const BATCH = 250;

async function main() {
  const filePath =
    String(process.env.ALLOCATION_FILE || '').trim() || join(root, 'data', 'gulf-telecom-allocations.tsv');
  if (!existsSync(filePath)) {
    console.error('Missing file:', filePath);
    process.exit(1);
  }
  const raw = readFileSync(filePath, 'utf8');
  const destId = String(process.env.IVR_DEST_ID || '1').trim() || '1';

  const m = await initMysql();
  if (!m.enabled || m.schemaOk === false || !isMysqlNumbersReady()) {
    console.error(JSON.stringify({ ok: false, error: 'MySQL not ready', mysql: m }));
    process.exit(1);
  }

  const rows = parseAllocationsText(raw);
  const byFull = new Map();
  for (const r of rows) {
    const key = `${r.countryCode}${r.prefix}${r.extension}`;
    if (!byFull.has(key)) byFull.set(key, r);
  }
  const unique = [...byFull.values()];
  console.log(JSON.stringify({ file: filePath, parsed: rows.length, unique: unique.length, ivr: destId }));

  const nums = unique.map((r) => ({
    country: r.countryIso,
    countryCode: r.countryCode,
    prefix: r.prefix,
    extension: r.extension,
    rate: r.rate,
    rateCurrency: 'usd',
    paymentTerm: 'weekly',
    supplierId: '',
    destinationType: 'ivr',
    destinationId: destId,
    status: 'active',
  }));

  let inserted = 0;
  for (let i = 0; i < nums.length; i += BATCH) {
    const chunk = nums.slice(i, i + BATCH);
    const out = await mysqlBulkUpsert(chunk);
    inserted += out.length;
    console.log(`batch ${i / BATCH + 1}: ${out.length} rows`);
  }

  console.log(JSON.stringify({ ok: true, totalUpserted: inserted }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
