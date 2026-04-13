/**
 * Keeps carrier-style `did_inventory` in sync with dashboard `numbers` rows.
 * Optional tables — created from sql/carrier_inventory.sql.
 */
import { getMysqlPool } from './mysql.js';

function fullDigitsApp(app) {
  const cc = String(app.countryCode ?? '').replace(/\D/g, '');
  const p = String(app.prefix ?? '').replace(/\D/g, '');
  const e = String(app.extension ?? '').replace(/\D/g, '');
  return `${cc}${p}${e}`;
}

function mapDidStatusFromRow(r) {
  const st = String(r.status || 'active').toLowerCase();
  const iprn = String(r.iprn_route_status ?? r.iprnRouteStatus ?? '').toLowerCase();
  if (iprn === 'blocked') return 'blocked';
  if (st === 'allocated') return 'assigned';
  if (r.client_name || r.clientName) return 'assigned';
  if (st === 'active') return 'free';
  return 'reserved';
}

function mapDidStatusFromApp(app) {
  const st = String(app.status || 'active').toLowerCase();
  const iprn = String(app.iprnRouteStatus || '').toLowerCase();
  if (iprn === 'blocked') return 'blocked';
  if (st === 'allocated') return 'assigned';
  if (app.clientName) return 'assigned';
  if (st === 'active') return 'free';
  return 'reserved';
}

function providerIdFromSupplier(sid) {
  if (sid == null || sid === '') return null;
  const n = parseInt(String(sid).replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Full E.164 digits from DB row */
function fullDigits(row) {
  const cc = String(row.country_code ?? '').replace(/\D/g, '');
  const p = String(row.prefix ?? '').replace(/\D/g, '');
  const e = String(row.extension ?? '').replace(/\D/g, '');
  return `${cc}${p}${e}`;
}

let didInventoryTableMissing = false;

async function tableExists(p, name) {
  try {
    const [r] = await p.query(
      'SELECT 1 AS o FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
      [name]
    );
    return r && r.length > 0;
  } catch {
    return false;
  }
}

/**
 * Upsert one row in did_inventory from a dashboard app record (after numbers save).
 */
export async function syncDidInventoryFromApp(app) {
  if (didInventoryTableMissing) return;
  const p = getMysqlPool();
  if (!p || !app) return;
  try {
    if (!(await tableExists(p, 'did_inventory'))) {
      didInventoryTableMissing = true;
      return;
    }
    const num = String(app.number || fullDigitsApp(app))
      .replace(/\D/g, '')
      .slice(0, 20);
    if (!num) return;
    const id = parseInt(String(app.id), 10);
    if (!Number.isFinite(id)) return;
    const status = mapDidStatusFromApp(app);
    const pid = providerIdFromSupplier(app.supplierId);
    await p.execute('DELETE FROM `did_inventory` WHERE `dashboard_number_id` = ? OR `number` = ?', [id, num]);
    await p.execute(
      `INSERT INTO \`did_inventory\` (\`number\`, \`country\`, \`country_code\`, \`prefix\`, \`status\`, \`provider_id\`, \`route_id\`, \`dashboard_number_id\`)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        num,
        app.country || null,
        app.countryCode || null,
        app.prefix ? String(app.prefix).slice(0, 32) : null,
        status,
        pid,
        null,
        id,
      ]
    );
  } catch (e) {
    if (String(e?.code) === 'ER_NO_SUCH_TABLE') didInventoryTableMissing = true;
    else console.error('[did_inventory] sync:', e?.message || e);
  }
}

export async function deleteDidInventoryByNumberDigits(digitStr) {
  if (didInventoryTableMissing) return;
  const p = getMysqlPool();
  if (!p || !digitStr) return;
  try {
    if (!(await tableExists(p, 'did_inventory'))) {
      didInventoryTableMissing = true;
      return;
    }
    await p.execute('DELETE FROM `did_inventory` WHERE `number` = ?', [String(digitStr).replace(/\D/g, '').slice(0, 20)]);
  } catch {
    /* ignore */
  }
}

/**
 * Rebuild `did_inventory` from `numbers` (truncate + insert).
 * @returns {{ ok: boolean, count?: number, error?: string, skipped?: boolean }}
 */
export async function rebuildDidInventoryFromNumbers() {
  const p = getMysqlPool();
  if (!p) return { ok: false, error: 'MySQL unavailable' };
  try {
    if (!(await tableExists(p, 'did_inventory'))) {
      return { ok: true, skipped: true, count: 0 };
    }
    const [rows] = await p.query(
      'SELECT `id`, `number`, `country`, `country_code`, `prefix`, `extension`, `status`, `client_name`, `supplier_id`, `iprn_route_status` FROM `numbers`'
    );
    await p.execute('DELETE FROM `did_inventory`');
    let count = 0;
    for (const r of rows || []) {
      const num = String(r.number || fullDigits(r)).replace(/\D/g, '').slice(0, 20);
      if (!num) continue;
      const status = mapDidStatusFromRow(r);
      const pid = providerIdFromSupplier(r.supplier_id);
      await p.execute(
        `INSERT INTO \`did_inventory\` (\`number\`, \`country\`, \`country_code\`, \`prefix\`, \`status\`, \`provider_id\`, \`route_id\`, \`dashboard_number_id\`)
         VALUES (?,?,?,?,?,?,?,?)`,
        [
          num,
          r.country || null,
          r.country_code || null,
          r.prefix ? String(r.prefix).slice(0, 32) : null,
          status,
          pid,
          null,
          r.id,
        ]
      );
      count += 1;
    }
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
