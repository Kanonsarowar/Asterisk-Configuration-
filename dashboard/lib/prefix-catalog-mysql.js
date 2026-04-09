/**
 * Staging-only prefix catalog: template (price, test number, routes) before bulk DIDs.
 */
import { getMysqlPool } from './mysql.js';
import { mysqlBulkUpsert, fullNumberDigits } from './numbers-mysql.js';
import { normalizeNumberRecord } from './store.js';
/**
 * Full E.164 digits must equal country_code + prefix + extension (as stored in catalog).
 */
function splitFromCatalog(cat, fullDigits) {
  const full = String(fullDigits || '').replace(/\D/g, '');
  const cc = String(cat.countryCode || '').replace(/\D/g, '');
  const pfx = String(cat.prefix || '').replace(/\D/g, '');
  if (!cc || !pfx) throw new Error('catalog missing country_code or prefix');
  const head = cc + pfx;
  if (!full.startsWith(head)) throw new Error('test_number must start with country_code + prefix');
  const ext = full.slice(head.length);
  if (!ext) throw new Error('test_number needs extension digits after prefix');
  return {
    countryCode: cc,
    prefix: pfx,
    extension: ext,
  };
}

function rowToApp(r) {
  if (!r) return null;
  return {
    id: String(r.id),
    country: r.country ?? 'XX',
    countryCode: String(r.country_code ?? '').replace(/\D/g, ''),
    prefix: String(r.prefix ?? '').replace(/\D/g, ''),
    rate: String(r.rate ?? '0.01'),
    rateCurrency: String(r.rate_currency || 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd',
    paymentTerm: String(r.payment_term || 'weekly').toLowerCase(),
    supplierId: r.supplier_id != null ? String(r.supplier_id) : '',
    destinationId: String(r.destination_id ?? '1'),
    testNumber: String(r.test_number ?? '').replace(/\D/g, ''),
    routesNotes: r.routes_notes != null ? String(r.routes_notes) : '',
    status: String(r.status || 'staging'),
    createdAt: r.created_at != null ? (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)) : null,
  };
}

export async function mysqlListPrefixCatalog() {
  const p = getMysqlPool();
  if (!p) return [];
  const [rows] = await p.query(
    'SELECT * FROM `prefix_catalog` ORDER BY `country` ASC, `country_code` ASC, `prefix` ASC, `id` ASC'
  );
  return (rows || []).map(rowToApp);
}

