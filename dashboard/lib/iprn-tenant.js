/**
 * Multi-tenant IPRN portal on existing iprn_system.
 * - Portal users: iprn_users (login, role, parent_user_id, balance)
 * - DID assignment: user_numbers.user_id → number (number must exist in number_inventory / ODBC)
 * - Rates for display: number_inventory.rate_per_min
 * - Billing rows: call_billing when TENANT_CDR_PRIMARY_SOURCE=call_billing|auto
 */
import { hashPassword } from './auth.js';
import { getCdrHistory } from './cdr.js';

const ROLES = new Set(['admin', 'user', 'subuser']);

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

/** Sanitized mapping table name (default user_numbers). */
export function userNumbersTable() {
  const t = String(process.env.DASHBOARD_USER_NUMBERS_TABLE || 'user_numbers').trim();
  return /^[a-zA-Z0-9_]+$/.test(t) ? t : 'user_numbers';
}

function qUn() {
  return `\`${userNumbersTable()}\``;
}

export async function verifyTenantLogin(pool, username, password) {
  const u = String(username || '').trim();
  if (!u || !password) return null;
  const [rows] = await pool.execute(
    'SELECT id, username, password_hash, role, parent_user_id, balance, status FROM iprn_users WHERE username = ? LIMIT 1',
    [u]
  );
  const row = rows[0];
  if (!row || String(row.status || '').toLowerCase() !== 'active') return null;
  if (row.password_hash !== hashPassword(password)) return null;
  return row;
}

