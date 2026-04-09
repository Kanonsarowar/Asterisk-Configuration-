/**
 * MySQL persistence for dashboard DIDs (numbers table).
 * Dedup key: `number` = digits-only full DID (countryCode + prefix + extension).
 */
import { getMysqlPool } from './mysql.js';

export function fullNumberDigits(n) {
  const cc = String(n.countryCode ?? '').replace(/\D/g, '');
  const p = String(n.prefix ?? '').replace(/\D/g, '');
  const e = String(n.extension ?? '').replace(/\D/g, '');
  return `${cc}${p}${e}`;
}

export function rowToApp(r) {
  if (!r) return null;
  const pt = String(r.payment_term || 'weekly').toLowerCase();
  const paymentTerm = ['monthly', 'daily'].includes(pt) ? pt : 'weekly';
  const invLast = r.inv_last_used != null
    ? (r.inv_last_used instanceof Date ? r.inv_last_used.toISOString() : String(r.inv_last_used))
    : null;
  return {
    id: String(r.id),
    country: r.country ?? 'XX',
    countryCode: r.country_code ?? '',
    prefix: r.prefix ?? '',
    extension: r.extension ?? '',
    rate: String(r.rate ?? '0.01'),
    rateCurrency: String(r.rate_currency || 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd',
    paymentTerm,
    supplierId: r.supplier_id != null ? String(r.supplier_id) : '',
    destinationType: r.destination_type || 'ivr',
    destinationId: String(r.destination_id ?? '1'),
    status: r.status ?? 'active',
    clientName: r.client_name ?? null,
    allocationDate: r.allocation_date != null
      ? (r.allocation_date instanceof Date ? r.allocation_date.toISOString() : String(r.allocation_date))
      : null,
    routingPjsipEndpoint: r.routing_pjsip_endpoint != null ? String(r.routing_pjsip_endpoint) : '',
    backupPjsipEndpoint: r.backup_pjsip_endpoint != null ? String(r.backup_pjsip_endpoint) : '',
    iprnRouteStatus: String(r.iprn_route_status || 'active').toLowerCase() === 'blocked' ? 'blocked' : 'active',
    costPerMin: r.cost_per_min != null ? String(r.cost_per_min) : '0',
    iprnPriority: r.iprn_priority != null ? parseInt(String(r.iprn_priority), 10) || 0 : 0,
    lastUsedInventory: invLast,
  };
}

function toRowPayload(n) {
  const full = fullNumberDigits(n);
  const iprnRs = String(n.iprnRouteStatus || n.iprn_route_status || 'active').toLowerCase() === 'blocked' ? 'blocked' : 'active';
  return {
    number: full,
    status: n.status != null ? String(n.status) : 'active',
    client_name: n.clientName != null ? n.clientName : n.client_name != null ? n.client_name : null,
    allocation_date: n.allocationDate ?? n.allocation_date ?? null,
    country: n.country ?? 'XX',
    country_code: n.countryCode ?? n.country_code ?? '',
    prefix: n.prefix ?? '',
    extension: n.extension ?? '',
    rate: String(n.rate ?? '0.01'),
    rate_currency: String(n.rateCurrency || n.rate_currency || 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd',
    payment_term: String(n.paymentTerm || n.payment_term || 'weekly').toLowerCase(),
    supplier_id: n.supplierId != null ? String(n.supplierId) : n.supplier_id != null ? String(n.supplier_id) : '',
    destination_type: n.destinationType || n.destination_type || 'ivr',
    destination_id: String(n.destinationId ?? n.destination_id ?? '1'),
    routing_pjsip_endpoint: String(n.routingPjsipEndpoint ?? n.routing_pjsip_endpoint ?? '').slice(0, 128),
    backup_pjsip_endpoint: String(n.backupPjsipEndpoint ?? n.backup_pjsip_endpoint ?? '').slice(0, 128),
    iprn_route_status: iprnRs,
    cost_per_min: parseFloat(String(n.costPerMin ?? n.cost_per_min ?? '0').replace(',', '.')) || 0,
    iprn_priority: parseInt(String(n.iprnPriority ?? n.iprn_priority ?? 0), 10) || 0,
  };
}

const UPSERT_SQL = `
INSERT INTO \`numbers\` (
  \`number\`, \`status\`, \`client_name\`, \`allocation_date\`,
  \`country\`, \`country_code\`, \`prefix\`, \`extension\`,
  \`rate\`, \`rate_currency\`, \`payment_term\`,
  \`supplier_id\`, \`destination_type\`, \`destination_id\`,
  \`routing_pjsip_endpoint\`, \`backup_pjsip_endpoint\`, \`iprn_route_status\`,
  \`cost_per_min\`, \`iprn_priority\`
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
ON DUPLICATE KEY UPDATE
  \`status\` = VALUES(\`status\`),
  \`client_name\` = VALUES(\`client_name\`),
  \`allocation_date\` = VALUES(\`allocation_date\`),
  \`country\` = VALUES(\`country\`),
  \`country_code\` = VALUES(\`country_code\`),
  \`prefix\` = VALUES(\`prefix\`),
  \`extension\` = VALUES(\`extension\`),
  \`rate\` = VALUES(\`rate\`),
  \`rate_currency\` = VALUES(\`rate_currency\`),
  \`payment_term\` = VALUES(\`payment_term\`),
  \`supplier_id\` = VALUES(\`supplier_id\`),
  \`destination_type\` = VALUES(\`destination_type\`),
  \`destination_id\` = VALUES(\`destination_id\`),
  \`routing_pjsip_endpoint\` = VALUES(\`routing_pjsip_endpoint\`),
  \`backup_pjsip_endpoint\` = VALUES(\`backup_pjsip_endpoint\`),
  \`iprn_route_status\` = VALUES(\`iprn_route_status\`),
  \`cost_per_min\` = VALUES(\`cost_per_min\`),
  \`iprn_priority\` = VALUES(\`iprn_priority\`)
`;

const UPSERT_INVENTORY_SQL = `
INSERT INTO \`number_inventory\` (
  \`number\`, \`route_status\`, \`supplier\`, \`backup_supplier\`,
  \`rate_per_min\`, \`cost_per_min\`, \`priority\`
) VALUES (?,?,?,?,?,?,?)
ON DUPLICATE KEY UPDATE
  \`route_status\` = VALUES(\`route_status\`),
  \`supplier\` = VALUES(\`supplier\`),
  \`backup_supplier\` = VALUES(\`backup_supplier\`),
  \`rate_per_min\` = VALUES(\`rate_per_min\`),
  \`cost_per_min\` = VALUES(\`cost_per_min\`),
  \`priority\` = VALUES(\`priority\`)
`;

async function syncNumberInventory(p, app) {
  if (!p || !app) return;
  const full = fullNumberDigits(app);
  if (!full) return;
  const route = String(app.iprnRouteStatus || 'active').toLowerCase() === 'blocked' ? 'blocked' : 'active';
  let supplier = String(app.routingPjsipEndpoint || '').trim();
  if (!supplier) {
    const sid = String(app.supplierId || '').replace(/\W/g, '');
    supplier = sid ? `supplier-${sid}` : '';
  }
  const backup = String(app.backupPjsipEndpoint || '').trim();
  const rate = parseFloat(String(app.rate || '0').replace(',', '.')) || 0;
  const costPm = parseFloat(String(app.costPerMin || '0').replace(',', '.')) || 0;
  const pri = parseInt(String(app.iprnPriority || 0), 10) || 0;
  await p.execute(UPSERT_INVENTORY_SQL, [full, route, supplier, backup, rate, costPm, pri]);
}

async function deleteNumberInventoryByNumbers(p, digitList) {
  if (!p || !digitList.length) return;
  const ph = digitList.map(() => '?').join(',');
  await p.execute(`DELETE FROM \`number_inventory\` WHERE \`number\` IN (${ph})`, digitList);
}

export async function mysqlListNumbers() {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows] = await p.query(
    `SELECT n.*, i.last_used AS inv_last_used
     FROM \`numbers\` n
     LEFT JOIN \`number_inventory\` i ON BINARY i.\`number\` = BINARY n.\`number\`
     ORDER BY n.\`country\` ASC, n.\`country_code\` ASC, n.\`prefix\` ASC, n.\`extension\` ASC, n.\`id\` ASC`
  );
  return (rows || []).map(rowToApp);
}

export async function mysqlGetById(id) {
  const p = getMysqlPool();
  if (!p) return null;
  const [rows] = await p.query(
    `SELECT n.*, i.last_used AS inv_last_used
     FROM \`numbers\` n
     LEFT JOIN \`number_inventory\` i ON BINARY i.\`number\` = BINARY n.\`number\`
     WHERE n.\`id\` = ? LIMIT 1`,
    [parseInt(id, 10)]
  );
  const r = rows && rows[0];
  return r ? rowToApp(r) : null;
}

export async function mysqlUpsertDashboardNumber(n) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL pool unavailable');
  const row = toRowPayload(n);
  if (!row.number) throw new Error('Invalid number: empty full DID');
  const vals = [
    row.number,
    row.status,
    row.client_name,
    row.allocation_date,
    row.country,
    row.country_code,
    row.prefix,
    row.extension,
    row.rate,
    row.rate_currency,
    row.payment_term,
    row.supplier_id,
    row.destination_type,
    row.destination_id,
    row.routing_pjsip_endpoint,
    row.backup_pjsip_endpoint,
    row.iprn_route_status,
    row.cost_per_min,
    row.iprn_priority,
  ];
  await p.execute(UPSERT_SQL, vals);
  const [rows] = await p.query(
    `SELECT n.*, i.last_used AS inv_last_used
     FROM \`numbers\` n
     LEFT JOIN \`number_inventory\` i ON BINARY i.\`number\` = BINARY n.\`number\`
     WHERE n.\`number\` = ? LIMIT 1`,
    [row.number]
  );
  const app = rowToApp(rows[0]);
  await syncNumberInventory(p, app);
  return app;
}

