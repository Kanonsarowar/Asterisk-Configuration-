import 'dotenv/config';
import { processPendingCdr } from './processors/cdrProcessor.js';
import { runFraudDetection } from './processors/fraudDetector.js';
import { checkRouteHealth } from './processors/routeHealth.js';
import { processLowBalanceAlerts } from './processors/balanceAlerts.js';
import { cleanStaleCalls } from './processors/callCleanup.js';
import { processRouteScoring } from './processors/routeScoring.js';

const INTERVAL = (parseInt(process.env.WORKER_INTERVAL_SEC) || 30) * 1000;

async function tick() {
  const ts = new Date().toISOString();
  try {
    const cdr = await processPendingCdr();
    if (cdr.processed) console.log(`[${ts}] CDR: billed ${cdr.processed} records`);

    const fraud = await runFraudDetection();
    if (fraud.alerts) console.log(`[${ts}] Fraud: ${fraud.alerts} new alerts`);

    const health = await checkRouteHealth();
    if (health.degraded) console.log(`[${ts}] Routes: ${health.degraded} degraded providers`);

    const scoring = await processRouteScoring();
    if (scoring.scored) console.log(`[${ts}] Scoring: ${scoring.scored} routes scored`);
    if (scoring.quarantined) console.log(`[${ts}] Quarantine: ${scoring.quarantined} routes quarantined`);
    if (scoring.restored) console.log(`[${ts}] Restore: ${scoring.restored} routes restored`);
    if (scoring.scoreChanged) console.log(`[${ts}] ScoreShift: ${scoring.scoreChanged} significant changes`);

    const balance = await processLowBalanceAlerts();
    if (balance.warned) console.log(`[${ts}] Balance: ${balance.warned} low-balance clients`);

    const cleaned = await cleanStaleCalls();
    if (cleaned) console.log(`[${ts}] Cleanup: removed ${cleaned} stale live_calls`);
  } catch (err) {
    console.error(`[${ts}] Worker error:`, err.message);
  }
}

console.log(`IPRN Worker Engine started (interval: ${INTERVAL / 1000}s)`);
tick();
setInterval(tick, INTERVAL);
