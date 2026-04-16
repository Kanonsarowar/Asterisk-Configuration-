import { query } from '../../../../packages/database/index.js';

export async function runFraudDetection() {
  let alerts = 0;

  const { rows: shortCallClients } = await query(`
    SELECT client_id, COUNT(*) AS total,
      SUM(CASE WHEN duration < 6 THEN 1 ELSE 0 END) AS short_calls,
      ROUND(SUM(CASE WHEN duration < 6 THEN 1 ELSE 0 END) / GREATEST(COUNT(*), 1) * 100, 2) AS short_pct
    FROM cdr
    WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) AND client_id IS NOT NULL
    GROUP BY client_id HAVING total >= 20 AND short_pct > 85
  `);

  for (const row of shortCallClients) {
    const existing = await query(
      `SELECT id FROM fraud_logs WHERE event_type = 'short_call_ratio' AND client_id = ? AND resolved = 0
       AND created_at > DATE_SUB(NOW(), INTERVAL 2 HOUR) LIMIT 1`,
      [row.client_id]
    );
    if (!existing.rows.length) {
      await query(
        `INSERT INTO fraud_logs (event_type, severity, client_id, details)
         VALUES ('short_call_ratio', 'high', ?, ?)`,
        [row.client_id, JSON.stringify({ total: row.total, short_calls: row.short_calls, short_pct: row.short_pct })]
      );
      alerts++;
    }
  }

  const { rows: highSimultaneous } = await query(`
    SELECT client_id, COUNT(*) AS concurrent FROM live_calls
    WHERE client_id IS NOT NULL GROUP BY client_id HAVING concurrent > 100
  `);

  for (const row of highSimultaneous) {
    const existing = await query(
      `SELECT id FROM fraud_logs WHERE event_type = 'simultaneous_limit' AND client_id = ? AND resolved = 0
       AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) LIMIT 1`,
      [row.client_id]
    );
    if (!existing.rows.length) {
      await query(
        `INSERT INTO fraud_logs (event_type, severity, client_id, details)
         VALUES ('simultaneous_limit', 'critical', ?, ?)`,
        [row.client_id, JSON.stringify({ concurrent: row.concurrent })]
      );
      alerts++;
    }
  }

  return { alerts };
}
