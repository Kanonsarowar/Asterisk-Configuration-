import { requireRole, authenticate } from '../auth/auth.hooks.js';
import * as svc from './routing.service.js';
import { logAudit } from '../../lib/audit.js';
import { requireFields, requireDigits, clampInt } from '../../lib/validate.js';

export default async function routingRoutes(fastify) {
  const adminOnly = { preHandler: requireRole('admin') };
  const anyAuth = { preHandler: authenticate };

  fastify.get('/routes', adminOnly, async (request) => {
    const { prefix, supplier_id, active, limit, offset } = request.query;
    return svc.listRoutes({
      prefix, supplier_id,
      active: active !== undefined ? active === 'true' || active === '1' : undefined,
      limit: clampInt(limit, 1, 500, 100),
      offset: clampInt(offset, 0, 1e7, 0),
    });
  });

  fastify.get('/routes/:id', adminOnly, async (request) => {
    return svc.getRoute(request.params.id);
  });

  fastify.post('/routes', adminOnly, async (request) => {
    const body = request.body || {};
    requireFields(body, ['prefix', 'supplier_id']);
    requireDigits(body.prefix, 'prefix');
    const route = await svc.createRoute(body);
    await logAudit('route.create', request.user.sub, 'routes', route.id, request.ip, { prefix: body.prefix });
    return route;
  });

  fastify.put('/routes/:id', adminOnly, async (request) => {
    const body = request.body || {};
    if (body.prefix) requireDigits(body.prefix, 'prefix');
    const route = await svc.updateRoute(request.params.id, body);
    await logAudit('route.update', request.user.sub, 'routes', request.params.id, request.ip, body);
    return route;
  });

  fastify.delete('/routes/:id', adminOnly, async (request) => {
    const result = await svc.deleteRoute(request.params.id);
    await logAudit('route.delete', request.user.sub, 'routes', request.params.id, request.ip, null);
    return result;
  });

  fastify.get('/routes/lookup/:destination', anyAuth, async (request) => {
    const { destination } = request.params;
    requireDigits(destination, 'destination');
    return svc.lookupRoute(destination);
  });
}