export async function mysqlCreatePrefixCatalog(body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const country = String(body?.country ?? 'XX').trim().slice(0, 8) || 'XX';
  const countryCode = String(body?.countryCode ?? body?.country_code ?? '').replace(/\D/g, '');
  const prefix = String(body?.prefix ?? '').replace(/\D/g, '');
  if (!prefix) throw new Error('prefix is required');
  const testNumber = String(body?.testNumber ?? body?.test_number ?? '').replace(/\D/g, '');
  if (!testNumber) throw new Error('testNumber is required');
  const rate = String(body?.rate ?? '0.01');
  const rateCurrency = String(body?.rateCurrency ?? 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd';
  let paymentTerm = String(body?.paymentTerm ?? 'weekly').toLowerCase();
  if (!['weekly', 'monthly', 'daily'].includes(paymentTerm)) paymentTerm = 'weekly';
  const supplierId = body?.supplierId != null ? String(body.supplierId) : '';
  const destinationId = String(body?.destinationId ?? '1');
  const routesNotes = body?.routesNotes != null ? String(body.routesNotes) : '';
  const status = String(body?.status ?? 'staging').toLowerCase() === 'validated' ? 'validated' : 'staging';

  const [r] = await p.execute(
    `INSERT INTO \`prefix_catalog\` (
      country, country_code, prefix, rate, rate_currency, payment_term,
      supplier_id, destination_id, test_number, routes_notes, status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [country, countryCode, prefix, rate, rateCurrency, paymentTerm, supplierId, destinationId, testNumber, routesNotes, status]
  );
  const [rows] = await p.query('SELECT * FROM `prefix_catalog` WHERE `id` = ? LIMIT 1', [r.insertId]);
  return rowToApp(rows[0]);
}

export async function mysqlUpdatePrefixCatalog(id, body) {
  const p = getMysqlPool();
  if (!p) throw new Error('MySQL unavailable');
  const cur = (await mysqlListPrefixCatalog()).find((x) => String(x.id) === String(id));
  if (!cur) throw new Error('Not found');
  const merged = {
    country: body.country != null ? String(body.country).trim().slice(0, 8) : cur.country,
    countryCode: body.countryCode != null ? String(body.countryCode).replace(/\D/g, '') : cur.countryCode,
    prefix: body.prefix != null ? String(body.prefix).replace(/\D/g, '') : cur.prefix,
    rate: body.rate != null ? String(body.rate) : cur.rate,
    rateCurrency:
      body.rateCurrency != null
        ? String(body.rateCurrency).toLowerCase() === 'eur'
          ? 'eur'
          : 'usd'
        : cur.rateCurrency,
    paymentTerm: body.paymentTerm != null ? String(body.paymentTerm).toLowerCase() : cur.paymentTerm,
    supplierId: body.supplierId !== undefined ? String(body.supplierId ?? '') : cur.supplierId,
    destinationId: body.destinationId != null ? String(body.destinationId) : cur.destinationId,
    testNumber: body.testNumber != null ? String(body.testNumber).replace(/\D/g, '') : cur.testNumber,
    routesNotes: body.routesNotes !== undefined ? String(body.routesNotes ?? '') : cur.routesNotes,
    status: body.status != null ? String(body.status).toLowerCase() : cur.status,
  };
  let pt = merged.paymentTerm;
  if (!['weekly', 'monthly', 'daily'].includes(pt)) pt = 'weekly';
  const st = merged.status === 'validated' ? 'validated' : 'staging';

  await p.execute(
    `UPDATE \`prefix_catalog\` SET
      country=?, country_code=?, prefix=?, rate=?, rate_currency=?, payment_term=?,
      supplier_id=?, destination_id=?, test_number=?, routes_notes=?, status=?
     WHERE id=?`,
    [
      merged.country,
      merged.countryCode,
      merged.prefix,
      merged.rate,
      merged.rateCurrency,
      pt,
      merged.supplierId,
      merged.destinationId,
      merged.testNumber,
      merged.routesNotes,
      st,
      parseInt(id, 10),
    ]
  );
  const [rows] = await p.query('SELECT * FROM `prefix_catalog` WHERE `id` = ? LIMIT 1', [parseInt(id, 10)]);
  return rowToApp(rows[0]);
}

export async function mysqlDeletePrefixCatalog(id) {
  const p = getMysqlPool();
  if (!p) return false;
  const [r] = await p.execute('DELETE FROM `prefix_catalog` WHERE `id` = ?', [parseInt(id, 10)]);
  return r.affectedRows > 0;
}

function numberFromCatalogRow(cat) {
  const { countryCode, prefix, extension } = splitFromCatalog(cat, cat.testNumber);
  return normalizeNumberRecord({
    country: cat.country || 'XX',
    countryCode,
    prefix,
    extension,
    rate: cat.rate,
    rateCurrency: cat.rateCurrency,
    paymentTerm: cat.paymentTerm,
    supplierId: cat.supplierId,
    destinationType: 'ivr',
    destinationId: cat.destinationId,
    status: 'active',
  });
}

/** Insert the catalog test number as one DID (staging validation → production number). */
export async function mysqlPromoteCatalogTestNumber(catalogId) {
  const rows = await mysqlListPrefixCatalog();
  const cat = rows.find((x) => String(x.id) === String(catalogId));
  if (!cat) throw new Error('Catalog row not found');
  const n = numberFromCatalogRow(cat);
  if (!fullNumberDigits(n)) throw new Error('Invalid test number split');
  const out = await mysqlBulkUpsert([n]);
  return out[0] || null;
}

/** Bulk DIDs using catalog commercial fields + new extensions (list or range). */
export async function mysqlPromoteCatalogExtensions(catalogId, payload) {
  const rows = await mysqlListPrefixCatalog();
  const cat = rows.find((x) => String(x.id) === String(catalogId));
  if (!cat) throw new Error('Catalog row not found');
  const cc = String(cat.countryCode || '').replace(/\D/g, '');
  const pfx = String(cat.prefix || '').replace(/\D/g, '');
  if (!cc || !pfx) throw new Error('Catalog row missing country_code/prefix');

  let extensions = [];
  if (payload?.rangeFrom != null && payload?.rangeTo != null) {
    const from = parseInt(String(payload.rangeFrom), 10);
    const to = parseInt(String(payload.rangeTo), 10);
    if (Number.isNaN(from) || Number.isNaN(to)) throw new Error('Invalid range');
    const start = Math.min(from, to);
    const end = Math.max(from, to);
    if (end - start > 10000) throw new Error('Range too large');
    const padLen = String(end).length;
    for (let i = start; i <= end; i++) extensions.push(String(i).padStart(padLen, '0'));
  } else if (Array.isArray(payload?.extensions)) {
    extensions = payload.extensions.map((x) => String(x).trim()).filter(Boolean);
  } else if (typeof payload?.extensionsText === 'string') {
    extensions = payload.extensionsText
      .split(/\r?\n/)
      .map((s) => s.trim().replace(/\D/g, ''))
      .filter(Boolean);
  } else {
    throw new Error('Provide extensionsText, extensions[], or rangeFrom/rangeTo');
  }
  if (!extensions.length) throw new Error('No extensions');

  const nums = extensions.map((ext) =>
    normalizeNumberRecord({
      country: cat.country || 'XX',
      countryCode: cc,
      prefix: pfx,
      extension: ext,
      rate: cat.rate,
      rateCurrency: cat.rateCurrency,
      paymentTerm: cat.paymentTerm,
      supplierId: cat.supplierId,
      destinationType: 'ivr',
      destinationId: cat.destinationId,
      status: 'active',
    })
  );
  return mysqlBulkUpsert(nums);
}
