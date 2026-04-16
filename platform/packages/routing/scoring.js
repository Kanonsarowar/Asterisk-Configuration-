import { query, transaction } from '../database/index.js';

/**
 * Load routing_engine settings from system_settings.
 * Cached in-process for 60s to avoid repeated DB reads on hot path.
 */
let _settingsCache = null;
let _settingsCacheTs = 0;
const CACHE_TTL_MS = 60_000;

export async function getRoutingSettings() {
  const now = Date.now();
  if (_settingsCache && now - _settingsCacheTs < CACHE_TTL_MS) return _settingsCache;
  const { rows } = await query("SELECT svalue FROM system_settings WHERE skey = 'routing_engine'");
  _settingsCache = rows[0] ? (typeof rows[0].svalue === 'string' ? JSON.parse(rows[0].svalue) : rows[0].svalue) : {};
  _settingsCacheTs = now;
  return _settingsCache;
}

/**
 * Compute the composite score for a single route given its raw metrics.
 *
 *   score = (ASR_norm * W_asr) + (ACD_norm * W_acd) + (PDD_inv_norm * W_pdd)
 *         + (MARGIN_norm * W_margin) + (STABILITY_norm * W_stability)
 *
 * All components are normalised to 0–100 before weighting.
 */
export function computeScore(metrics, weights, normLimits) {
  const w = weights || { asr: 0.35, acd: 0.15, pdd: 0.10, margin: 0.30, stability: 0.10 };
  const maxAcd = normLimits?.max_acd_normalise || 300;
  const maxMargin = normLimits?.max_margin_normalise || 0.10;

  const asrNorm = Math.min(metrics.asr, 100);
  const acdNorm = Math.min((metrics.acd / maxAcd) * 100, 100);
  const pddNorm = metrics.pdd > 0 ? Math.min((1 / metrics.pdd) * 100, 100) : 100;
  const marginNorm = maxMargin > 0 ? Math.min((metrics.margin / maxMargin) * 100, 100) : 0;
  const stabilityNorm = Math.min(metrics.stability, 100);

  const qualityScore = Number(((asrNorm * w.asr) + (acdNorm * w.acd) + (pddNorm * w.pdd)).toFixed(4));
  const profitScore = Number((marginNorm * w.margin).toFixed(4));
  const stabilityScore = Number((stabilityNorm * w.stability).toFixed(4));
  const finalScore = Number((qualityScore + profitScore + stabilityScore).toFixed(4));

  return { qualityScore, profitScore, finalScore };
}

/**
 * Recompute scores for all active routes.
 *
 * Single query gathers per-route CDR aggregates for the scoring window,
 * then batch-upserts into route_scores.  No N+1.
 */
export async function recomputeAllScores() {
  const settings = await getRoutingSettings();
  const w = settings.weights || {};
  const windowMin = settings.score_recompute_minutes || 60;

  const { rows: routeMetrics } = await query(`
    SELECT
      r.id                                             AS route_id,
      r.supplier_id,
      r.prefix,
      r.rate                                           AS sell_rate,
      p.cost_per_minute                                AS buy_rate,
      COUNT(c.id)                                      AS attempts,
      SUM(CASE WHEN c.disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
      ROUND(SUM(CASE WHEN c.disposition = 'ANSWERED' THEN 1 ELSE 0 END)
            / GREATEST(COUNT(c.id), 1) * 100, 4)       AS asr,
      ROUND(AVG(CASE WHEN c.disposition = 'ANSWERED' THEN c.duration ELSE NULL END), 2)
                                                        AS acd,
      ROUND(AVG(c.pdd_ms) / 1000.0, 2)                 AS pdd_sec,
      COUNT(DISTINCT DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i')) AS active_minutes
    FROM routes r
    JOIN providers p ON p.id = r.supplier_id
    LEFT JOIN cdr c ON c.matched_prefix = r.prefix
                   AND c.supplier_id = r.supplier_id
                   AND c.created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
    WHERE r.status IN ('active', 'quarantined')
      AND p.status IN ('active', 'testing')
    GROUP BY r.id, r.supplier_id, r.prefix, r.rate, p.cost_per_minute
  `, [windowMin]);

  let updated = 0;

  for (const rm of routeMetrics) {
    const asr = Number(rm.asr || 0);
    const acd = Number(rm.acd || 0);
    const pdd = Number(rm.pdd_sec || 0);
    const margin = Number(rm.sell_rate) - Number(rm.buy_rate);
    const stability = rm.attempts > 0
      ? Math.min((rm.active_minutes / Math.max(windowMin, 1)) * 100, 100)
      : 50;

    const { qualityScore, profitScore, finalScore } = computeScore(
      { asr, acd, pdd, margin, stability },
      w,
      settings,
    );

    await query(`
      INSERT INTO route_scores
        (route_id, supplier_id, prefix, asr, acd, pdd, margin, stability,
         quality_score, profit_score, final_score, sample_size, computed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
      ON DUPLICATE KEY UPDATE
        asr = VALUES(asr), acd = VALUES(acd), pdd = VALUES(pdd),
        margin = VALUES(margin), stability = VALUES(stability),
        quality_score = VALUES(quality_score), profit_score = VALUES(profit_score),
        final_score = VALUES(final_score), sample_size = VALUES(sample_size),
        computed_at = NOW(3)
    `, [
      rm.route_id, rm.supplier_id, rm.prefix,
      asr, acd, pdd, margin, stability,
      qualityScore, profitScore, finalScore,
      rm.attempts || 0,
    ]);
    updated++;
  }

  return { updated };
}
