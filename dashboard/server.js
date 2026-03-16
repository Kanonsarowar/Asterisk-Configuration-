import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

import { Store } from './lib/store.js';
import { writeConfigs } from './lib/config-generator.js';
import * as asterisk from './lib/asterisk.js';

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

function serveStatic(res, urlPath) {
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

async function deployConfigs() {
  const configs = writeConfigs(store);
  try {
    await execAsync('sudo cp /workspace/asterisk/pjsip.conf /etc/asterisk/pjsip.conf');
    await execAsync('sudo cp /workspace/asterisk/extensions.conf /etc/asterisk/extensions.conf');
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
  serveStatic(res, req.url);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Asterisk Dashboard running at http://localhost:${PORT}`);
});
