import { query } from '../../../../packages/database/index.js';

const STALE_MINUTES = parseInt(process.env.STALE_CALL_MINUTES || '180');

export async function cleanStaleCalls() {
  const { affectedRows } = await query(
    'DELETE FROM live_calls WHERE started_at < DATE_SUB(NOW(), INTERVAL ? MINUTE)',
    [STALE_MINUTES]
  );
  return affectedRows || 0;
}
