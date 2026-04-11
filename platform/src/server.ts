import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import type { Pool } from 'mysql2/promise';
import { initDb, getPool } from './db.js';
import { liveRoutes } from './routes/live.js';
import { routeResolverRoutes } from './routes/route.js';

declare module 'fastify' {
  interface FastifyInstance {
    mysqlPool: Pool | null;
  }
}

function loadDotEnv() {
  const __d = dirname(fileURLToPath(import.meta.url));
  const envPath = join(__d, '..', '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) && process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv();

const app = Fastify({ logger: true });

const db = await initDb();
if (!db.ok) {
  console.error('[carrier-api] DB init failed:', db.error);
}
app.decorate('mysqlPool', getPool());

app.get('/health', async () => ({ status: 'ok' }));

await app.register(liveRoutes);
await app.register(routeResolverRoutes);

const port = parseInt(process.env.CARRIER_PORT || process.env.PORT || '3010', 10) || 3010;
const host = (process.env.CARRIER_HOST || '0.0.0.0').trim();

try {
  await app.listen({ port, host });
  console.log(`[carrier-api] listening http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
