/**
 * Country → prefix catalog (prefix_inventory). DIDs in `numbers` can reference `prefix_inventory_id`.
 */
import { getMysqlPool } from './mysql.js';
import { fullNumberDigits, mysqlBulkUpsert } from './numbers-mysql.js';
import { normalizeNumberRecord } from './store.js';

function rowCountry(r) {
  if (!r) return null;
  return {
    id: String(r.id),
    name: r.name ?? '',
    country: r.country ?? 'XX',
    dialPrefix: String(r.dial_prefix ?? '').replace(/\D/g, ''),
    createdAt: r.created_at != null ? (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)) : null,
  };
}

function rowPrefix(r) {
  if (!r) return null;
  return {
    id: String(r.id),
    countryId: String(r.country_id),
    countryName: r.country_name ?? '',
    countryLabel: r.country_label ?? 'XX',
    countryCode: String(r.country_code ?? '').replace(/\D/g, ''),
    prefix: String(r.prefix ?? '').replace(/\D/g, ''),
    fullPrefix: `${String(r.country_code ?? '').replace(/\D/g, '')}${String(r.prefix ?? '').replace(/\D/g, '')}`,
    rate: String(r.rate ?? '0.01'),
    rateCurrency: String(r.rate_currency || 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd',
    paymentTerm: String(r.payment_term || 'weekly').toLowerCase(),
    supplierId: r.supplier_id != null ? String(r.supplier_id) : '',
    destinationId: String(r.destination_id ?? '1'),
    routesLogic: r.routes_logic != null ? String(r.routes_logic) : '',
    testNumber: r.test_number != null ? String(r.test_number).replace(/\D/g, '') : '',
    status: String(r.status || 'active'),
    notes: r.notes != null ? String(r.notes) : '',
    createdAt: r.created_at != null ? (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)) : null,
  };
}

export async function mysqlListPrefixCountries() {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows] = await p.query(
    'SELECT * FROM `prefix_countries` ORDER BY `name` ASC, `id` ASC'
  );
  return (rows || []).map(rowCountry);
}

export async function mysqlCreatePrefixCountry(body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const name = String(body?.name ?? '').trim();
  if (!name) throw new Error('name is required');
  const country = String(body?.country ?? 'XX').trim().slice(0, 8) || 'XX';
  const dialPrefix = String(body?.dialPrefix ?? body?.dial_prefix ?? '').replace(/\D/g, '');
  const [r] = await p.execute(
    'INSERT INTO `prefix_countries` (`name`, `country`, `dial_prefix`) VALUES (?, ?, ?)',
    [name, country, dialPrefix]
  );
  const id = r.insertId;
  const [rows] = await p.query('SELECT * FROM `prefix_countries` WHERE `id` = ? LIMIT 1', [id]);
  return rowCountry(rows[0]);
}

export async function mysqlUpdatePrefixCountry(id, body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const name = body?.name != null ? String(body.name).trim() : undefined;
  const country = body?.country != null ? String(body.country).trim().slice(0, 8) : undefined;
  const dialPrefix = body?.dialPrefix != null || body?.dial_prefix != null
    ? String(body.dialPrefix ?? body.dial_prefix).replace(/\D/g, '')
    : undefined;
  const sets = [];
  const vals = [];
  if (name !== undefined) { sets.push('`name` = ?'); vals.push(name); }
  if (country !== undefined) { sets.push('`country` = ?'); vals.push(country); }
  if (dialPrefix !== undefined) { sets.push('`dial_prefix` = ?'); vals.push(dialPrefix); }
  if (!sets.length) {
    const [rows] = await p.query('SELECT * FROM `prefix_countries` WHERE `id` = ? LIMIT 1', [parseInt(id, 10)]);
    return rowCountry(rows[0]);
  }
  vals.push(parseInt(id, 10));
  await p.execute(`UPDATE \`prefix_countries\` SET ${sets.join(', ')} WHERE \`id\` = ?`, vals);
  const [rows] = await p.query('SELECT * FROM `prefix_countries` WHERE `id` = ? LIMIT 1', [parseInt(id, 10)]);
  return rowCountry(rows[0]);
}

