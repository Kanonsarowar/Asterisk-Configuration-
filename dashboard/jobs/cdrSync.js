#!/usr/bin/env node
/**
 * One-shot CDR → MySQL call_logs sync (cron-friendly).
 * Env: same MYSQL_* as dashboard; optional CDR file path not supported (uses lib/cdr.js CDR_FILE).
 *
 *   node dashboard/jobs/cdrSync.js
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { initMysql } from '../lib/mysql.js';
import { syncCdrToCallLogs } from '../lib/cdr-sync.js';
import { mysqlListNumbers } from '../lib/numbers-mysql.js';

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

async function main() {
  const m = await initMysql();
  if (!m.enabled || m.schemaOk === false) {
    console.error(JSON.stringify({ ok: false, mysql: m }, null, 2));
    process.exit(1);
  }
  const nums = await mysqlListNumbers();
  const r = await syncCdrToCallLogs(nums);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
