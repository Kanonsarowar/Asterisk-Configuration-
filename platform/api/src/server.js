import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

import { authenticateJwt, internalApiKey } from './hooks/authenticate.js';
import loginRoutes from './routes/login.js';
import routeLookupRoutes from './routes/route-lookup.js';
import cdrIngestRoutes from './routes/cdr-ingest.routes.js';
import numbersRoutes from './routes/numbers.routes.js';
import customersRoutes from './routes/customers.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import ivrRoutes from './routes/ivr.routes.js';
import routingRoutes from './routes/routing.routes.js';
import cdrRoutes from './routes/cdr.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import usersRoutes from './routes/users.routes.js';
import billingRoutes from './routes/billing.routes.js';
import liveRoutes from './routes/live.routes.js';
import configRoutes from './routes/config.routes.js';
import { startConfigSyncOutboxPoller } from './services/configSyncService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = parseInt(process.env.PORT || '3010', 10);
if (!process.env.JWT_SECRET) {
  console.error('FATAL: set JWT_SECRET in .env');
  process.exit(1);
}

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true, credentials: true });

fastify.addHook('preHandler', async (req, reply) => {
  if (req.method === 'OPTIONS') return;
  const path = req.url.split('?')[0];
  if (!path.startsWith('/api/')) return;
  return authenticateJwt(req, reply);
});

await fastify.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

await fastify.register(loginRoutes);
await fastify.register(routeLookupRoutes, { preHandler: internalApiKey });
await fastify.register(cdrIngestRoutes, { prefix: '/api' });

const apiPrefix = { prefix: '/api' };
await fastify.register(numbersRoutes, apiPrefix);
await fastify.register(customersRoutes, apiPrefix);
await fastify.register(suppliersRoutes, apiPrefix);
await fastify.register(ivrRoutes, apiPrefix);
await fastify.register(routingRoutes, apiPrefix);
await fastify.register(cdrRoutes, apiPrefix);
await fastify.register(dashboardRoutes, apiPrefix);
await fastify.register(usersRoutes, apiPrefix);
await fastify.register(billingRoutes, apiPrefix);
await fastify.register(liveRoutes, apiPrefix);
await fastify.register(configRoutes, apiPrefix);

try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`IPRN platform API http://0.0.0.0:${port}`);
  startConfigSyncOutboxPoller();
} catch (e) {
  fastify.log.error(e);
  process.exit(1);
}
