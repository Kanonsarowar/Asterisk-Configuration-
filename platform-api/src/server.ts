import Fastify from 'fastify';
import type { Pool } from 'mysql2/promise';
import { loadEnvFromFile } from './lib/env.js';
import { initDb, getPool } from './db.js';
import { liveRoutes } from './routes/live.js';
import { routeResolverRoutes } from './routes/route.js';
import { sendOk } from './lib/api-envelope.js';

loadEnvFromFile();

declare module 'fastify' {
  interface FastifyInstance {
    mysqlPool: Pool | null;
    dbInitError: string | null;
  }
}

const app = Fastify({ logger: true });

const db = await initDb();
if (!db.ok) {
  console.error('[platform-api] DB init failed:', db.error);
}
app.decorate('mysqlPool', getPool());
app.decorate('dbInitError', db.ok ? null : db.error ?? 'unknown');

app.get('/', async (_req, reply) =>
  sendOk(reply, {
    service: 'platform-api',
    endpoints: ['/health', '/ready', '/api/live', '/api/route/:prefix'],
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

const port = parseInt(process.env.CARRIER_PORT || process.env.PORT || '3010', 10) || 3010;
const host = (process.env.CARRIER_HOST || '0.0.0.0').trim();

try {
  await app.listen({ port, host });
  console.log(`[platform-api] listening http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
