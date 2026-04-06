/**
 * One-shot: process pending config_sync_outbox rows (for cron without API poller).
 * Usage: CONFIG_SYNC_OUTBOX_POLL=0 on API, then: node scripts/process-config-outbox.js
 */
import 'dotenv/config';
import { processConfigSyncOutboxOnce } from '../src/services/configSyncService.js';

const r = await processConfigSyncOutboxOnce();
console.log(JSON.stringify(r));