export async function mysqlDeletePrefixCountry(id) {
  const p = getMysqlPool();
  if (!p) return false;
  const [c] = await p.query('SELECT COUNT(*) AS c FROM `prefix_inventory` WHERE `country_id` = ?', [parseInt(id, 10)]);
  if (c && c[0] && Number(c[0].c) > 0) throw new Error('Delete prefixes under this country first');
  const [r] = await p.execute('DELETE FROM `prefix_countries` WHERE `id` = ?', [parseInt(id, 10)]);
  return r.affectedRows > 0;
}

export async function mysqlListPrefixInventory(countryId) {
  const p = getMysqlPool();
  if (!p) return [];
  let sql = `
    SELECT i.*, c.name AS country_name, c.country AS country_label
    FROM \`prefix_inventory\` i
    INNER JOIN \`prefix_countries\` c ON c.id = i.country_id`;
  const args = [];
  if (countryId != null && String(countryId).trim() !== '') {
    sql += ' WHERE i.country_id = ?';
    args.push(parseInt(String(countryId), 10));
  }
  sql += ' ORDER BY c.name ASC, i.country_code ASC, i.prefix ASC';
  const [rows] = await p.query(sql, args);
  return (rows || []).map(rowPrefix);
}

export async function mysqlGetPrefixInventoryRow(id) {
  const p = getMysqlPool();
  if (!p) return null;
  const [rows] = await p.query(
    `SELECT i.*, c.name AS country_name, c.country AS country_label
     FROM \`prefix_inventory\` i
     INNER JOIN \`prefix_countries\` c ON c.id = i.country_id
     WHERE i.id = ? LIMIT 1`,
    [parseInt(id, 10)]
  );
  return rows && rows[0] ? rowPrefix(rows[0]) : null;
}

