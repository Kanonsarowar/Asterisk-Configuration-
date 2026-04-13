#!/usr/bin/env node
/**
 * Optional cron: mark IPRN ranges DEGRADED when ACD < 10 in iprn_inv_stats.
 * Run: node dashboard/jobs/numberHealth.js
 * Requires MYSQL_* env (same as dashboard) or load dashboard/.env manually.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

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
  const flag = String(process.env.MYSQL_ENABLED || '').toLowerCase();
  if (!['1', 'true', 'yes'].includes(flag)) {
    console.error('MYSQL_ENABLED not set');
    process.exit(1);
  }
  const pool = mysql.createPool({
    host: (process.env.MYSQL_HOST || '127.0.0.1').trim(),
    port: parseInt(process.env.MYSQL_PORT || '3306', 10) || 3306,
    user: (process.env.MYSQL_USER || '').trim(),
    password: process.env.MYSQL_PASSWORD != null ? String(process.env.MYSQL_PASSWORD) : '',
    database: (process.env.MYSQL_DATABASE || '').trim(),
    waitForConnections: true,
    connectionLimit: 2,
  });
  try {
    const [rows] = await pool.query('SELECT * FROM iprn_inv_stats WHERE acd < 10');
    const list = rows || [];
    let n = 0;
    for (const r of list) {
      await pool.execute('UPDATE iprn_inv_numbers SET status = ? WHERE id = ?', ['DEGRADED', r.number_id]);
      n++;
    }
    console.log(`numberHealth: updated ${n} range(s) to DEGRADED (acd < 10)`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
