import 'dotenv/config';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';

import { authenticateJwt, internalApiKey } from './hooks/authenticate.js';
import { rateLimitCheck } from './lib/rateLimit.js';
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
import carrierRoutes from './routes/carriers.routes.js';
import didInventoryRoutes from './routes/did-inventory.routes.js';
import rateCardRoutes from './routes/rate-cards.routes.js';
import sipEndpointRoutes from './routes/sip-endpoints.routes.js';
import queueRoutes from './routes/queues.routes.js';
import voicemailRoutes from './routes/voicemail.routes.js';
import timeConditionRoutes from './routes/time-conditions.routes.js';
import paymentRoutes from './routes/payments.routes.js';
import recordingRoutes from './routes/recordings.routes.js';
import fraudRoutes from './routes/fraud.routes.js';
import trafficStatsRoutes from './routes/traffic-stats.routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const port = parseInt(process.env.PORT || '3010', 10);
if (!process.env.JWT_SECRET) {
  console.error('FATAL: set JWT_SECRET in .env');
  process.exit(1);
}

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true, credentials: true });

fastify.addHook('onRequest', async (req, reply) => {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '0.0.0.0';
  const rl = rateLimitCheck(ip, req.url.split('?')[0]);
  if (!rl.allowed) {
    reply.header('Retry-After', String(rl.retryAfter));
    return reply.code(429).send({ error: 'Too many requests', retryAfter: rl.retryAfter });
  }
  if (rl.remaining !== undefined) {
    reply.header('X-RateLimit-Remaining', String(rl.remaining));
  }
});

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
await fastify.register(carrierRoutes, apiPrefix);
await fastify.register(didInventoryRoutes, apiPrefix);
await fastify.register(rateCardRoutes, apiPrefix);
await fastify.register(sipEndpointRoutes, apiPrefix);
await fastify.register(queueRoutes, apiPrefix);
await fastify.register(voicemailRoutes, apiPrefix);
await fastify.register(timeConditionRoutes, apiPrefix);
await fastify.register(paymentRoutes, apiPrefix);
await fastify.register(recordingRoutes, apiPrefix);
await fastify.register(fraudRoutes, apiPrefix);
await fastify.register(trafficStatsRoutes, apiPrefix);

try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`IPRN platform API http://0.0.0.0:${port}`);
} catch (e) {
  fastify.log.error(e);
  process.exit(1);
}
