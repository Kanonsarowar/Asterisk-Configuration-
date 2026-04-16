import { query, transaction } from '../database/index.js';

export function computeBilledSeconds(durationSec, minBill = 30, increment = 6) {
  if (durationSec <= 0) return 0;
  if (durationSec < minBill) return minBill;
  const over = durationSec - minBill;
  const increments = Math.ceil(over / increment);
  return minBill + increments * increment;
}

export function costFromRate(billedSec, ratePerMin, connectionFee = 0) {
  return Number(((billedSec / 60) * ratePerMin + connectionFee).toFixed(6));
}

export async function getBillingSettings() {
  const { rows } = await query("SELECT svalue FROM system_settings WHERE skey = 'billing'");
  if (!rows.length) return { min_bill_seconds: 30, increment_seconds: 6 };
  return typeof rows[0].svalue === 'string' ? JSON.parse(rows[0].svalue) : rows[0].svalue;
}

export async function finalizeCdr(cdrRow) {
  const settings = await getBillingSettings();
  const billedSec = computeBilledSeconds(
    cdrRow.duration || 0,
    settings.min_bill_seconds || 30,
    settings.increment_seconds || 6,
  );

  const revenue = cdrRow.disposition === 'ANSWERED'
    ? costFromRate(billedSec, cdrRow.rate_per_min || 0, cdrRow.connection_fee || 0)
    : 0;

  let cost = 0;
  if (cdrRow.provider_id && cdrRow.disposition === 'ANSWERED') {
    const { rows } = await query('SELECT cost_per_minute, connection_fee FROM providers WHERE id = ?', [cdrRow.provider_id]);
    if (rows[0]) {
      cost = costFromRate(billedSec, Number(rows[0].cost_per_minute), Number(rows[0].connection_fee));
    }
  }

  const profit = Number((revenue - cost).toFixed(6));

  await query(
    `UPDATE cdr SET billed_duration = ?, revenue = ?, cost = ?, profit = ?, billed = 1
     WHERE id = ?`,
    [billedSec, revenue, cost, profit, cdrRow.id]
  );

  if (cdrRow.client_id && revenue > 0) {
    await deductBalance(cdrRow.client_id, revenue);
  }

  return { billedSec, revenue, cost, profit };
}

export async function deductBalance(clientId, amount) {
  await query('UPDATE clients SET balance = balance - ? WHERE id = ?', [amount, clientId]);
}

export async function addBalance(clientId, amount) {
  await query('UPDATE clients SET balance = balance + ? WHERE id = ?', [amount, clientId]);
}

export async function getBalance(clientId) {
  const { rows } = await query('SELECT balance FROM clients WHERE id = ?', [clientId]);
  return rows[0] ? Number(rows[0].balance) : null;
}

export async function checkBalanceSufficient(clientId) {
  const settings = await getBillingSettings();
  const balance = await getBalance(clientId);
  if (balance === null) return false;
  if (!settings.negative_balance_allowed && balance <= 0) return false;
  return true;
}

export async function generateInvoice(clientId, periodStart, periodEnd) {
  return transaction(async (conn) => {
    const [cdrRows] = await conn.execute(
      `SELECT SUM(revenue) AS total_usage, COUNT(*) AS call_count,
              SUM(billed_duration) AS total_seconds
       FROM cdr WHERE client_id = ? AND created_at BETWEEN ? AND ?
       AND disposition = 'ANSWERED' AND billed = 1`,
      [clientId, periodStart, periodEnd]
    );
    const usage = Number(cdrRows[0]?.total_usage || 0);

    const [didRows] = await conn.execute(
      `SELECT COUNT(*) AS did_count, SUM(monthly_price) AS did_cost
       FROM did_inventory WHERE client_id = ? AND status = 'assigned'`,
      [clientId]
    );
    const didCost = Number(didRows[0]?.did_cost || 0);

    const total = Number((usage + didCost).toFixed(6));
    const invoiceNum = `INV-${clientId}-${Date.now().toString(36).toUpperCase()}`;

    const [result] = await conn.execute(
      `INSERT INTO invoices (client_id, invoice_number, total_amount, status, period_start, period_end, due_date)
       VALUES (?, ?, ?, 'issued', ?, ?, DATE_ADD(?, INTERVAL 30 DAY))`,
      [clientId, invoiceNum, total, periodStart, periodEnd, periodEnd]
    );
    const invoiceId = result.insertId;

    if (usage > 0) {
      await conn.execute(
        `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, amount, line_type)
         VALUES (?, ?, ?, ?, ?, 'usage')`,
        [invoiceId, `Voice usage ${periodStart} to ${periodEnd}`,
         cdrRows[0]?.total_seconds || 0, 0, usage]
      );
    }
    if (didCost > 0) {
      await conn.execute(
        `INSERT INTO invoice_lines (invoice_id, description, quantity, unit_price, amount, line_type)
         VALUES (?, ?, ?, ?, ?, 'did_rental')`,
        [invoiceId, `DID rental (${didRows[0]?.did_count || 0} numbers)`,
         didRows[0]?.did_count || 0, 0, didCost]
      );
    }

    return { invoiceId, invoiceNumber: invoiceNum, total };
  });
}
