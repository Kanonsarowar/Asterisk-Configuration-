import { recomputeAllScores, getRoutingSettings } from '../../../../packages/routing/scoring.js';
import { quarantineUnhealthyRoutes, restoreRecoveredRoutes } from '../../../../packages/routing/quarantine.js';
import { query } from '../../../../packages/database/index.js';

let lastScoreRun = 0;

/**
 * Called every worker tick. Recomputes route scores on the configured interval
 * (default 5 min) and runs quarantine/restore on every tick.
 */
export async function processRouteScoring() {
  const settings = await getRoutingSettings();
  const recomputeInterval = (settings.score_recompute_minutes || 5) * 60_000;
  const now = Date.now();

  let scored = 0;
  let quarantined = 0;
  let restored = 0;
  let scoreChanged = 0;

  if (now - lastScoreRun >= recomputeInterval) {
    const before = await getTopScores();
    const result = await recomputeAllScores();
    scored = result.updated;
    lastScoreRun = now;

    scoreChanged = await auditSignificantChanges(before);
  }

  const qResult = await quarantineUnhealthyRoutes();
  quarantined = qResult.quarantined;

  const rResult = await restoreRecoveredRoutes();
  restored = rResult.restored;

  return { scored, quarantined, restored, scoreChanged };
}

async function getTopScores() {
  const { rows } = await query(
    'SELECT route_id, final_score FROM route_scores ORDER BY route_id'
  );
  const map = new Map();
  for (const r of rows) map.set(r.route_id, Number(r.final_score));
  return map;
}

async function auditSignificantChanges(beforeMap) {
  const { rows } = await query(
    'SELECT route_id, final_score, prefix, supplier_id FROM route_scores ORDER BY route_id'
  );
  let changes = 0;
  const THRESHOLD = 5.0;

  for (const r of rows) {
    const oldScore = beforeMap.get(r.route_id);
    const newScore = Number(r.final_score);
    if (oldScore !== undefined && Math.abs(newScore - oldScore) >= THRESHOLD) {
      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values)
         VALUES ('route.score_change', 'route', ?, ?, ?)`,
        [r.route_id,
         JSON.stringify({ final_score: oldScore }),
         JSON.stringify({ final_score: newScore, prefix: r.prefix, supplier_id: r.supplier_id })]
      );
      changes++;
    }
  }
  return changes;
}
