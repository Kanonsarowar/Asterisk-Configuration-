#!/usr/bin/env node
/**
 * Periodic CDR billing finalize for ODBC-only rows (PM2 "billing worker").
 * Env: FINALIZE_CDR_LOOP_MS default 60000 (1 min).
 */
import 'dotenv/config';
import { query } from '../src/db.js';
import { finalizeCdrFinancials } from '../src/lib/billing.js';

const ms = parseInt(process.env.FINALIZE_CDR_LOOP_MS || '60000', 10) || 60000;
const batch = parseInt(process.env.CDR_FINALIZE_BATCH || '200', 10) || 200;

async function tick() {
  try {
    const r = await query(
      `SELECT id FROM cdr WHERE financials_applied_at IS NULL ORDER BY id ASC LIMIT ?`,
      [batch]
    );
    let n = 0;
    for (const row of r.rows) {
      try {
        await finalizeCdrFinancials(row.id);
        n++;
      } catch (e) {
        console.error('finalize id', row.id, e.message);
      }
    }
    if (n > 0) console.log(new Date().toISOString(), 'finalize-cdr', n, 'rows');
  } catch (e) {
    console.error(new Date().toISOString(), e.message);
  }
}

setInterval(tick, ms);
tick();
