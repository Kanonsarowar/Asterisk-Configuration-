/**
 * CDR → `call_logs` sync (spec path). Implemented in the dashboard:
 * - `dashboard/lib/cdr-sync.js` — incremental Master.csv reader + INSERT IGNORE
 * - `dashboard/jobs/cdrSync.js` — CLI: `node dashboard/jobs/cdrSync.js`
 */
export { syncCdrToCallLogs } from '../../dashboard/lib/cdr-sync.js';
