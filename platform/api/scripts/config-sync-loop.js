#!/usr/bin/env node
/**
 * Poll config_sync_outbox and run sync (for PM2 when API poller is disabled).
 * Env: same as API (.env in cwd). CONFIG_SYNC_LOOP_MS default 3000.
 */
import 'dotenv/config';
import { processConfigSyncOutboxOnce } from '../src/services/configSyncService.js';

const ms = parseInt(process.env.CONFIG_SYNC_LOOP_MS || '3000', 10) || 3000;

async function tick() {
  try {
    const r = await processConfigSyncOutboxOnce();
    if (r.processed > 0) console.log(new Date().toISOString(), 'config sync', r);
  } catch (e) {
    console.error(new Date().toISOString(), e.message);
  }
}

setInterval(tick, ms);
tick();