export async function mysqlCreatePrefixInventory(body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const countryId = parseInt(String(body?.countryId ?? body?.country_id ?? ''), 10);
  if (!countryId) throw new Error('countryId is required');
  const countryCode = String(body?.countryCode ?? body?.country_code ?? '').replace(/\D/g, '');
  const prefix = String(body?.prefix ?? '').replace(/\D/g, '');
  if (!prefix) throw new Error('prefix is required');
  const rate = String(body?.rate ?? '0.01');
  const rateCurrency = String(body?.rateCurrency ?? 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd';
  let paymentTerm = String(body?.paymentTerm ?? 'weekly').toLowerCase();
  if (!['weekly', 'monthly', 'daily'].includes(paymentTerm)) paymentTerm = 'weekly';
  const supplierId = body?.supplierId != null ? String(body.supplierId) : '';
  const destinationId = String(body?.destinationId ?? '1');
  const routesLogic = body?.routesLogic != null ? String(body.routesLogic) : '';
  const testNumber = String(body?.testNumber ?? body?.test_number ?? '').replace(/\D/g, '');
  const notes = body?.notes != null ? String(body.notes) : '';
  const status = String(body?.status ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';

  const [r] = await p.execute(
    `INSERT INTO \`prefix_inventory\` (
      country_id, country_code, prefix, rate, rate_currency, payment_term,
      supplier_id, destination_id, routes_logic, test_number, status, notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      countryId,
      countryCode,
      prefix,
      rate,
      rateCurrency,
      paymentTerm,
      supplierId,
      destinationId,
      routesLogic,
      testNumber,
      status,
      notes,
    ]
  );
  return mysqlGetPrefixInventoryRow(String(r.insertId));
}

export async function mysqlUpdatePrefixInventory(id, body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const cur = await mysqlGetPrefixInventoryRow(id);
  if (!cur) throw new Error('Prefix not found');
  const merged = {
    countryCode: body.countryCode != null ? String(body.countryCode).replace(/\D/g, '') : cur.countryCode,
    prefix: body.prefix != null ? String(body.prefix).replace(/\D/g, '') : cur.prefix,
    rate: body.rate != null ? String(body.rate) : cur.rate,
    rateCurrency: body.rateCurrency != null
      ? (String(body.rateCurrency).toLowerCase() === 'eur' ? 'eur' : 'usd')
      : cur.rateCurrency,
    paymentTerm: body.paymentTerm != null ? String(body.paymentTerm).toLowerCase() : cur.paymentTerm,
    supplierId: body.supplierId !== undefined ? String(body.supplierId ?? '') : cur.supplierId,
    destinationId: body.destinationId != null ? String(body.destinationId) : cur.destinationId,
    routesLogic: body.routesLogic !== undefined ? String(body.routesLogic ?? '') : cur.routesLogic,
    testNumber: body.testNumber !== undefined ? String(body.testNumber ?? '').replace(/\D/g, '') : cur.testNumber,
    status: body.status != null ? String(body.status) : cur.status,
    notes: body.notes !== undefined ? String(body.notes ?? '') : cur.notes,
  };
  let pt = merged.paymentTerm;
  if (!['weekly', 'monthly', 'daily'].includes(pt)) pt = 'weekly';
  const st = String(merged.status).toLowerCase() === 'inactive' ? 'inactive' : 'active';
  await p.execute(
    `UPDATE \`prefix_inventory\` SET
      country_code = ?, prefix = ?, rate = ?, rate_currency = ?, payment_term = ?,
      supplier_id = ?, destination_id = ?, routes_logic = ?, test_number = ?, status = ?, notes = ?
     WHERE id = ?`,
    [
      merged.countryCode,
      merged.prefix,
      merged.rate,
      merged.rateCurrency,
      pt,
      merged.supplierId,
      merged.destinationId,
      merged.routesLogic,
      merged.testNumber,
      st,
      merged.notes,
      parseInt(id, 10),
    ]
  );
  return mysqlGetPrefixInventoryRow(id);
}

export async function mysqlDeletePrefixInventory(id) {
  const p = getMysqlPool();
  if (!p) return false;
  const [r] = await p.execute('DELETE FROM `prefix_inventory` WHERE `id` = ?', [parseInt(id, 10)]);
  return r.affectedRows > 0;
}

/**
 * Create DID rows from a catalog prefix (list or numeric range).
 */
export async function mysqlCreateDidsFromPrefixInventory(prefixInventoryId, payload) {
  const inv = await mysqlGetPrefixInventoryRow(prefixInventoryId);
  if (!inv) throw new Error('Prefix catalog row not found');
  if (String(inv.status).toLowerCase() === 'inactive') throw new Error('Prefix is inactive');

  let extensions = [];
  if (payload?.rangeFrom != null && payload?.rangeTo != null) {
    const from = parseInt(String(payload.rangeFrom), 10);
    const to = parseInt(String(payload.rangeTo), 10);
    if (Number.isNaN(from) || Number.isNaN(to)) throw new Error('Invalid range');
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    if (end - start > 10000) throw new Error('Range too large (max 10001 numbers)');
    const padLen = String(end).length;
    for (let i = start; i <= end; i++) {
      extensions.push(String(i).padStart(padLen, '0'));
    }
  } else if (Array.isArray(payload?.extensions)) {
    extensions = payload.extensions.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof payload?.extensionsText === 'string') {
    extensions = payload.extensionsText.split(/\r?\n/).map((s) => s.trim().replace(/\D/g, '')).filter(Boolean);
  } else {
    throw new Error('Provide extensions array, extensionsText, or rangeFrom/rangeTo');
  }

  if (!extensions.length) throw new Error('No extensions to create');

  const nums = extensions.map((ext) =>
    normalizeNumberRecord({
      country: inv.countryLabel || 'XX',
      countryCode: inv.countryCode,
      prefix: inv.prefix,
      extension: ext,
      rate: inv.rate,
      rateCurrency: inv.rateCurrency,
      paymentTerm: inv.paymentTerm,
      supplierId: inv.supplierId,
      destinationType: 'ivr',
      destinationId: inv.destinationId,
      status: 'active',
      clientName: null,
      allocationDate: null,
      prefixInventoryId: String(inv.id),
    })
  );

  const dupCheck = new Set();
  for (const n of nums) {
    const k = fullNumberDigits(n);
    if (dupCheck.has(k)) throw new Error(`Duplicate extension in request: ${k}`);
    dupCheck.add(k);
  }

  return mysqlBulkUpsert(nums);
}
