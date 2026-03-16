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

const __dirname = dirname(fileURLToPath(import.meta.url));
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

    // DID Routes
    if (path === '/api/did-routes' && method === 'GET') {
      return sendJson(res, 200, store.getDidRoutes());
    }
    if (path === '/api/did-routes' && method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, store.addDidRoute(body));
    }
    if (path.startsWith('/api/did-routes/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updated = store.updateDidRoute(id, body);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path.startsWith('/api/did-routes/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return store.deleteDidRoute(id) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Not found' });
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

    // IVR Menus
    if (path === '/api/ivr-menus' && method === 'GET') {
      return sendJson(res, 200, store.getIvrMenus());
    }
    if (path === '/api/ivr-menus' && method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, store.addIvrMenu(body));
    }
    if (path.startsWith('/api/ivr-menus/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updated = store.updateIvrMenu(id, body);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path.startsWith('/api/ivr-menus/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return store.deleteIvrMenu(id) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Not found' });
    }

    // Ring Groups
    if (path === '/api/ring-groups' && method === 'GET') {
      return sendJson(res, 200, store.getRingGroups());
    }
    if (path === '/api/ring-groups' && method === 'POST') {
      const body = await parseBody(req);
      return sendJson(res, 201, store.addRingGroup(body));
    }
    if (path.startsWith('/api/ring-groups/') && method === 'PUT') {
      const id = path.split('/').pop();
      const body = await parseBody(req);
      const updated = store.updateRingGroup(id, body);
      return updated ? sendJson(res, 200, updated) : sendJson(res, 404, { error: 'Not found' });
    }
    if (path.startsWith('/api/ring-groups/') && method === 'DELETE') {
      const id = path.split('/').pop();
      return store.deleteRingGroup(id) ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'Not found' });
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
