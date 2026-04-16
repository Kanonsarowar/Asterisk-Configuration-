import { query } from '../../../../packages/database/index.js';

const THRESHOLD = parseFloat(process.env.LOW_BALANCE_THRESHOLD || '5.00');

export async function processLowBalanceAlerts() {
  const { rows } = await query(
    `SELECT c.id, c.company_name, c.balance, c.billing_type, u.email
     FROM clients c JOIN users u ON u.id = c.user_id
     WHERE c.billing_type = 'prepaid' AND c.status = 'active' AND c.balance < ? AND c.balance > 0`,
    [THRESHOLD]
  );

  let warned = 0;
  for (const client of rows) {
    const existing = await query(
      `SELECT id FROM fraud_logs WHERE event_type = 'balance_depleted' AND client_id = ? AND resolved = 0
       AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) LIMIT 1`,
      [client.id]
    );
    if (!existing.rows.length) {
      await query(
        `INSERT INTO fraud_logs (event_type, severity, client_id, details)
         VALUES ('balance_depleted', 'info', ?, ?)`,
        [client.id, JSON.stringify({ balance: client.balance, threshold: THRESHOLD, company: client.company_name })]
      );
      warned++;
    }
  }

  const { rows: depleted } = await query(
    `SELECT c.id FROM clients c WHERE c.billing_type = 'prepaid' AND c.status = 'active' AND c.balance <= 0`
  );
  for (const client of depleted) {
    const existing = await query(
      `SELECT id FROM fraud_logs WHERE event_type = 'balance_depleted' AND client_id = ? AND severity = 'high'
       AND resolved = 0 AND created_at > DATE_SUB(NOW(), INTERVAL 6 HOUR) LIMIT 1`,
      [client.id]
    );
    if (!existing.rows.length) {
      await query(
        `INSERT INTO fraud_logs (event_type, severity, client_id, details)
         VALUES ('balance_depleted', 'high', ?, ?)`,
        [client.id, JSON.stringify({ balance: 0, action: 'calls_may_be_rejected' })]
      );
      warned++;
    }
  }

  return { warned };
}
