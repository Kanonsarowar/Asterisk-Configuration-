import { query } from '../../../../packages/database/index.js';
import { finalizeCdr } from '../../../../packages/billing/index.js';

export async function processPendingCdr() {
  const { rows } = await query(
    `SELECT * FROM cdr WHERE billed = 0 AND disposition = 'ANSWERED' AND duration > 0
     ORDER BY created_at ASC LIMIT 500`
  );
  let processed = 0;
  for (const row of rows) {
    try {
      await finalizeCdr(row);
      processed++;
    } catch (err) {
      console.error(`CDR finalize failed id=${row.id}:`, err.message);
    }
  }
  return { processed };
}
