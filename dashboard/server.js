import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync, renameSync, unlinkSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

import { Store } from './lib/store.js';
import { writeConfigs } from './lib/config-generator.js';
import * as asterisk from './lib/asterisk.js';
import {
  authenticate,
  validateSession,
  destroySession,
  parseCookie,
  getSession,
  createTenantSession,
} from './lib/auth.js';
import * as tenant from './lib/iprn-tenant.js';
import { getCdrStats, getCdrHistory } from './lib/cdr.js';
import { getRecentInvites } from './lib/sip-log.js';
import { buildBalanceReport } from './lib/balance.js';
import {
  initMysql,
  mysqlHealthCheck,
  getMysqlPool,
  insertCallLog,
  getCallBillingSummaryByNumber,
  getIprnPanelTelemetry,
  isMysqlEnabled,
  isMysqlNumbersReady,
} from './lib/mysql.js';
import { validateAndNormalizeCallLog } from './lib/call-log-ingest.js';
import * as numbersService from './lib/numbers-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Load dashboard/.env if present (keys only when not already set — systemd wins). */
function loadDashboardDotEnv() {
  try {
    const envPath = join(__dirname, '.env');
    if (!existsSync(envPath)) return;
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}
loadDashboardDotEnv();

function envTruthy(name) {
  return /^(1|true|yes|on)$/i.test(String(process.env[name] || ''));
}

const execAsync = promisify(exec);
const PUBLIC_DIR = join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const store = new Store();

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function q(s) {
  return `"${String(s).replace(/(["\\$`])/g, '\\$1')}"`;
}

async function transcodeToTelephonyWav(inputPath, outputPath) {
  const ffmpegCmd = `ffmpeg -y -i ${q(inputPath)} -ar 8000 -ac 1 -c:a pcm_s16le ${q(outputPath)}`;
  try {
    await execAsync(ffmpegCmd);
    return;
  } catch {
    // Fallback for environments without ffmpeg.
    const soxCmd = `sox ${q(inputPath)} -r 8000 -c 1 ${q(outputPath)}`;
    await execAsync(soxCmd);
  }
}

async function buildTelephonyVariants(wavPath, stemPath) {
  // Best effort: these variants increase playback compatibility with SIP codecs.
  try { await execAsync(`sox ${q(wavPath)} -t ul ${q(`${stemPath}.ulaw`)}`); } catch {}
  try { await execAsync(`sox ${q(wavPath)} -t al ${q(`${stemPath}.alaw`)}`); } catch {}
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  // Login page is always accessible
  if (urlPath === '/login' || urlPath === '/login.html') {
    const loginPath = join(PUBLIC_DIR, 'login.html');
    if (existsSync(loginPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(loginPath));
      return;
    }
  }

  // Check auth for all other pages
  const cookies = parseCookie(req.headers.cookie);
  if (!validateSession(cookies.session)) {
    res.writeHead(302, { 'Location': '/login' });
    res.end();
    return;
  }

  let filePath = join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!existsSync(filePath)) {
    filePath = join(PUBLIC_DIR, 'index.html');
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const stat = statSync(filePath);
  if (stat.isDirectory()) filePath = join(filePath, 'index.html');
  if (!existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }

  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  res.end(readFileSync(filePath));
}

const CONF_SRC = process.env.ASTERISK_CONF_DIR || join(__dirname, '..', 'asterisk');
/** Files Asterisk loads after Apply (same paths deploy uses). */
const LIVE_AST_PREVIEW_FILES = [
  ['extensions.conf', 'extensionsConf'],
  ['pjsip.conf', 'pjsipConf'],
  ['acl.conf', 'aclConf'],
  ['rtp.conf', 'rtpConf'],
  ['func_odbc.conf', 'funcOdbcConf'],
];

function readLiveAsteriskPreviewPayload() {
  const dir = '/etc/asterisk';
  const out = {
    ok: true,
    source: 'live',
    livePath: dir,
    extensionsConf: '',
    pjsipConf: '',
    aclConf: '',
    rtpConf: '',
    funcOdbcConf: '',
    liveReadErrors: /** @type {string[]} */ ([]),
  };
  for (const [filename, key] of LIVE_AST_PREVIEW_FILES) {
    const fp = join(dir, filename);
    try {
      if (existsSync(fp) && statSync(fp).isFile()) {
        out[key] = readFileSync(fp, 'utf8');
      } else {
        out.liveReadErrors.push(`${filename}: not found`);
      }
    } catch (e) {
      out.liveReadErrors.push(`${filename}: ${String(e?.message || e)}`);
    }
  }
  return out;
}