export async function getTenantUserById(pool, id) {
  const [rows] = await pool.execute(
    'SELECT id, username, role, parent_user_id, balance, status, created_at FROM iprn_users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

export async function listAllTenantUsers(pool) {
  const [rows] = await pool.execute(
    'SELECT id, username, role, parent_user_id, balance, status, created_at FROM iprn_users ORDER BY id ASC'
  );
  return rows;
}

export async function createTenantUser(pool, { username, password, role, parent_user_id, balance }) {
  const u = String(username || '').trim();
  const r = String(role || 'user').toLowerCase();
  if (!u || u.length > 64) return { ok: false, error: 'Invalid username' };
  if (!ROLES.has(r)) return { ok: false, error: 'Invalid role' };
  if (!password || String(password).length < 8) return { ok: false, error: 'Password min 8 chars' };
  let parentId = null;
  if (parent_user_id != null && parent_user_id !== '') {
    parentId = parseInt(String(parent_user_id), 10);
    if (!Number.isFinite(parentId)) return { ok: false, error: 'Invalid parent' };
  }
  const bal = balance != null ? parseFloat(String(balance)) : 0;
  try {
    const [res] = await pool.execute(
      `INSERT INTO iprn_users (username, password_hash, role, parent_user_id, balance, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [u, hashPassword(password), r, parentId, Number.isFinite(bal) ? bal : 0]
    );
    return { ok: true, id: res.insertId };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return { ok: false, error: 'Username taken' };
    return { ok: false, error: e.message || 'Insert failed' };
  }
}

export async function updateTenantUser(pool, id, { password, balance, status, role }) {
  const uid = parseInt(String(id), 10);
  if (!Number.isFinite(uid)) return { ok: false, error: 'Invalid id' };
  const fields = [];
  const vals = [];
  if (password) {
    if (String(password).length < 8) return { ok: false, error: 'Password min 8 chars' };
    fields.push('password_hash = ?');
    vals.push(hashPassword(password));
  }
  if (balance !== undefined) {
    const b = parseFloat(String(balance));
    fields.push('balance = ?');
    vals.push(Number.isFinite(b) ? b : 0);
  }
  if (status !== undefined) {
    fields.push('status = ?');
    vals.push(String(status).slice(0, 24));
  }
  if (role !== undefined) {
    const r = String(role).toLowerCase();
    if (!ROLES.has(r)) return { ok: false, error: 'Invalid role' };
    fields.push('role = ?');
    vals.push(r);
  }
  if (!fields.length) return { ok: false, error: 'Nothing to update' };
  vals.push(uid);
  await pool.execute(`UPDATE iprn_users SET ${fields.join(', ')} WHERE id = ?`, vals);
  return { ok: true };
}

export async function deleteTenantUser(pool, id) {
  const uid = parseInt(String(id), 10);
  if (!Number.isFinite(uid)) return { ok: false, error: 'Invalid id' };
  const [res] = await pool.execute('DELETE FROM iprn_users WHERE id = ?', [uid]);
  return res.affectedRows ? { ok: true } : { ok: false, error: 'Not found' };
}

export async function listDescendantIds(pool, rootId) {
  const root = parseInt(String(rootId), 10);
  if (!Number.isFinite(root)) return [];
  const out = new Set([root]);
  let frontier = [root];
  while (frontier.length) {
    const ph = frontier.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id FROM iprn_users WHERE parent_user_id IN (${ph}) AND status = 'active'`,
      frontier
    );
    frontier = [];
    for (const r of rows) {
      const id = r.id;
      if (!out.has(id)) {
        out.add(id);
        frontier.push(id);
      }
    }
  }
  return [...out];
}

/** IDs that this session may act on for assignments / CDR / channels */
export async function effectiveScopedUserIds(pool, sess) {
  if (!sess || sess.kind !== 'tenant') return [];
  const uid = sess.userId;
  const role = String(sess.role || '').toLowerCase();
  if (role === 'subuser') return [uid];
  return listDescendantIds(pool, uid);
}

export function isTenantClient(sess) {
  if (!sess || sess.kind !== 'tenant') return false;
  const r = String(sess.role || '').toLowerCase();
  return r === 'admin' || r === 'user';
}

/** Numbers assigned to any of userIds (active) — table user_numbers (configurable). */
export async function getNumbersForUsers(pool, userIds) {
  if (!userIds.length) return [];
  const ph = userIds.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, user_id, number, assigned_at, status FROM ${qUn()}
     WHERE user_id IN (${ph}) AND status = 'active' ORDER BY number ASC`,
    userIds
  );
  return rows;
}

/** DID must exist in number_inventory (same rows Asterisk ODBC / ROUTE_INFO uses). */
export async function numberExistsInInventory(pool, number) {
  const n = digits(number);
  if (!n) return false;
  const [rows] = await pool.execute('SELECT 1 FROM number_inventory WHERE number = ? LIMIT 1', [n]);
  return rows.length > 0;
}

export async function assignNumberToUser(pool, userId, number) {
  const uid = parseInt(String(userId), 10);
  const n = digits(number);
  if (!Number.isFinite(uid) || !n) return { ok: false, error: 'Invalid' };
  const ex = await numberExistsInInventory(pool, n);
  if (!ex) return { ok: false, error: 'Number not in number_inventory (ODBC inventory)' };
  try {
    await pool.execute(
      `INSERT INTO ${qUn()} (user_id, number, status) VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE status = 'active', assigned_at = CURRENT_TIMESTAMP`,
      [uid, n]
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'Assign failed' };
  }
}

export async function unassignNumber(pool, userId, number) {
  const uid = parseInt(String(userId), 10);
  const n = digits(number);
  await pool.execute(`DELETE FROM ${qUn()} WHERE user_id = ? AND number = ?`, [uid, n]);
  return { ok: true };
}

/** rate_per_min from number_inventory (aligns with func_odbc / ROUTE_INFO). */
export async function getRateMap(pool) {
  const [rows] = await pool.execute('SELECT number, rate_per_min FROM number_inventory');
  const map = {};
  for (const r of rows) {
    const key = digits(r.number);
    map[key] = parseFloat(String(r.rate_per_min ?? '0').replace(',', '.')) || 0;
  }
  return map;
}

/**
 * Tenant-visible rows from existing call_billing (filtered by assigned numbers).
 */
export async function getTenantCallBillingRows(pool, sess, { hours = 168, limit = 500, dateFrom = '', dateTo = '' } = {}) {
  const ids = await effectiveScopedUserIds(pool, sess);
  const assigns = await getNumbersForUsers(pool, ids);
  const numberSet = [...new Set(assigns.map((a) => digits(a.number)).filter(Boolean))];
  if (!numberSet.length) {
    return { ok: true, calls: [], total: 0, source: 'call_billing' };
  }
  const ph = numberSet.map(() => '?').join(',');
  const params = [...numberSet];
  let sql = `SELECT call_id, number, supplier, start_time, end_time, duration, rate, cost, profit
    FROM call_billing WHERE number IN (${ph})`;
  if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    sql += ' AND start_time >= ?';
    params.push(`${dateFrom} 00:00:00`);
  }
  if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    sql += ' AND start_time <= ?';
    params.push(`${dateTo} 23:59:59`);
  }
  if (!dateFrom && !dateTo) {
    const h = Math.min(24 * 366, Math.max(1, parseInt(String(hours), 10) || 168));
    sql += ' AND start_time >= DATE_SUB(NOW(), INTERVAL ? HOUR)';
    params.push(h);
  }
  const cap = Math.min(5000, Math.max(1, parseInt(String(limit), 10) || 500));
  sql += ` ORDER BY start_time DESC LIMIT ${cap}`;
  const [rows] = await pool.execute(sql, params);
  const calls = rows.map((r) => ({
    call_id: r.call_id,
    src: '',
    dst: r.number,
    duration: r.duration || 0,
    billsec: r.duration || 0,
    disposition: '',
    start:
      r.start_time instanceof Date
        ? r.start_time.toISOString()
        : r.start_time
          ? String(r.start_time)
          : '',
    supplier: r.supplier || '',
    rate: Number(r.rate) || 0,
    cost: Number(r.cost) || 0,
  }));
  return { ok: true, calls, total: calls.length, source: 'call_billing' };
}

export function filterCallsByNumberSet(calls, numberSet) {
  const set = numberSet instanceof Set ? numberSet : new Set(numberSet);
  if (!set.size) return [];
  return calls.filter((c) => {
    const dDst = digits(c.destinationNumber || c.dst || c.exten);
    const dSrc = digits(c.callerid || c.src);
    for (const n of set) {
      if (!n) continue;
      if (dDst && (dDst === n || dDst.endsWith(n) || n.endsWith(dDst))) return true;
      if (dSrc && (dSrc === n || dSrc.endsWith(n) || n.endsWith(dSrc))) return true;
    }
    return false;
  });
}

export async function getTenantLiveCalls(pool, sess, channelsPayload) {
  const ids = await effectiveScopedUserIds(pool, sess);
  const assigns = await getNumbersForUsers(pool, ids);
  const numberSet = new Set(assigns.map((a) => digits(a.number)).filter(Boolean));
  const calls = Array.isArray(channelsPayload.calls) ? channelsPayload.calls : [];
  const filtered = filterCallsByNumberSet(calls, numberSet);
  const byUser = {};
  for (const a of assigns) {
    byUser[a.user_id] = byUser[a.user_id] || [];
    byUser[a.user_id].push(a.number);
  }
  const enriched = filtered.map((c) => {
    const d = digits(c.destinationNumber || c.exten);
    const s = digits(c.callerid);
    let assignedUserId = null;
    for (const a of assigns) {
      const an = digits(a.number);
      if (d && (d === an || d.endsWith(an) || an.endsWith(d))) {
        assignedUserId = a.user_id;
        break;
      }
      if (s && (s === an || s.endsWith(an) || an.endsWith(s))) {
        assignedUserId = a.user_id;
        break;
      }
    }
    return { ...c, assignedUserId };
  });
  return { calls: enriched, activeCount: enriched.length, numberCount: numberSet.size };
}

export async function getTenantCdrRows(pool, sess, { hours = 168, limit = 500, dateFrom = '', dateTo = '' } = {}) {
  const primary = String(process.env.TENANT_CDR_PRIMARY_SOURCE || 'auto').toLowerCase();
  if (primary !== 'cdr_csv') {
    const cb = await getTenantCallBillingRows(pool, sess, { hours, limit, dateFrom, dateTo });
    if (cb.calls && cb.calls.length > 0) {
      return {
        ok: true,
        calls: (cb.calls || []).slice(0, limit),
        total: cb.total,
        source: 'call_billing',
      };
    }
    if (primary === 'call_billing') {
      return { ok: true, calls: [], total: 0, source: 'call_billing' };
    }
  }

  const ids = await effectiveScopedUserIds(pool, sess);
  const assigns = await getNumbersForUsers(pool, ids);
  const numberSet = new Set(assigns.map((a) => digits(a.number)).filter(Boolean));
  const opts = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) opts.dateFrom = dateFrom;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) opts.dateTo = dateTo;
  const hist = getCdrHistory(hours, Math.min(5000, Math.max(limit, 1)), opts);
  if (!hist.ok) return { ok: false, calls: [], error: hist.error };
  const rateMap = await getRateMap(pool);
  const calls = (hist.calls || [])
    .filter((row) => {
      const d = digits(row.dst);
      const s = digits(row.src);
      for (const n of numberSet) {
        if (d && (d === n || d.endsWith(n) || n.endsWith(d))) return true;
        if (s && (s === n || s.endsWith(n) || n.endsWith(s))) return true;
      }
      return false;
    })
    .map((row) => {
      const d = digits(row.dst);
      let rate = 0;
      for (const len of [d.length, d.length - 1, 10, 11, 12]) {
        if (len < 6) break;
        const sub = d.slice(-len);
        if (rateMap[sub] != null) {
          rate = rateMap[sub];
          break;
        }
      }
      if (!rate && rateMap[d] != null) rate = rateMap[d];
      const billmin = (Number(row.billsec) || 0) / 60;
      const cost = +(billmin * rate).toFixed(4);
      return {
        call_id: `${row.start}-${row.channel}`.replace(/\s/g, ''),
        src: row.src,
        dst: row.dst,
        duration: row.duration,
        billsec: row.billsec,
        disposition: row.disposition,
        start: row.start,
        supplier: row.sourceIp || '',
        rate,
        cost,
      };
    });
  return { ok: true, calls: calls.slice(0, limit), total: calls.length, source: 'cdr_csv' };
}

export async function getTenantDashboardSummary(pool, sess, { status, tenantLive }) {
  const user = await getTenantUserById(pool, sess.userId);
  const ids = await effectiveScopedUserIds(pool, sess);
  const assigns = await getNumbersForUsers(pool, ids);
  const numberSet = new Set(assigns.map((a) => digits(a.number)));
  const cdr = await getTenantCdrRows(pool, sess, { hours: 720, limit: 2000 });
  const totalCost = (cdr.calls || []).reduce((s, c) => s + (Number(c.cost) || 0), 0);
  let invRows = [];
  if (ids.length) {
    const [rows] = await pool.execute(
      `SELECT id, amount, period_start, period_end, status, created_at FROM iprn_invoices
       WHERE user_id IN (${ids.map(() => '?').join(',')}) ORDER BY id DESC LIMIT 5`,
      ids
    );
    invRows = rows;
  }
  return {
    user: user
      ? {
          id: user.id,
          username: user.username,
          role: user.role,
          balance: Number(user.balance),
        }
      : null,
    activeNumbers: numberSet.size,
    liveCalls: tenantLive?.activeCount ?? 0,
    cdrCostWindow: +totalCost.toFixed(4),
    recentInvoices: invRows,
    asteriskRunning: !!(status && status.running),
  };
}

export async function listInvoicesForScope(pool, sess) {
  const ids = await effectiveScopedUserIds(pool, sess);
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');
  const [rows] = await pool.execute(
    `SELECT id, user_id, amount, period_start, period_end, status, created_at, meta FROM iprn_invoices
     WHERE user_id IN (${ph}) ORDER BY id DESC LIMIT 200`,
    ids
  );
  return rows.map((r) => ({
    ...r,
    meta: r.meta && typeof r.meta === 'string' ? JSON.parse(r.meta) : r.meta,
  }));
}

export async function generateInvoice(pool, userId, periodStart, periodEnd) {
  const uid = parseInt(String(userId), 10);
  if (!Number.isFinite(uid)) return { ok: false, error: 'Invalid user' };
  const sess = { kind: 'tenant', userId: uid, role: 'user' };
  const cdr = await getTenantCdrRows(pool, sess, {
    hours: 24 * 400,
    limit: 100000,
    dateFrom: periodStart,
    dateTo: periodEnd,
  });
  const calls = cdr.calls || [];
  const totalCost = calls.reduce((s, c) => s + (Number(c.cost) || 0), 0);
  const totalDur = calls.reduce((s, c) => s + (Number(c.billsec) || 0), 0);
  const meta = {
    total_calls: calls.length,
    total_duration_sec: totalDur,
    total_cost: +totalCost.toFixed(4),
    billing_source: cdr.source || 'unknown',
  };
  const [res] = await pool.execute(
    `INSERT INTO iprn_invoices (user_id, amount, period_start, period_end, status, meta)
     VALUES (?, ?, ?, ?, 'issued', ?)`,
    [uid, +totalCost.toFixed(4), periodStart, periodEnd, JSON.stringify(meta)]
  );
  return { ok: true, id: res.insertId, meta };
}

export async function getInvoiceById(pool, id) {
  const [rows] = await pool.execute('SELECT * FROM iprn_invoices WHERE id = ? LIMIT 1', [id]);
  const r = rows[0];
  if (!r) return null;
  let meta = r.meta;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  return { ...r, meta };
}

export function invoiceToCsvRow(inv) {
  const m = inv.meta || {};
  return [
    inv.id,
    inv.user_id,
    inv.amount,
    inv.period_start,
    inv.period_end,
    inv.status,
    m.total_calls ?? '',
    m.total_duration_sec ?? '',
    m.total_cost ?? '',
  ];
}

export async function listSubusers(pool, parentId) {
  const pid = parseInt(String(parentId), 10);
  const [rows] = await pool.execute(
    `SELECT id, username, role, balance, status, created_at FROM iprn_users WHERE parent_user_id = ? ORDER BY id ASC`,
    [pid]
  );
  return rows;
}

export async function assertCanAssign(pool, actorSess, targetUserId, number) {
  const target = parseInt(String(targetUserId), 10);
  if (!Number.isFinite(target)) return { ok: false, error: 'Bad target user' };
  const actor = await getTenantUserById(pool, actorSess.userId);
  if (!actor) return { ok: false, error: 'Actor not found' };
  const allowedIds = await effectiveScopedUserIds(pool, actorSess);
  if (!allowedIds.includes(target)) return { ok: false, error: 'Target not in your organization' };
  const n = digits(number);
  if (!n) return { ok: false, error: 'Bad number' };

  if (isTenantClient(actorSess) && String(actor.role || '').toLowerCase() !== 'subuser') {
    if (actorSess.userId !== target) {
      const mine = await getNumbersForUsers(pool, [actorSess.userId]);
      const mineSet = new Set(mine.map((x) => digits(x.number)));
      if (!mineSet.has(n)) {
        return { ok: false, error: 'You can only assign numbers you already hold' };
      }
    }
  }
  return { ok: true };
}

export async function assertPanelCanAssignTarget(pool, targetUserId) {
  const target = parseInt(String(targetUserId), 10);
  if (!Number.isFinite(target)) return { ok: false, error: 'Bad target' };
  const u = await getTenantUserById(pool, target);
  if (!u) return { ok: false, error: 'User not found' };
  return { ok: true };
}