export async function mysqlDeleteById(id) {
  const p = getMysqlPool();
  if (!p) return false;
  const [before] = await p.query('SELECT `number` FROM `numbers` WHERE `id` = ? LIMIT 1', [parseInt(id, 10)]);
  const num = before && before[0] && before[0].number;
  const [r] = await p.execute('DELETE FROM `numbers` WHERE `id` = ?', [parseInt(id, 10)]);
  if (r.affectedRows > 0 && num) await deleteNumberInventoryByNumbers(p, [String(num)]);
  return r.affectedRows > 0;
}

export async function mysqlDeleteByPrefix(country, countryCode, prefix) {
  const p = getMysqlPool();
  if (!p) return 0;
  const [nums] = await p.query(
    'SELECT `number` FROM `numbers` WHERE `country` = ? AND `country_code` <=> ? AND `prefix` <=> ?',
    [country, countryCode ?? '', prefix ?? '']
  );
  const digitList = (nums || []).map((x) => String(x.number));
  const [r] = await p.execute(
    'DELETE FROM `numbers` WHERE `country` = ? AND `country_code` <=> ? AND `prefix` <=> ?',
    [country, countryCode ?? '', prefix ?? '']
  );
  const n = r.affectedRows || 0;
  if (n > 0 && digitList.length) await deleteNumberInventoryByNumbers(p, digitList);
  return n;
}

export async function mysqlBulkUpsert(nums) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL pool unavailable');
  const out = [];
  const conn = await p.getConnection();
  try {
    await conn.beginTransaction();
    for (const n of nums) {
      const row = toRowPayload(n);
      if (!row.number) continue;
      const vals = [
        row.number,
        row.status,
        row.client_name,
        row.allocation_date,
        row.country,
        row.country_code,
        row.prefix,
        row.extension,
        row.rate,
        row.rate_currency,
        row.payment_term,
        row.supplier_id,
        row.destination_type,
        row.destination_id,
        row.routing_pjsip_endpoint,
        row.backup_pjsip_endpoint,
        row.iprn_route_status,
        row.cost_per_min,
        row.iprn_priority,
      ];
      await conn.execute(UPSERT_SQL, vals);
      const [rows] = await conn.query(
        `SELECT n.*, i.last_used AS inv_last_used
         FROM \`numbers\` n
         LEFT JOIN \`number_inventory\` i ON BINARY i.\`number\` = BINARY n.\`number\`
         WHERE n.\`number\` = ? LIMIT 1`,
        [row.number]
      );
      if (rows[0]) {
        const app = rowToApp(rows[0]);
        await syncNumberInventory(conn, app);
        out.push(app);
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return out;
}
