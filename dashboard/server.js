import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

import { Store } from './lib/store.js';
import { writeConfigs } from './lib/config-generator.js';
import * as asterisk from './lib/asterisk.js';
import { authenticate, validateSession, destroySession, parseCookie } from './lib/auth.js';
import { getCdrStats } from './lib/cdr.js';
import { getRecentInvites } from './lib/sip-log.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(exec);
const PUBLIC_DIR = join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const store = new Store();
const analyzerRuns = [];
let analyzerRunSeq = 0;
let currentAnalyzerRun = null;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

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

async function deployConfigs() {
  const configs = writeConfigs(store);
  try {
    await execAsync(`sudo cp ${join(CONF_SRC, 'pjsip.conf')} /etc/asterisk/pjsip.conf`);
    await execAsync(`sudo cp ${join(CONF_SRC, 'extensions.conf')} /etc/asterisk/extensions.conf`);
    await execAsync(`sudo cp ${join(CONF_SRC, 'acl.conf')} /etc/asterisk/acl.conf`);
    const reload = await asterisk.reloadAll();
    return { ok: true, reload, message: 'Configs deployed and Asterisk reloaded' };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function coerceDialDelay(value, fallback = 2000) {
  const parsed = parseInt(value, 10);
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return Math.max(500, Math.min(safe, 15000));
}

function coerceDialMode(value, fallback = 'mobile-sim') {
  const mode = String(value || '').trim();
  return mode === 'asterisk' || mode === 'mobile-sim' ? mode : fallback;
}

function coerceDialPrefixMode(value, fallback = 'plus') {
  const mode = String(value || '').trim();
  return mode === 'double-zero' || mode === 'plus' ? mode : fallback;
}

function getRouteSignal(numberDigits) {
  const match = store.getNumbers().find(n => `${n.countryCode}${n.prefix}${n.extension}` === numberDigits);
  if (!match) {
    return {
      detection: 'IPRN',
      reason: 'No DID route found for this number',
      route: null
    };
  }

  if (match.destinationType === 'ivr') {
    const ivr = store.getIvrMenu(match.destinationId);
    return {
      detection: 'IVR',
      reason: ivr ? `Matched ${ivr.name}${ivr.audioFile ? ' with audio' : ' (audio not set)'}` : 'Matched IVR route',
      route: match
    };
  }

  return {
    detection: 'UNKNOWN',
    reason: `Matched route type ${match.destinationType || 'unknown'}`,
    route: match
  };
}

function getCdrSignal(numberDigits) {
  const stats = getCdrStats(1);
  const hit = (stats.recentCalls || []).find(c =>
    normalizeDigits(c.dst) === numberDigits || normalizeDigits(c.src) === numberDigits
  );
  if (!hit) return null;
  if (hit.disposition === 'ANSWERED' && hit.billsec > 0) {
    return { detection: 'IVR', reason: `CDR answered (${hit.billsec}s)` };
  }
  if (hit.disposition && hit.disposition !== 'ANSWERED') {
    return { detection: 'IPRN', reason: `CDR status ${hit.disposition}` };
  }
  return null;
}

function getSipSignal(numberDigits) {
  const events = getRecentInvites(200);
  const hit = events.find(e => normalizeDigits(e.did) === numberDigits || String(e.raw || '').includes(numberDigits));
  if (!hit) return null;
  if (hit.type === 'BLOCKED') {
    return { detection: 'IPRN', reason: 'SIP event blocked/rejected' };
  }
  if (hit.type === 'INVITE') {
    return { detection: 'UNKNOWN', reason: 'SIP INVITE seen' };
  }
  return null;
}

function summarizeRun(run) {
  return {
    id: run.id,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    total: run.total,
    completed: run.completed,
    settings: run.settings,
    summary: run.summary
  };
}

function recalcRunSummary(run) {
  const summary = { ivrDetected: 0, iprnDetected: 0, unknown: 0, dialFailed: 0 };
  for (const r of run.results || []) {
    if (r.detection === 'IVR') summary.ivrDetected += 1;
    else if (r.detection === 'IPRN') summary.iprnDetected += 1;
    else if (r.detection === 'UNKNOWN') summary.unknown += 1;
    if (r.dialOk === false) summary.dialFailed += 1;
  }
  run.summary = summary;
  run.completed = (run.results || []).filter(r => !!r.completedAt).length;
  run.progress = run.total ? Math.round((run.completed / run.total) * 100) : 100;
}

function sanitizeTestNumberPayload(body) {
  const number = normalizeDigits(body.number);
  if (number.length < 7) return { error: 'Number must contain at least 7 digits' };
  return {
    label: String(body.label || `Test ${number}`).trim().slice(0, 80),
    number,
    enabled: body.enabled !== false,
    notes: String(body.notes || '').trim().slice(0, 240)
  };
}

async function executeAnalyzerRun(run, testNumbers, dialDelayMs) {
  try {
    const savedSettings = store.getAnalyzerSettings();
    const delay = coerceDialDelay(dialDelayMs, savedSettings.dialDelayMs || 2000);
    run.settings = { dialDelayMs: delay };
    run.status = 'running';

    for (let i = 0; i < testNumbers.length; i++) {
      const test = testNumbers[i];
      const numberDigits = normalizeDigits(test.number);
      const routeSignal = getRouteSignal(numberDigits);
      const dial = await asterisk.originateLocalCall(numberDigits, 'from-supplier-ip');
      await sleep(Math.min(delay, 5000));
      const cdrSignal = getCdrSignal(numberDigits);
      const sipSignal = getSipSignal(numberDigits);

      let detection = routeSignal.detection;
      let reason = routeSignal.reason;
      if (cdrSignal && cdrSignal.detection !== 'UNKNOWN') {
        detection = cdrSignal.detection;
        reason = `${reason}; ${cdrSignal.reason}`;
      } else if (sipSignal && sipSignal.detection !== 'UNKNOWN') {
        detection = sipSignal.detection;
        reason = `${reason}; ${sipSignal.reason}`;
      }

      if (!dial.ok && detection === 'UNKNOWN') {
        detection = 'IPRN';
        reason = `${reason}; dial failed`;
      }

      const result = {
        id: `${run.id}-item-${i + 1}`,
        label: test.label,
        number: numberDigits,
        detection,
        reason,
        dialOk: dial.ok,
        dialOutput: dial.ok ? (dial.output || 'Originate queued') : '',
        dialError: dial.ok ? '' : (dial.error || 'Dial command failed'),
        completedAt: new Date().toISOString()
      };

      if (detection === 'IVR') run.summary.ivrDetected += 1;
      else if (detection === 'IPRN') run.summary.iprnDetected += 1;
      else run.summary.unknown += 1;
      if (!dial.ok) run.summary.dialFailed += 1;

      run.results.push(result);
      run.completed = run.results.length;
      run.progress = Math.round((run.completed / run.total) * 100);
      if (i < testNumbers.length - 1) {
        await sleep(delay);
      }
    }

    run.status = 'completed';
    run.completedAt = new Date().toISOString();
  } catch (err) {
    run.status = 'failed';
    run.error = err.message;
    run.completedAt = new Date().toISOString();
  } finally {
    currentAnalyzerRun = null;
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
      const token = authenticate(body.username, body.password);
      if (token) {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Set-Cookie': `session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`
        });
        return res.end(JSON.stringify({ ok: true }));
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

    // Auth check for all other API endpoints
    const cookies = parseCookie(req.headers.cookie);
    if (!validateSession(cookies.session)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    // Call stats
    if (path === '/api/call-stats' && method === 'GET') {
      const hours = parseInt(url.searchParams.get('hours')) || 24;
      return sendJson(res, 200, getCdrStats(hours));
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

    // Numbers
    if (path === '/api/numbers' && method === 'GET') {
      return sendJson(res, 200, store.getNumbers());
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
      
      const DIAL_CODES = [
        { code: 'BD', dial: '880' }, { code: 'TW', dial: '886' }, { code: 'HK', dial: '852' },
        { code: 'MO', dial: '853' }, { code: 'KH', dial: '855' }, { code: 'LA', dial: '856' },
        { code: 'FI', dial: '358' }, { code: 'PT', dial: '351' }, { code: 'IE', dial: '353' },
        { code: 'IS', dial: '354' }, { code: 'LV', dial: '371' }, { code: 'LT', dial: '370' },
        { code: 'EE', dial: '372' }, { code: 'MD', dial: '373' }, { code: 'AM', dial: '374' },
        { code: 'BY', dial: '375' }, { code: 'AD', dial: '376' }, { code: 'MC', dial: '377' },
        { code: 'SM', dial: '378' }, { code: 'UA', dial: '380' }, { code: 'RS', dial: '381' },
        { code: 'ME', dial: '382' }, { code: 'HR', dial: '385' }, { code: 'SI', dial: '386' },
        { code: 'BA', dial: '387' }, { code: 'MK', dial: '389' }, { code: 'CZ', dial: '420' },
        { code: 'SK', dial: '421' }, { code: 'LI', dial: '423' }, { code: 'AT', dial: '43' },
        { code: 'UK', dial: '44' }, { code: 'DK', dial: '45' }, { code: 'SE', dial: '46' },
        { code: 'NO', dial: '47' }, { code: 'PL', dial: '48' }, { code: 'DE', dial: '49' },
        { code: 'PE', dial: '51' }, { code: 'MX', dial: '52' }, { code: 'CU', dial: '53' },
        { code: 'AR', dial: '54' }, { code: 'BR', dial: '55' }, { code: 'CL', dial: '56' },
        { code: 'CO', dial: '57' }, { code: 'VE', dial: '58' }, { code: 'MY', dial: '60' },
        { code: 'AU', dial: '61' }, { code: 'ID', dial: '62' }, { code: 'PH', dial: '63' },
        { code: 'NZ', dial: '64' }, { code: 'SG', dial: '65' }, { code: 'TH', dial: '66' },
        { code: 'JP', dial: '81' }, { code: 'KR', dial: '82' }, { code: 'VN', dial: '84' },
        { code: 'CN', dial: '86' }, { code: 'TR', dial: '90' }, { code: 'IN', dial: '91' },
        { code: 'PK', dial: '92' }, { code: 'AF', dial: '93' }, { code: 'LK', dial: '94' },
        { code: 'MM', dial: '95' }, { code: 'IR', dial: '98' }, { code: 'SS', dial: '211' },
        { code: 'MA', dial: '212' }, { code: 'DZ', dial: '213' }, { code: 'TN', dial: '216' },
        { code: 'LY', dial: '218' }, { code: 'GM', dial: '220' }, { code: 'SN', dial: '221' },
        { code: 'MR', dial: '222' }, { code: 'ML', dial: '223' }, { code: 'GN', dial: '224' },
        { code: 'CI', dial: '225' }, { code: 'BF', dial: '226' }, { code: 'NE', dial: '227' },
        { code: 'TG', dial: '228' }, { code: 'BJ', dial: '229' }, { code: 'MU', dial: '230' },
        { code: 'LR', dial: '231' }, { code: 'SL', dial: '232' }, { code: 'GH', dial: '233' },
        { code: 'NG', dial: '234' }, { code: 'CF', dial: '236' }, { code: 'CM', dial: '237' },
        { code: 'CV', dial: '238' }, { code: 'ST', dial: '239' }, { code: 'GQ', dial: '240' },
        { code: 'GA', dial: '241' }, { code: 'CG', dial: '242' }, { code: 'CD', dial: '243' },
        { code: 'AO', dial: '244' }, { code: 'GW', dial: '245' }, { code: 'SC', dial: '248' },
        { code: 'SD', dial: '249' }, { code: 'RW', dial: '250' }, { code: 'ET', dial: '251' },
        { code: 'SO', dial: '252' }, { code: 'DJ', dial: '253' }, { code: 'KE', dial: '254' },
        { code: 'TZ', dial: '255' }, { code: 'UG', dial: '256' }, { code: 'BI', dial: '257' },
        { code: 'MZ', dial: '258' }, { code: 'ZM', dial: '260' }, { code: 'MG', dial: '261' },
        { code: 'ZW', dial: '263' }, { code: 'NA', dial: '264' }, { code: 'MW', dial: '265' },
        { code: 'LS', dial: '266' }, { code: 'BW', dial: '267' }, { code: 'SZ', dial: '268' },
        { code: 'KM', dial: '269' }, { code: 'ZA', dial: '27' }, { code: 'ER', dial: '291' },
        { code: 'AE', dial: '971' }, { code: 'IL', dial: '972' }, { code: 'BH', dial: '973' },
        { code: 'QA', dial: '974' }, { code: 'BT', dial: '975' }, { code: 'MN', dial: '976' },
        { code: 'NP', dial: '977' }, { code: 'SA', dial: '966' }, { code: 'YE', dial: '967' },
        { code: 'OM', dial: '968' }, { code: 'IQ', dial: '964' }, { code: 'KW', dial: '965' },
        { code: 'JO', dial: '962' }, { code: 'SY', dial: '963' }, { code: 'LB', dial: '961' },
        { code: 'EG', dial: '20' }, { code: 'US', dial: '1' }, { code: 'CA', dial: '1' },
        { code: 'RU', dial: '7' }, { code: 'KZ', dial: '7' }, { code: 'FR', dial: '33' },
        { code: 'ES', dial: '34' }, { code: 'IT', dial: '39' }, { code: 'RO', dial: '40' },
        { code: 'CH', dial: '41' }, { code: 'NL', dial: '31' }, { code: 'BE', dial: '32' },
        { code: 'GR', dial: '30' }, { code: 'HU', dial: '36' }, { code: 'BG', dial: '359' },
        { code: 'AL', dial: '355' }, { code: 'GE', dial: '995' }, { code: 'AZ', dial: '994' },
        { code: 'TM', dial: '993' }, { code: 'TJ', dial: '992' }, { code: 'KG', dial: '996' },
        { code: 'UZ', dial: '998' },
      ];
      DIAL_CODES.sort((a, b) => b.dial.length - a.dial.length);

      function detectCountry(num) {
        for (const c of DIAL_CODES) {
          if (num.startsWith(c.dial)) {
            const rest = num.substring(c.dial.length);
            return { country: c.code, countryCode: c.dial, rest };
          }
        }
        return { country: 'XX', countryCode: '', rest: num };
      }

      const detected = unique.map(num => {
        const d = detectCountry(num);
        return { ...d, fullNumber: num };
      });

      const groups = {};
      for (const d of detected) {
        const key = d.country + '-' + d.countryCode;
        if (!groups[key]) groups[key] = { country: d.country, countryCode: d.countryCode, numbers: [] };
        groups[key].numbers.push(d.rest);
      }

      const result = [];
      for (const g of Object.values(groups)) {
        let prefix = '';
        if (g.numbers.length > 1) {
          const sorted = g.numbers.sort();
          const first = sorted[0];
          const last = sorted[sorted.length - 1];
          let i = 0;
          while (i < first.length && i < last.length && first[i] === last[i]) i++;
          prefix = first.substring(0, Math.max(1, Math.min(i, first.length - 2)));
        } else if (g.numbers.length === 1) {
          prefix = g.numbers[0].substring(0, Math.max(1, Math.floor(g.numbers[0].length / 2)));
        }

        for (const rest of g.numbers) {
          const extension = rest.substring(prefix.length);
          result.push({
            country: g.country,
            countryCode: g.countryCode,
            prefix,
            extension: extension || rest,
            rate: '0.01',
            supplierId: supplierId,
            destinationType: 'ivr',
            destinationId: '1'
          });
        }
      }

      const added = store.addBulkNumbers(result);
      return sendJson(res, 200, { 
        ok: true, 
        count: result.length, 
        detected: Object.values(groups).map(g => ({ country: g.country, code: g.countryCode, count: g.numbers.length }))
      });
    }

    if (path === '/api/numbers/bulk' && method === 'POST') {
      const body = await parseBody(req);
      const added = store.addBulkNumbers(body.numbers);
      return sendJson(res, 201, { ok: true, count: added.length });
    }
    if (path === '/api/numbers/delete-prefix' && method === 'POST') {
      const body = await parseBody(req);
      const count = store.deleteNumbersByPrefix(body.country, body.countryCode, body.prefix);
      return sendJson(res, 200, { ok: true, deleted: count });
    }
    if (path === '/api/numbers' && method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, store.addNumber(body));
    }
    if (path.startsWith('/api/numbers/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updated = store.updateNumber(id, body);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path.startsWith('/api/numbers/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return store.deleteNumber(id) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Not found' });
    }

    // Access Analyzer
    if (path === '/api/access-analyzer/test-numbers' && method === 'GET') {
      return sendJson(res, 200, store.getAnalyzerTestNumbers());
    }
    if (path === '/api/access-analyzer/test-numbers' && method === 'POST') {
      const body = await parseBody(req);
      const payload = sanitizeTestNumberPayload(body);
      if (payload.error) return sendJson(res, 400, { error: payload.error });
      return sendJson(res, 201, store.addAnalyzerTestNumber(payload));
    }
    if (path.startsWith('/api/access-analyzer/test-numbers/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updates = { ...body };
      if ('number' in updates) {
        const parsed = sanitizeTestNumberPayload({ number: updates.number, label: updates.label, notes: updates.notes, enabled: updates.enabled });
        if (parsed.error) return sendJson(res, 400, { error: parsed.error });
        updates.number = parsed.number;
        if ('label' in body) updates.label = parsed.label;
        if ('notes' in body) updates.notes = parsed.notes;
      }
      if ('enabled' in updates) updates.enabled = updates.enabled !== false;
      const updated = store.updateAnalyzerTestNumber(id, updates);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path.startsWith('/api/access-analyzer/test-numbers/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return store.deleteAnalyzerTestNumber(id) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path === '/api/access-analyzer/settings' && method === 'GET') {
      return sendJson(res, 200, store.getAnalyzerSettings());
    }
    if (path === '/api/access-analyzer/settings' && method === 'PUT') {
      const body = await parseBody(req);
      const dialDelayMs = coerceDialDelay(body.dialDelayMs, 2000);
      const current = store.getAnalyzerSettings();
      const dialMode = coerceDialMode(body.dialMode, current.dialMode || 'mobile-sim');
      const dialPrefixMode = coerceDialPrefixMode(body.dialPrefixMode, current.dialPrefixMode || 'plus');
      return sendJson(res, 200, store.updateAnalyzerSettings({ dialDelayMs, dialMode, dialPrefixMode }));
    }
    if (path === '/api/access-analyzer/run' && method === 'POST') {
      if (currentAnalyzerRun && ['running', 'mobile_pending'].includes(currentAnalyzerRun.status)) {
        return sendJson(res, 409, { error: 'Analyzer run already in progress', run: summarizeRun(currentAnalyzerRun) });
      }

      const body = await parseBody(req);
      const analyzerSettings = store.getAnalyzerSettings();
      const mode = coerceDialMode(body.mode, analyzerSettings.dialMode || 'mobile-sim');
      const dialPrefixMode = coerceDialPrefixMode(body.dialPrefixMode, analyzerSettings.dialPrefixMode || 'plus');
      const numberIds = Array.isArray(body.numberIds) ? body.numberIds.map(String) : [];
      const all = store.getAnalyzerTestNumbers();
      const selected = numberIds.length
        ? all.filter(n => numberIds.includes(String(n.id)))
        : all.filter(n => n.enabled !== false);

      if (!selected.length) {
        return sendJson(res, 400, { error: 'No enabled test numbers found' });
      }

      const run = {
        id: `run-${Date.now()}-${++analyzerRunSeq}`,
        status: 'queued',
        mode,
        startedAt: new Date().toISOString(),
        completedAt: null,
        total: selected.length,
        completed: 0,
        progress: 0,
        summary: { ivrDetected: 0, iprnDetected: 0, unknown: 0, dialFailed: 0 },
        settings: {},
        results: []
      };

      currentAnalyzerRun = run;
      analyzerRuns.unshift(run);
      if (analyzerRuns.length > 25) analyzerRuns.length = 25;
      if (mode === 'mobile-sim') {
        run.status = 'mobile_pending';
        run.settings = { dialMode: mode, dialPrefixMode };
        run.results = selected.map((test, idx) => ({
          id: `${run.id}-item-${idx + 1}`,
          label: test.label,
          number: normalizeDigits(test.number),
          detection: 'PENDING',
          reason: 'Pending manual SIM call',
          dialOk: null,
          dialOutput: '',
          dialError: '',
          completedAt: null
        }));
        recalcRunSummary(run);
        return sendJson(res, 202, { ok: true, run });
      }

      executeAnalyzerRun(run, selected, body.dialDelayMs);
      return sendJson(res, 202, { ok: true, run });
    }
    if (path === '/api/access-analyzer/runs/current' && method === 'GET') {
      if (!currentAnalyzerRun) return sendJson(res, 200, null);
      return sendJson(res, 200, currentAnalyzerRun);
    }
    if (path === '/api/access-analyzer/runs' && method === 'GET') {
      const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit')) || 10, 50));
      return sendJson(res, 200, analyzerRuns.slice(0, limit));
    }
    if (path.startsWith('/api/access-analyzer/runs/') && method === 'GET') {
      const id = path.split('/').pop();
      const run = analyzerRuns.find(r => r.id === id);
      return run ? sendJson(res, 200, run) : sendJson(res, 404, { error: 'Not found' });
    }
    const runResultMatch = path.match(/^\/api\/access-analyzer\/runs\/([^/]+)\/results\/([^/]+)$/);
    if (runResultMatch && method === 'PUT') {
      const [, runId, resultId] = runResultMatch;
      const run = analyzerRuns.find(r => r.id === runId);
      if (!run) return sendJson(res, 404, { error: 'Run not found' });
      const result = (run.results || []).find(r => r.id === resultId);
      if (!result) return sendJson(res, 404, { error: 'Result not found' });

      const body = await parseBody(req);
      const detection = ['IVR', 'IPRN', 'UNKNOWN'].includes(body.detection) ? body.detection : 'UNKNOWN';
      result.detection = detection;
      result.reason = String(body.reason || result.reason || '').slice(0, 240);
      result.dialOk = typeof body.dialOk === 'boolean' ? body.dialOk : true;
      result.completedAt = new Date().toISOString();

      recalcRunSummary(run);
      const pending = (run.results || []).some(r => !r.completedAt);
      if (!pending) {
        run.status = 'completed';
        run.completedAt = new Date().toISOString();
        if (currentAnalyzerRun && currentAnalyzerRun.id === run.id) {
          currentAnalyzerRun = null;
        }
      } else if (run.status !== 'running') {
        run.status = 'mobile_pending';
      }

      return sendJson(res, 200, run);
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
          writeFileSync(join(SOUNDS_DIR, filename), body, 'binary');
          uploaded.push(filename);
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

    // Apply / Deploy
    if (path === '/api/apply' && method === 'POST') {
      const result = await deployConfigs();
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    // Preview generated configs
    if (path === '/api/preview-config' && method === 'GET') {
      const configs = writeConfigs(store);
      return sendJson(res, 200, configs);
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Asterisk Dashboard running at http://localhost:${PORT}`);
});
