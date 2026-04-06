import { query } from '../db.js';

let pending = null;

/**
 * Queue Asterisk config regeneration (processed by outbox poller).
 * Requires `config_sync_outbox` (sql/008). Only runs when AUTO_SYNC_ASTERISK=1.
 */
export function scheduleAsteriskSync(reason = 'unknown') {
  if (process.env.AUTO_SYNC_ASTERISK !== '1') return;
  if (pending) return;
  pending = setTimeout(async () => {
    pending = null;
    try {
      const r = String(reason || 'unknown').slice(0, 32);
      await query(`INSERT INTO config_sync_outbox (reason) VALUES (?)`, [r]);
    } catch (e) {
      if (e.code === 'ER_NO_SUCH_TABLE') {
        console.warn('[autoSync] config_sync_outbox missing; apply sql/008_config_sync_outbox.sql');
      } else {
        console.error('[autoSync]', e.message);
      }
    }
  }, parseInt(process.env.CONFIG_SYNC_DEBOUNCE_MS || '1500', 10) || 1500);
}
