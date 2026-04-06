#!/usr/bin/env node
import 'dotenv/config';
import http from 'http';
import { generateAndApply } from './service.js';

async function cmdGenerate() {
  const r = await generateAndApply({ reload: true });
  console.log(JSON.stringify({ ok: true, ...r }, null, 2));
}

async function cmdWatch() {
  const sec = parseInt(process.env.GENERATOR_WATCH_INTERVAL_SEC || '60', 10) || 60;
  console.error(`Watching MySQL; regenerating every ${sec}s (GENERATOR_WATCH_INTERVAL_SEC)`);
  const loop = async () => {
    try {
      await generateAndApply({ reload: true });
      console.error(new Date().toISOString(), 'config generated + reload');
    } catch (e) {
      console.error(new Date().toISOString(), 'error', e.message);
    }
  };
  await loop();
  setInterval(loop, sec * 1000);
}

async function cmdServe() {
  const port = parseInt(process.env.GENERATOR_HTTP_PORT || '3020', 10) || 3020;
  const token = process.env.GENERATOR_HTTP_TOKEN;

  const server = http.createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.url !== '/generate' || req.method !== 'POST') {
      res.writeHead(404);
      res.end();
      return;
    }
    if (token) {
      const h = req.headers.authorization || '';
      const ok = h === `Bearer ${token}` || req.headers['x-generator-token'] === token;
      if (!ok) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }
    try {
      const r = await generateAndApply({ reload: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...r }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });

  server.listen(port, () => {
    console.error(`Generator HTTP on :${port} POST /generate`);
  });
}

const cmd = process.argv[2] || 'generate';
try {
  if (cmd === 'generate') await cmdGenerate();
  else if (cmd === 'watch') await cmdWatch();
  else if (cmd === 'serve') await cmdServe();
  else {
    console.error('Usage: node src/cli.js [generate|watch|serve]');
    process.exit(1);
  }
} catch (e) {
  console.error(e);
  process.exit(1);
}
