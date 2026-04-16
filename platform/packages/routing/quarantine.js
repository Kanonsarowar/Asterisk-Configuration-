import { query } from '../database/index.js';
import { getRoutingSettings } from './scoring.js';

/**
 * Quarantine routes whose ASR dropped below threshold over the configured window.
 * Only quarantines routes that have sufficient sample size.
 */
export async function quarantineUnhealthyRoutes() {
  const settings = await getRoutingSettings();
  const asrThreshold = settings.quarantine_asr_threshold ?? 20;
  const windowMin = settings.quarantine_window_minutes ?? 15;
  const minSamples = settings.quarantine_min_samples ?? 10;

  const { rows: failing } = await query(`
    SELECT
      r.id AS route_id,
      r.prefix,
      r.supplier_id,
      p.name AS provider_name,
      COUNT(c.id) AS attempts,
      SUM(CASE WHEN c.disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
      ROUND(SUM(CASE WHEN c.disposition = 'ANSWERED' THEN 1 ELSE 0 END)
            / GREATEST(COUNT(c.id), 1) * 100, 2) AS asr
    FROM routes r
    JOIN providers p ON p.id = r.supplier_id
    JOIN cdr c ON c.matched_prefix = r.prefix
             AND c.supplier_id = r.supplier_id
             AND c.created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    WHERE r.status = 'active' AND p.status IN ('active', 'testing')
    GROUP BY r.id, r.prefix, r.supplier_id, p.name
    HAVING attempts >= ? AND asr < ?
  `, [windowMin, minSamples, asrThreshold]);

  let quarantined = 0;
  for (const row of failing) {
    await query(
      `UPDATE routes SET status = 'quarantined', active = 0, quarantined_at = NOW(3),
       quarantine_reason = ? WHERE id = ? AND status = 'active'`,
      [`ASR ${row.asr}% < ${asrThreshold}% (${row.attempts} attempts in ${windowMin}min)`, row.route_id]
    );

    await query(
      `INSERT INTO audit_logs (action, entity_type, entity_id, new_values)
       VALUES ('route.quarantined', 'route', ?, ?)`,
      [row.route_id, JSON.stringify({
        prefix: row.prefix,
        provider: row.provider_name,
        asr: row.asr,
        attempts: row.attempts,
        threshold: asrThreshold,
        window_minutes: windowMin,
      })]
    );
    quarantined++;
  }

  return { quarantined };
}

/**
 * Restore quarantined routes whose ASR has recovered above threshold.
 * Only restores routes that have been quarantined for at least retest_minutes.
 */
export async function restoreRecoveredRoutes() {
  const settings = await getRoutingSettings();
  const asrThreshold = settings.quarantine_asr_threshold ?? 20;
  const retestMin = settings.quarantine_retest_minutes ?? 10;

  const { rows: candidates } = await query(`
    SELECT r.id AS route_id, r.prefix, r.supplier_id, p.name AS provider_name,
      r.quarantined_at, r.quarantine_reason
    FROM routes r
    JOIN providers p ON p.id = r.supplier_id
    WHERE r.status = 'quarantined'
      AND r.quarantined_at <= DATE_SUB(NOW(), INTERVAL ? MINUTE)
      AND p.status IN ('active', 'testing')
  `, [retestMin]);

  let restored = 0;
  for (const cand of candidates) {
    const { rows: recent } = await query(`
      SELECT
        COUNT(*) AS attempts,
        SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
        ROUND(SUM(CASE WHEN disposition = 'ANSWERED' THEN 1 ELSE 0 END)
              / GREATEST(COUNT(*), 1) * 100, 2) AS asr
      FROM cdr
      WHERE matched_prefix = ? AND supplier_id = ?
        AND created_at > ?
    `, [cand.prefix, cand.supplier_id, cand.quarantined_at]);

    const stats = recent[0] || {};
    const currentAsr = Number(stats.asr || 0);
    const hasTraffic = (stats.attempts || 0) >= 3;

    if (hasTraffic && currentAsr >= asrThreshold) {
      await query(
        `UPDATE routes SET status = 'active', active = 1, quarantined_at = NULL,
         quarantine_reason = NULL WHERE id = ?`,
        [cand.route_id]
      );
      await query(
        `INSERT INTO audit_logs (action, entity_type, entity_id, old_values, new_values)
         VALUES ('route.restored', 'route', ?, ?, ?)`,
        [cand.route_id,
         JSON.stringify({ quarantine_reason: cand.quarantine_reason }),
         JSON.stringify({ prefix: cand.prefix, provider: cand.provider_name, asr: currentAsr })]
      );
      restored++;
    }
  }

  return { restored };
}
