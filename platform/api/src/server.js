import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';

import { authenticateJwt, internalApiKey } from './hooks/authenticate.js';
import loginRoutes from './routes/login.js';
import routeLookupRoutes from './routes/route-lookup.js';
import numbersRoutes from './routes/numbers.routes.js';
import customersRoutes from './routes/customers.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import ivrRoutes from './routes/ivr.routes.js';
import routingRoutes from './routes/routing.routes.js';
import cdrRoutes from './routes/cdr.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, '../../web/public');

const port = parseInt(process.env.PORT || '3010', 10);
if (!process.env.JWT_SECRET) {
  console.error('FATAL: set JWT_SECRET in .env');
  process.exit(1);
}

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true, credentials: true });

// JWT is handled with jsonwebtoken (no @fastify/jwt — avoids duplicate `user` decorator if the plugin loads twice).
fastify.addHook('preHandler', async (req, reply) => {
  if (req.method === 'OPTIONS') return;
  const path = req.url.split('?')[0];
  if (!path.startsWith('/api/')) return;
  return authenticateJwt(req, reply);
});

await fastify.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

await fastify.register(loginRoutes);
await fastify.register(routeLookupRoutes, { preHandler: internalApiKey });

const apiPrefix = { prefix: '/api' };
await fastify.register(numbersRoutes, apiPrefix);
await fastify.register(customersRoutes, apiPrefix);
await fastify.register(suppliersRoutes, apiPrefix);
await fastify.register(ivrRoutes, apiPrefix);
await fastify.register(routingRoutes, apiPrefix);
await fastify.register(cdrRoutes, apiPrefix);
await fastify.register(dashboardRoutes, apiPrefix);

await fastify.register(fastifyStatic, {
  root: webRoot,
  prefix: '/',
});

const indexHtml = join(webRoot, 'index.html');
fastify.setNotFoundHandler((req, reply) => {
  if (req.method === 'GET' && existsSync(indexHtml)) {
    return reply.type('text/html').send(readFileSync(indexHtml, 'utf8'));
  }
  return reply.code(404).send({ error: 'Not found' });
});

try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`IPRN platform API + UI http://0.0.0.0:${port}`);
} catch (e) {
  fastify.log.error(e);
  process.exit(1);
}
