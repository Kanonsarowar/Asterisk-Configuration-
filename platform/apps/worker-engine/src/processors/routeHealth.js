import { query } from '../../../../packages/database/index.js';

export async function checkRouteHealth() {
  const { rows } = await query(`
    SELECT cdr.provider_id, p.name,
      COUNT(*) AS total,
      SUM(CASE WHEN cdr.disposition = 'ANSWERED' THEN 1 ELSE 0 END) AS answered,
      ROUND(SUM(CASE WHEN cdr.disposition = 'ANSWERED' THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1) * 100, 2) AS asr,
      ROUND(AVG(CASE WHEN cdr.disposition = 'ANSWERED' THEN cdr.duration ELSE NULL END), 1) AS acd
    FROM cdr
    JOIN providers p ON p.id = cdr.provider_id
    WHERE cdr.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) AND p.status = 'active'
    GROUP BY cdr.provider_id HAVING total >= 10
  `);

  let degraded = 0;
  for (const row of rows) {
    const { rows: routes } = await query(
      'SELECT id, min_asr, min_acd FROM routes WHERE provider_id = ? AND active = 1', [row.provider_id]
    );
    for (const route of routes) {
      const asrFail = route.min_asr > 0 && row.asr < route.min_asr;
      const acdFail = route.min_acd > 0 && row.acd < route.min_acd;
      if (asrFail || acdFail) {
        await query('UPDATE routes SET active = 0 WHERE id = ?', [route.id]);
        await query(
          `INSERT INTO audit_logs (action, entity_type, entity_id, new_values)
           VALUES ('route.auto_disabled', 'route', ?, ?)`,
          [route.id, JSON.stringify({ asr: row.asr, acd: row.acd, min_asr: route.min_asr, min_acd: route.min_acd })]
        );
        degraded++;
      }
    }

    await query('UPDATE providers SET quality_score = ? WHERE id = ?', [row.asr, row.provider_id]);
  }

  return { degraded };
}
