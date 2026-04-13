import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Pool } from 'mysql2/promise';
import { loadEnvFromFile } from './lib/env.js';
import { initDb, getPool } from './db.js';
import { liveRoutes } from './routes/live.js';
import { routeResolverRoutes } from './routes/route.js';
import { iprvRoutes } from './routes/iprv.js';
import { sendOk } from './lib/api-envelope.js';

loadEnvFromFile();

declare module 'fastify' {
  interface FastifyInstance {
    mysqlPool: Pool | null;
    dbInitError: string | null;
  }
}

const app = Fastify({ logger: true });

const corsOrigins = (process.env.CORS_ORIGIN || 'http://127.0.0.1:3020,http://localhost:3020')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
await app.register(cors, { origin: corsOrigins.length ? corsOrigins : true });

const db = await initDb();
if (!db.ok) {
  console.error('[platform-api] DB init failed:', db.error);
}
app.decorate('mysqlPool', getPool());
app.decorate('dbInitError', db.ok ? null : db.error ?? 'unknown');

app.get('/', async (_req, reply) =>
  sendOk(reply, {
    service: 'Gulf-Premium-Telecom',
    endpoints: [
      '/health',
      '/ready',
      '/api/live',
      '/api/route/:prefix',
      '/api/did/:did/audio',
      '/api/live/calls',
      '/api/stats/summary',
      '/api/finance/summary',
    ],
  })
);

app.get('/health', async () => ({ status: 'ok' }));

app.get('/ready', async () => {
  const pool = app.mysqlPool;
  return {
    success: true,
    data: {
      status: 'ok',
      database: pool ? 'connected' : 'disconnected',
      ...(pool ? {} : { databaseError: app.dbInitError ?? 'not configured' }),
    },
  };
});

await app.register(liveRoutes);
await app.register(routeResolverRoutes);
await app.register(iprvRoutes);

const port = parseInt(process.env.CARRIER_PORT || process.env.PORT || '3010', 10) || 3010;
const host = (process.env.CARRIER_HOST || '0.0.0.0').trim();

try {
  await app.listen({ port, host });
  console.log(`[platform-api] listening http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
