import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { rateLimitHook } from './middleware/rateLimit.js';
import { authHook } from './middleware/auth.js';
import { auditLog } from './lib/audit.js';

import loginRoutes from './routes/auth.routes.js';
import clientRoutes from './routes/clients.routes.js';
import providerRoutes from './routes/providers.routes.js';
import didRoutes from './routes/dids.routes.js';
import routeRoutes from './routes/routes.routes.js';
import sipRoutes from './routes/sip.routes.js';
import cdrRoutes from './routes/cdr.routes.js';
import billingRoutes from './routes/billing.routes.js';
import liveRoutes from './routes/live.routes.js';
import fraudRoutes from './routes/fraud.routes.js';
import userRoutes from './routes/users.routes.js';
import ticketRoutes from './routes/tickets.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import internalRoutes from './routes/internal.routes.js';
import rateCardRoutes from './routes/ratecards.routes.js';

const port = parseInt(process.env.PORT || '3010', 10);
if (!process.env.JWT_SECRET) { console.error('FATAL: JWT_SECRET required'); process.exit(1); }

const app = Fastify({ logger: { level: 'info' } });

await app.register(cors, { origin: true, credentials: true });
await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

app.addHook('onRequest', rateLimitHook);
app.addHook('preHandler', authHook);

await app.register(loginRoutes);
await app.register(internalRoutes);

const api = { prefix: '/api' };
await app.register(clientRoutes, api);
await app.register(providerRoutes, api);
await app.register(didRoutes, api);
await app.register(routeRoutes, api);
await app.register(sipRoutes, api);
await app.register(cdrRoutes, api);
await app.register(billingRoutes, api);
await app.register(liveRoutes, api);
await app.register(fraudRoutes, api);
await app.register(userRoutes, api);
await app.register(ticketRoutes, api);
await app.register(dashboardRoutes, api);
await app.register(rateCardRoutes, api);

app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

try {
  await app.listen({ port, host: '0.0.0.0' });
  console.log(`IPRN API server listening on http://0.0.0.0:${port}`);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