async function deployConfigs() {
  const configs = await writeConfigs(store, numbersService.getNumbers);
  try {
    await execAsync(`sudo cp ${join(CONF_SRC, 'pjsip.conf')} /etc/asterisk/pjsip.conf`);
    await execAsync(`sudo cp ${join(CONF_SRC, 'extensions.conf')} /etc/asterisk/extensions.conf`);
    await execAsync(`sudo cp ${join(CONF_SRC, 'acl.conf')} /etc/asterisk/acl.conf`);
    await execAsync(`sudo cp ${join(CONF_SRC, 'rtp.conf')} /etc/asterisk/rtp.conf`);
    await execAsync(`sudo cp ${join(CONF_SRC, 'func_odbc.conf')} /etc/asterisk/func_odbc.conf`);
    const reload = await asterisk.reloadAll();
    return { ok: true, reload, message: 'Configs deployed and Asterisk reloaded' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  try {
    // Auth endpoints (no auth required)
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      let token = authenticate(body.username, body.password, () => store.getAdminUsers());
      let portal = 'panel';
      let tenantExtra = null;
      if (!token && getMysqlPool()) {
        const row = await tenant.verifyTenantLogin(getMysqlPool(), body.username, body.password);
        if (row) {
          token = createTenantSession(row);
          portal = 'tenant';
          tenantExtra = { userId: row.id, role: row.role, parentUserId: row.parent_user_id };
        }
      }
      if (token) {
        let autoApply;
        if (portal === 'panel' && envTruthy('AUTO_APPLY_ASTERISK_ON_LOGIN')) {
          autoApply = await deployConfigs();
        }
        const payload = { ok: true, portal, ...tenantExtra };
        if (autoApply !== undefined) payload.autoApply = autoApply;
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
        });
        return res.end(JSON.stringify(payload));
      }
      return sendJson(res, 401, { ok: false, error: 'Invalid credentials' });
    }
    if (path === '/api/auth/logout' && method === 'POST') {
      const cookies = parseCookie(req.headers.cookie);
      destroySession(cookies.session);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=; Path=/; HttpOnly; Max-Age=0'
      });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const sess = getSession(parseCookie(req.headers.cookie).session);
      if (!sess) {
        return sendJson(res, 200, { ok: true, authenticated: false });
      }
      if (sess.kind === 'panel') {
        return sendJson(res, 200, {
          ok: true,
          authenticated: true,
          portal: 'panel',
          username: sess.username,
          tenantPortalEnabled: isMysqlNumbersReady(),
        });
      }
      return sendJson(res, 200, {
        ok: true,
        authenticated: true,
        portal: 'tenant',
        userId: sess.userId,
        role: sess.role,
        parentUserId: sess.parentUserId,
        username: sess.username,
        tenantPortalEnabled: true,
      });
    }

    // ---- Tenant portal APIs (iprn_users + user_numbers → number_inventory / call_billing) ----
    if (path.startsWith('/api/tenant/')) {
      const cookies = parseCookie(req.headers.cookie);
      const ts = getSession(cookies.session);
      if (!ts || ts.kind !== 'tenant') {
        return sendJson(res, 401, { error: 'Tenant session required' });
      }
      const pool = getMysqlPool();
      if (!pool) {
        return sendJson(res, 503, { error: 'MySQL required for tenant portal' });
      }

      if (path === '/api/tenant/me' && method === 'GET') {
        const u = await tenant.getTenantUserById(pool, ts.userId);
        return sendJson(res, 200, { user: u });
      }

      if (path === '/api/tenant/dashboard' && method === 'GET') {
        const status = await asterisk.getStatus();
        const ch = await asterisk.getChannels();
        const live = await tenant.getTenantLiveCalls(pool, ts, ch);
        const sum = await tenant.getTenantDashboardSummary(pool, ts, { status, tenantLive: live });
        return sendJson(res, 200, { ...sum, liveCallsPreview: live.calls.slice(0, 20) });
      }

      if (path === '/api/tenant/live-calls' && method === 'GET') {
        const ch = await asterisk.getChannels();
        const live = await tenant.getTenantLiveCalls(pool, ts, ch);
        return sendJson(res, 200, live);
      }

      if (path === '/api/tenant/cdr' && method === 'GET') {
        const hours = parseInt(url.searchParams.get('hours'), 10) || 168;
        const limit = parseInt(url.searchParams.get('limit'), 10) || 500;
        const dateFrom = url.searchParams.get('dateFrom') || '';
        const dateTo = url.searchParams.get('dateTo') || '';
        const data = await tenant.getTenantCdrRows(pool, ts, { hours, limit, dateFrom, dateTo });
        return sendJson(res, 200, data);
      }

      if (path === '/api/tenant/numbers' && method === 'GET') {
        const ids = await tenant.effectiveScopedUserIds(pool, ts);
        const rows = await tenant.getNumbersForUsers(pool, ids);
        return sendJson(res, 200, { numbers: rows });
      }

      if (path === '/api/tenant/subusers' && method === 'GET') {
        if (!tenant.isTenantClient(ts)) {
          return sendJson(res, 403, { error: 'Subusers: client or admin role only' });
        }
        const list = await tenant.listSubusers(pool, ts.userId);
        return sendJson(res, 200, { subusers: list });
      }

      if (path === '/api/tenant/subusers' && method === 'POST') {
        if (!tenant.isTenantClient(ts)) {
          return sendJson(res, 403, { error: 'Forbidden' });
        }
        const body = await parseBody(req);
        const r = await tenant.createTenantUser(pool, {
          username: body.username,
          password: body.password,
          role: 'subuser',
          parent_user_id: ts.userId,
          balance: body.balance ?? 0,
        });
        return r.ok ? sendJson(res, 201, r) : sendJson(res, 400, r);
      }

      if (path.startsWith('/api/tenant/subusers/') && method === 'DELETE') {
        const id = path.split('/').pop();
        const sid = parseInt(String(id), 10);
        if (!tenant.isTenantClient(ts)) {
          return sendJson(res, 403, { error: 'Forbidden' });
        }
        const subs = await tenant.listSubusers(pool, ts.userId);
        if (!subs.some((s) => s.id === sid)) {
          return sendJson(res, 404, { error: 'Not found' });
        }
        const u = await tenant.getTenantUserById(pool, sid);
        if (!u || String(u.role).toLowerCase() !== 'subuser') {
          return sendJson(res, 400, { error: 'Not a subuser' });
        }
        const r = await tenant.deleteTenantUser(pool, sid);
        return r.ok ? sendJson(res, 200, r) : sendJson(res, 400, r);
      }

      if (path === '/api/tenant/allocate' && method === 'POST') {
        const body = await parseBody(req);
        const targetUserId = body.userId;
        const number = body.number;
        const check = await tenant.assertCanAssign(pool, ts, targetUserId, number);
        if (!check.ok) return sendJson(res, 403, check);
        const r = await tenant.assignNumberToUser(pool, targetUserId, number);
        return r.ok ? sendJson(res, 200, r) : sendJson(res, 400, r);
      }

      if (path === '/api/tenant/allocate' && method === 'DELETE') {
        const targetUserId = url.searchParams.get('userId');
        const number = url.searchParams.get('number');
        const check = await tenant.assertCanAssign(pool, ts, targetUserId, number);
        if (!check.ok) return sendJson(res, 403, check);
        await tenant.unassignNumber(pool, targetUserId, number);
        return sendJson(res, 200, { ok: true });
      }

      if (path === '/api/tenant/invoices' && method === 'GET') {
        const rows = await tenant.listInvoicesForScope(pool, ts);
        return sendJson(res, 200, { invoices: rows });
      }

      if (path === '/api/tenant/invoices/generate' && method === 'POST') {
        if (!tenant.isTenantClient(ts)) {
          return sendJson(res, 403, { error: 'Only client/admin can generate invoices' });
        }
        const body = await parseBody(req);
        const uid = body.userId != null ? parseInt(String(body.userId), 10) : ts.userId;
        const ids = await tenant.effectiveScopedUserIds(pool, ts);
        if (!ids.includes(uid)) return sendJson(res, 403, { error: 'User out of scope' });
        const ps = String(body.periodStart || '').slice(0, 10);
        const pe = String(body.periodEnd || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ps) || !/^\d{4}-\d{2}-\d{2}$/.test(pe)) {
          return sendJson(res, 400, { error: 'periodStart and periodEnd as YYYY-MM-DD' });
        }
        const r = await tenant.generateInvoice(pool, uid, ps, pe);
        return r.ok ? sendJson(res, 201, r) : sendJson(res, 400, r);
      }

      const invCsv = path.match(/^\/api\/tenant\/invoices\/(\d+)\/csv$/);
      if (invCsv && method === 'GET') {
        const invId = parseInt(String(invCsv[1]), 10);
        const inv = await tenant.getInvoiceById(pool, invId);
        if (!inv) return sendJson(res, 404, { error: 'Not found' });
        const ids = await tenant.effectiveScopedUserIds(pool, ts);
        if (!ids.includes(inv.user_id)) return sendJson(res, 403, { error: 'Forbidden' });
        const row = tenant.invoiceToCsvRow(inv);
        const header = 'id,user_id,amount,period_start,period_end,status,total_calls,total_duration_sec,total_cost\n';
        const line = row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',') + '\n';
        res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8' });
        return res.end(header + line);
      }

      if (path === '/api/tenant/call-generator' && method === 'POST') {
        const body = await parseBody(req);
        const dest = String(body.destination || '').replace(/\D/g, '');
        if (dest.length < 5) {
          return sendJson(res, 400, { ok: false, error: 'destination (digits) required' });
        }
        const u = await tenant.getTenantUserById(pool, ts.userId);
        const bal = Number(u?.balance) || 0;
        if (envTruthy('TENANT_ENFORCE_BALANCE') && bal <= 0) {
          return sendJson(res, 402, { ok: false, error: 'Insufficient balance' });
        }
        const ids = await tenant.effectiveScopedUserIds(pool, ts);
        const assigned = await tenant.getNumbersForUsers(pool, ids);
        const list = assigned.map((a) => String(a.number || '').replace(/\D/g, '')).filter(Boolean);
        if (!list.length) {
          return sendJson(res, 403, { ok: false, error: 'No assigned numbers — ask your administrator to allocate DIDs' });
        }
        const fromNum = body.fromNumber
          ? String(body.fromNumber).replace(/\D/g, '')
          : list.length === 1
            ? list[0]
            : '';
        if (list.length > 1 && !fromNum) {
          return sendJson(res, 400, { ok: false, error: 'fromNumber required when you have multiple assigned DIDs' });
        }
        if (list.length && fromNum && !list.includes(fromNum)) {
          return sendJson(res, 403, { ok: false, error: 'fromNumber must be one of your assigned numbers' });
        }
        const orig = await asterisk.originateFromEnv({ DEST: dest, FROM: fromNum || '' });
        return sendJson(res, orig.ok ? 200 : 500, {
          ok: orig.ok,
          balance: bal,
          warning: bal < 1 ? 'Low balance' : null,
          ...orig,
        });
      }

      return sendJson(res, 404, { error: 'Tenant API not found' });
    }

    // Auth check for all other API endpoints (panel)
    const cookies = parseCookie(req.headers.cookie);
    const panelSess = getSession(cookies.session);
    if (!panelSess) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    if (panelSess.kind === 'tenant') {
      return sendJson(res, 403, { error: 'Tenant sessions cannot use the operator API' });
    }

    // Call stats
    if (path === '/api/call-stats' && method === 'GET') {
      const hours = parseInt(url.searchParams.get('hours')) || 24;
      return sendJson(res, 200, getCdrStats(hours));
    }
    if (path === '/api/cdr-history' && method === 'GET') {
      const hours = parseInt(url.searchParams.get('hours'), 10) || 168;
      const limit = parseInt(url.searchParams.get('limit'), 10) || 500;
      const dateFrom = url.searchParams.get('dateFrom') || '';
      const dateTo = url.searchParams.get('dateTo') || '';
      const opts = {};
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) opts.dateFrom = dateFrom;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) opts.dateTo = dateTo;
      return sendJson(res, 200, getCdrHistory(hours, limit, opts));
    }

    if (path === '/api/call-logs' && method === 'POST') {
      if (!getMysqlPool()) {
        return sendJson(res, 503, {
          ok: false,
          code: 'MYSQL_UNAVAILABLE',
          error: 'Call log storage requires MySQL (MYSQL_ENABLED=1 and a successful DB connection)',
        });
      }
      const body = await parseBody(req);
      const v = validateAndNormalizeCallLog(body);
      if (!v.ok) {
        return sendJson(res, v.status, { ok: false, code: v.code, error: v.error });
      }
      const ins = await insertCallLog(v.value);
      if (ins.skipped) {
        return sendJson(res, 503, { ok: false, code: 'MYSQL_UNAVAILABLE', error: ins.error || 'MySQL pool unavailable' });
      }
      if (!ins.ok) {
        return sendJson(res, 500, { ok: false, code: 'INSERT_FAILED', error: ins.error });
      }
      return sendJson(res, 201, { ok: true, id: ins.id });
    }

    // SIP Invites
    if (path === '/api/sip-invites' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit')) || 100;
      return sendJson(res, 200, getRecentInvites(limit));
    }

    // Status endpoints
    if (path === '/api/status' && method === 'GET') {
      return sendJson(res, 200, await asterisk.getStatus());
    }
    if (path === '/api/channels' && method === 'GET') {
      return sendJson(res, 200, await asterisk.getChannels());
    }
    if (path === '/api/modules' && method === 'GET') {
      return sendJson(res, 200, await asterisk.getLoadedModules());
    }

    // Suppliers
    if (path === '/api/suppliers' && method === 'GET') {
      return sendJson(res, 200, store.getSuppliers());
    }
    if (path === '/api/suppliers' && method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, store.addSupplier(body));
    }
    if (path.startsWith('/api/suppliers/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updated = store.updateSupplier(id, body);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path.startsWith('/api/suppliers/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return store.deleteSupplier(id) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Not found' });
    }

    // Panel admins (db.json); DASH_USER / DASH_PASS always valid via env
    if (path.startsWith('/api/admin/users')) {
      const segs = path.split('/').filter(Boolean);
      const envUser = (process.env.DASH_USER || 'admin').trim();
      if (segs.length === 3 && method === 'GET') {
        return sendJson(res, 200, {
          users: store.listAdminUsernames(),
          envUsername: envUser,
        });
      }
      if (segs.length === 3 && method === 'POST') {
        const body = await parseBody(req);
        const r = store.addAdminUser(body.username, body.password);
        return r.ok ? sendJson(res, 201, { ok: true }) : sendJson(res, 400, { ok: false, error: r.error });
      }
      if (segs.length === 4 && method === 'DELETE') {
        const username = decodeURIComponent(segs[3]);
        const r = store.removeAdminUser(username);
        return r.ok ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { ok: false, error: r.error });
      }
      if (segs.length === 5 && segs[4] === 'password' && method === 'PUT') {
        const username = decodeURIComponent(segs[3]);
        const body = await parseBody(req);
        const r = store.updateAdminPassword(username, body.password);
        return r.ok ? sendJson(res, 200, { ok: true }) : sendJson(res, 400, { ok: false, error: r.error });
      }
      return sendJson(res, 404, { error: 'Not found' });
    }

    // Numbers
    if (path === '/api/numbers' && method === 'GET') {
      return sendJson(res, 200, await numbersService.getNumbers(store));
    }
    if (path === '/api/numbers/test-route' && method === 'GET') {
      const rawDid = String(url.searchParams.get('did') || '');
      const sourceIp = String(url.searchParams.get('sourceIp') || '').trim();
      let did = rawDid.replace(/[^\d]/g, '');
      if (did.startsWith('00')) did = did.substring(2);
      if (!did) return sendJson(res, 400, { ok: false, error: 'DID is required' });

      const numbers = await numbersService.getNumbers(store);
      const suppliers = store.getSuppliers();
      const ivrMenus = store.getIvrMenus();
      const globals = store.getGlobals();
      const fallbackIvrId = String(globals?.fallbackIvrId || '1');
      const fallbackIvr = ivrMenus.find(i => i.id === fallbackIvrId) || { id: '1', name: 'IVR 1' };

      const toDid = (n) => `${n.countryCode || ''}${n.prefix || ''}${n.extension || ''}`;
      const toPrefix = (n) => `${n.countryCode || ''}${n.prefix || ''}`;

      const exact = numbers.find(n => toDid(n) === did) || null;
      let matched = exact;
      let matchType = 'exact';

      if (!matched) {
        const candidates = numbers.filter(n => did.startsWith(toPrefix(n)));
        candidates.sort((a, b) => toPrefix(b).length - toPrefix(a).length);
        matched = candidates[0] || null;
        matchType = matched ? 'prefix' : 'fallback';
      }

      const routeIvrId = matched?.destinationId || fallbackIvr.id;
      const routeIvr = ivrMenus.find(i => i.id === routeIvrId) || fallbackIvr;
      const routeSupplier = matched?.supplierId ? (suppliers.find(s => s.id === matched.supplierId) || null) : null;
      const sourceSupplier = sourceIp ? (suppliers.find(s => (s.ips || []).includes(sourceIp)) || null) : null;

      return sendJson(res, 200, {
        ok: true,
        did,
        normalizedDid: did,
        matchType,
        matchedNumber: matched ? {
          id: matched.id,
          fullNumber: toDid(matched),
          prefix: toPrefix(matched),
          extension: matched.extension,
          supplierId: matched.supplierId || '',
          destinationId: matched.destinationId || ''
        } : null,
        route: {
          ivrId: routeIvr.id,
          ivrName: routeIvr.name,
          isFallback: !matched
        },
        supplier: {
          routeSupplier: routeSupplier ? routeSupplier.name : null,
          sourceSupplier: sourceSupplier ? sourceSupplier.name : null
        }
      });
    }
    if (path === '/api/numbers/upload-csv' && method === 'POST') {
      const supplierId = url.searchParams.get('supplier') || '';
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const content = Buffer.concat(chunks).toString('utf8');
      
      // Extract numbers from CSV: find any 7+ digit sequence in each line
      const rawLines = content.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      const lines = [];
      for (const line of rawLines) {
        // Split by common delimiters and find digit-only fields
        const fields = line.split(/[,;\t|]+/).map(f => f.replace(/["'\s]/g, ''));
        for (const field of fields) {
          if (/^\+?\d{7,}$/.test(field)) {
            lines.push(field.replace(/^\+/, ''));
          }
        }
        // Also try extracting any long digit sequence from the whole line
        if (!fields.some(f => /^\+?\d{7,}$/.test(f.replace(/["'\s]/g, '')))) {
          const match = line.match(/(\d{7,})/);
          if (match) lines.push(match[1]);
        }
      }
      // Deduplicate
      const unique = [...new Set(lines)];
      if (!unique.length) return sendJson(res, 400, { error: 'No valid numbers found. Upload a file with phone numbers (7+ digits).' });
      const result = unique.map(full => {
        // Standard DID routing format: PREFIX + XXX (last 3 digits extension).
        const extLen = full.length > 3 ? 3 : 1;
        const prefix = full.substring(0, Math.max(1, full.length - extLen));
        const extension = full.substring(prefix.length);

        return {
          country: 'XX',
          countryCode: '',
          prefix,
          extension: extension || full,
          rate: '0.01',
          rateCurrency: 'usd',
          paymentTerm: 'weekly',
          supplierId: supplierId,
          destinationType: 'ivr',
          destinationId: '1'
        };
      });

      const detectedByPrefix = {};
      for (const n of result) {
        const key = n.prefix;
        detectedByPrefix[key] = (detectedByPrefix[key] || 0) + 1;
      }
      const detected = Object.entries(detectedByPrefix)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([pfx, count]) => ({ country: 'XX', code: '', prefix: pfx, count }));

      const added = await numbersService.addBulkNumbers(store, result);
      return sendJson(res, 200, {
        ok: true,
        count: added.length,
        detected
      });
    }

    if (path === '/api/numbers/bulk' && method === 'POST') {
      const body = await parseBody(req);
      if (!body.numbers || !Array.isArray(body.numbers)) {
        return sendJson(res, 400, { error: 'numbers array required' });
      }
      const added = await numbersService.addBulkNumbers(store, body.numbers);
      return sendJson(res, 201, { ok: true, count: added.length });
    }
    if (path === '/api/numbers/delete-prefix' && method === 'POST') {
      const body = await parseBody(req);
      const count = await numbersService.deleteNumbersByPrefix(store, body.country, body.countryCode, body.prefix);
      return sendJson(res, 200, { ok: true, deleted: count });
    }
    const numAllocMatch = path.match(/^\/api\/numbers\/([^/]+)\/(assign|release)$/);
    if (numAllocMatch && method === 'POST') {
      const numId = numAllocMatch[1];
      const action = numAllocMatch[2];
      try {
        if (action === 'assign') {
          const body = await parseBody(req);
          const result = await numbersService.assignNumber(store, numId, body);
          if (!result.ok) {
            return sendJson(res, result.status, { error: result.error, code: result.code });
          }
          return sendJson(res, 200, result.number);
        }
        const result = await numbersService.releaseNumber(store, numId);
        if (!result.ok) {
          return sendJson(res, result.status, { error: result.error, code: result.code });
        }
        return sendJson(res, 200, result.number);
      } catch (e) {
        return sendJson(res, 500, { error: e.message || 'Assignment failed', code: 'INTERNAL' });
      }
    }
    if (path === '/api/numbers' && method === 'POST') {
      const body = await parseBody(req);
      const created = await numbersService.addNumber(store, body);
      return sendJson(res, 201, created);
    }
    if (path.startsWith('/api/numbers/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updated = await numbersService.updateNumber(store, id, body);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path.startsWith('/api/numbers/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return (await numbersService.deleteNumber(store, id)) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Not found' });
    }

    // Audio file upload & list
    const SOUNDS_DIR = '/var/lib/asterisk/sounds/custom';
    if (path === '/api/audio-files' && method === 'GET') {
      try {
        if (!existsSync(SOUNDS_DIR)) mkdirSync(SOUNDS_DIR, { recursive: true });
        const files = readdirSync(SOUNDS_DIR).filter(f => /\.(wav|gsm|sln|ulaw|alaw|mp3)$/i.test(f));
        return sendJson(res, 200, files.map(f => ({ name: f, path: `custom/${f.replace(/\.[^.]+$/, '')}` })));
      } catch { return sendJson(res, 200, []); }
    }
    if (path === '/api/audio-upload' && method === 'POST') {
      try {
        if (!existsSync(SOUNDS_DIR)) mkdirSync(SOUNDS_DIR, { recursive: true });
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
          return sendJson(res, 400, { error: 'Use multipart/form-data' });
        }
        const boundary = '--' + contentType.split('boundary=')[1];
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        const parts = buf.toString('binary').split(boundary).filter(p => p.includes('filename='));
        const uploaded = [];
        for (const part of parts) {
          const headerEnd = part.indexOf('\r\n\r\n');
          if (headerEnd === -1) continue;
          const headers = part.substring(0, headerEnd);
          const fnMatch = headers.match(/filename="([^"]+)"/);
          if (!fnMatch) continue;
          let filename = fnMatch[1].replace(/[^a-zA-Z0-9._-]/g, '_');
          const body = part.substring(headerEnd + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');
          const inputPath = join(SOUNDS_DIR, filename);
          writeFileSync(inputPath, body, 'binary');

          const ext = extname(filename).toLowerCase();
          const stem = basename(filename, ext);
          const stemPath = join(SOUNDS_DIR, stem);

          // Normalize uploaded media to real telephony WAV so IVR Playback is reliable.
          if (ext === '.mp3' || ext === '.wav') {
            try {
              const tempWavPath = join(SOUNDS_DIR, `${stem}.tmp.wav`);
              await transcodeToTelephonyWav(inputPath, tempWavPath);
              renameSync(tempWavPath, `${stemPath}.wav`);
              await buildTelephonyVariants(`${stemPath}.wav`, stemPath);
              if (ext === '.mp3') {
                try { unlinkSync(inputPath); } catch {}
              }
              uploaded.push(`${stem}.wav`);
            } catch (convErr) {
              throw new Error(`Audio conversion failed for ${filename}. Install ffmpeg and sox on server. Details: ${convErr.message}`);
            }
          } else {
            uploaded.push(filename);
          }
        }
        return sendJson(res, 200, { ok: true, files: uploaded });
      } catch (err) {
        return sendJson(res, 500, { error: err.message });
      }
    }

    // IVR Menus (fixed 10 slots - GET and PUT only)
    if (path === '/api/ivr-menus' && method === 'GET') {
      return sendJson(res, 200, store.getIvrMenus());
    }
    if (path.startsWith('/api/ivr-menus/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updated = store.updateIvrMenu(id, body);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }

    // Trunk Config
    if (path === '/api/trunk-config' && method === 'GET') {
      return sendJson(res, 200, store.getTrunkConfig());
    }
    if (path === '/api/trunk-config' && method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, store.updateTrunkConfig(body));
    }

    // Globals
    if (path === '/api/globals' && method === 'GET') {
      return sendJson(res, 200, store.getGlobals());
    }
    if (path === '/api/globals' && method === 'PUT') {
      const body = await parseBody(req);
      return sendJson(res, 200, store.updateGlobals(body));
    }

    // Weekly balance (UTC Mon–Sun), CDR + number rates + FX multipliers
    if (path === '/api/balance' && method === 'GET') {
      return sendJson(res, 200, await buildBalanceReport(store));
    }
    if (path === '/api/balance' && method === 'PUT') {
      const body = await parseBody(req);
      const cfg = store.updateBalanceConfig({
        eurPerUsd: body.eurPerUsd,
        sarPerUsd: body.sarPerUsd,
      });
      return sendJson(res, 200, { ok: true, config: cfg });
    }

    // Standard config preset
    if (path === '/api/standard-config' && method === 'GET') {
      const globals = store.getGlobals();
      const trunk = store.getTrunkConfig();
      return sendJson(res, 200, {
        dialplanMode: globals?.dialplanMode || 'iprn',
        defaultContext: globals?.defaultContext || 'from-external',
        localExtension: globals?.localExtension || '7001',
        localSecret: globals?.localSecret || 'ChangeMe7001',
        trunk
      });
    }
    if (path === '/api/standard-config/apply' && method === 'POST') {
      return sendJson(res, 200, store.applyStandardDefaults());
    }

    // Apply / Deploy
    if (path === '/api/apply' && method === 'POST') {
      const result = await deployConfigs();
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    // Preview: show what Asterisk actually uses — read /etc/asterisk (no DB). Optional generated fallback.
    if (path === '/api/preview-config' && method === 'GET') {
      const live = readLiveAsteriskPreviewPayload();
      const extLen = String(live.extensionsConf || '').length;
      const pjLen = String(live.pjsipConf || '').length;
      const hasUsefulLive = extLen > 0 || pjLen > 0;
      if (hasUsefulLive || live.liveReadErrors.length === 0) {
        return sendJson(res, 200, live);
      }
      try {
        const gen = await writeConfigs(store, numbersService.getNumbers);
        return sendJson(res, 200, {
          ok: true,
          source: 'generated',
          livePath: '/etc/asterisk',
          liveReadErrors: live.liveReadErrors,
          note: 'Live files missing or empty — showing generated preview from dashboard (not yet deployed).',
          extensionsConf: gen.extensionsConf,
          pjsipConf: gen.pjsipConf,
          aclConf: gen.aclConf,
          rtpConf: gen.rtpConf,
          funcOdbcConf: gen.funcOdbcConf,
        });
      } catch (e) {
        return sendJson(res, 500, {
          ok: false,
          error: String(e?.message || e),
          livePath: '/etc/asterisk',
          liveReadErrors: live.liveReadErrors,
        });
      }
    }

    // Optional MySQL (env-driven; does not replace db.json)
    if (path === '/api/mysql/health' && method === 'GET') {
      return sendJson(res, 200, await mysqlHealthCheck());
    }

    if (path === '/api/app-config' && method === 'GET') {
      return sendJson(res, 200, {
        iprnPlatformUrl: String(process.env.IPRN_PLATFORM_URL || '').trim(),
        tenantPortalEnabled: isMysqlNumbersReady(),
      });
    }

    if (path === '/api/iprn/billing-summary' && method === 'GET') {
      if (!getMysqlPool()) {
        return sendJson(res, 200, { enabled: false, rows: [] });
      }
      const limit = parseInt(url.searchParams.get('limit'), 10) || 500;
      const rows = await getCallBillingSummaryByNumber(limit);
      return sendJson(res, 200, { enabled: true, rows });
    }

    if (path === '/api/iprn/panel-status' && method === 'GET') {
      const telemetry = await getIprnPanelTelemetry();
      const g = store.getGlobals();
      return sendJson(res, 200, {
        ...telemetry,
        odbcRoutingEnabled: Boolean(g?.iprnOdbcRouting),
        mysqlEnabled: isMysqlEnabled(),
        numbersFromDb: isMysqlNumbersReady(),
      });
    }

    if (path === '/api/pjsip/contacts' && method === 'GET') {
      return sendJson(res, 200, await asterisk.getPjsipContactsSummary());
    }

    // Panel: IPRN tenant users (MySQL) — operator-only
    if (path.startsWith('/api/panel/iprn-users')) {
      const pool = getMysqlPool();
      if (!pool) {
        return sendJson(res, 503, { error: 'MySQL required' });
      }
      if (path === '/api/panel/iprn-users' && method === 'GET') {
        return sendJson(res, 200, { users: await tenant.listAllTenantUsers(pool) });
      }
      if (path === '/api/panel/iprn-users' && method === 'POST') {
        const body = await parseBody(req);
        const r = await tenant.createTenantUser(pool, body);
        return r.ok ? sendJson(res, 201, r) : sendJson(res, 400, r);
      }
      const idMatch = path.match(/^\/api\/panel\/iprn-users\/(\d+)$/);
      if (idMatch && method === 'PUT') {
        const r = await tenant.updateTenantUser(pool, idMatch[1], await parseBody(req));
        return r.ok ? sendJson(res, 200, r) : sendJson(res, 400, r);
      }
      if (idMatch && method === 'DELETE') {
        const r = await tenant.deleteTenantUser(pool, idMatch[1]);
        return r.ok ? sendJson(res, 200, r) : sendJson(res, 400, r);
      }
      const assignMatch = path.match(/^\/api\/panel\/iprn-users\/(\d+)\/assign$/);
      if (assignMatch && method === 'POST') {
        const uid = assignMatch[1];
        const ok = await tenant.assertPanelCanAssignTarget(pool, uid);
        if (!ok.ok) return sendJson(res, 400, ok);
        const body = await parseBody(req);
        const r = await tenant.assignNumberToUser(pool, uid, body.number);
        return r.ok ? sendJson(res, 200, r) : sendJson(res, 400, r);
      }
      if (assignMatch && method === 'DELETE') {
        const uid = assignMatch[1];
        const num = url.searchParams.get('number') || '';
        await tenant.unassignNumber(pool, uid, num);
        return sendJson(res, 200, { ok: true });
      }
      const balMatch = path.match(/^\/api\/panel\/iprn-users\/(\d+)\/balance$/);
      if (balMatch && method === 'POST') {
        const body = await parseBody(req);
        const r = await tenant.updateTenantUser(pool, balMatch[1], { balance: body.balance });
        return r.ok ? sendJson(res, 200, r) : sendJson(res, 400, r);
      }
      return sendJson(res, 404, { error: 'Not found' });
    }

    sendJson(res, 404, { error: 'API endpoint not found' });
  } catch (err) {
    sendJson(res, 500, { error: err.message });
  }
}

const server = createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    return handleApi(req, res);
  }
  serveStatic(req, res, req.url);
});

(async () => {
  const m = await initMysql();
  if (m.enabled) {
    console.log(m.schemaOk === false ? `[mysql] ${m.error || 'schema/connection issue'}` : `[mysql] ${m.message || 'ok'}`);
  }
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Asterisk Dashboard running at http://localhost:${PORT}`);
  });
})();
