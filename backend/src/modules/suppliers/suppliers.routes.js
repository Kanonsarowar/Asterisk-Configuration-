import { requireRole } from '../auth/auth.hooks.js';
import * as svc from './suppliers.service.js';
import { logAudit } from '../../lib/audit.js';
import { requireFields, sanitizeString, clampInt } from '../../lib/validate.js';

export default async function suppliersRoutes(fastify) {
  const adminOnly = { preHandler: requireRole('admin') };

  fastify.get('/suppliers', adminOnly, async (request) => {
    const { active, limit, offset } = request.query;
    return svc.listSuppliers({
      active: active !== undefined ? active === 'true' || active === '1' : undefined,
      limit: clampInt(limit, 1, 500, 100),
      offset: clampInt(offset, 0, 1e7, 0),
    });
  });

  fastify.get('/suppliers/:id', adminOnly, async (request) => {
    return svc.getSupplier(request.params.id);
  });

  fastify.post('/suppliers', adminOnly, async (request) => {
    const body = request.body || {};
    requireFields(body, ['name', 'host']);
    const supplier = await svc.createSupplier({
      name: sanitizeString(body.name),
      host: sanitizeString(body.host),
      port: body.port,
      username: body.username,
      password: body.password,
      protocol: body.protocol,
      codecs: body.codecs,
      max_channels: body.max_channels,
      cost_per_min: body.cost_per_min,
      active: body.active,
    });
    await logAudit('supplier.create', request.user.sub, 'suppliers', supplier.id, request.ip, { name: supplier.name });
    return supplier;
  });

  fastify.put('/suppliers/:id', adminOnly, async (request) => {
    const supplier = await svc.updateSupplier(request.params.id, request.body || {});
    await logAudit('supplier.update', request.user.sub, 'suppliers', request.params.id, request.ip, request.body);
    return supplier;
  });

  fastify.delete('/suppliers/:id', adminOnly, async (request) => {
    const result = await svc.deleteSupplier(request.params.id);
    await logAudit('supplier.delete', request.user.sub, 'suppliers', request.params.id, request.ip, null);
    return result;
  });
}
