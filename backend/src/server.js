import { config } from './config.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthCheck, closePool } from './db.js';

import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import suppliersRoutes from './modules/suppliers/suppliers.routes.js';
import numbersRoutes from './modules/numbers/numbers.routes.js';
import routingRoutes from './modules/routing/routing.routes.js';
import cdrRoutes from './modules/cdr/cdr.routes.js';
import billingRoutes from './modules/billing/billing.routes.js';

if (!config.jwt.secret) {
  console.error('FATAL: JWT_SECRET must be set');
  process.exit(1);
}

const fastify = Fastify({
  logger: { level: 'info' },
  trustProxy: true,
});

fastify.setErrorHandler((error, request, reply) => {
  const status = error.statusCode || 500;
  if (status >= 500) fastify.log.error(error);
  reply.code(status).send({
    error: error.message || 'Internal server error',
    ...(error.details ? { details: error.details } : {}),
  });
});

await fastify.register(cors, { origin: true, credentials: true });

await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(usersRoutes, { prefix: '/api' });
await fastify.register(suppliersRoutes, { prefix: '/api' });
await fastify.register(numbersRoutes, { prefix: '/api' });
await fastify.register(routingRoutes, { prefix: '/api' });
await fastify.register(cdrRoutes, { prefix: '/api' });
await fastify.register(billingRoutes, { prefix: '/api' });

fastify.get('/health', async () => {
  const dbOk = await healthCheck().catch(() => false);
  return { status: 'ok', db: dbOk, uptime: process.uptime() };
});

const shutdown = async (signal) => {
  fastify.log.info(`${signal} received — shutting down`);
  await fastify.close();
  await closePool();
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  fastify.log.info(`IPRN Backend API  http://0.0.0.0:${config.port}`);
  fastify.log.info(`Health check      http://0.0.0.0:${config.port}/health`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
