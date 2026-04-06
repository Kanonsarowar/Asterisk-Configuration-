/**
 * Apply billing to CDR rows written directly by ODBC (financials_applied_at IS NULL).
 * Usage: node scripts/finalize-pending-cdr.js
 */
import 'dotenv/config';
import { query } from '../src/db.js';
import { finalizeCdrFinancials } from '../src/lib/billing.js';

const limit = parseInt(process.env.CDR_FINALIZE_BATCH || '500', 10) || 500;
const r = await query(
  `SELECT id FROM cdr WHERE financials_applied_at IS NULL ORDER BY id ASC LIMIT ?`,
  [limit]
);
let ok = 0;
for (const row of r.rows) {
  try {
    await finalizeCdrFinancials(row.id);
    ok++;
  } catch (e) {
    console.error('id', row.id, e.message);
  }
}
console.log(JSON.stringify({ processed: r.rows.length, finalized: ok }));
