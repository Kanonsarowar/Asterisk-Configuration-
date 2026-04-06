import { requireRole } from '../auth/auth.hooks.js';
import * as svc from './numbers.service.js';
import { logAudit } from '../../lib/audit.js';
import { requireFields, requireDigits, clampInt } from '../../lib/validate.js';

export default async function numbersRoutes(fastify) {
  const adminOnly = { preHandler: requireRole('admin') };
  const adminReseller = { preHandler: requireRole('admin', 'reseller') };

  fastify.get('/numbers', adminReseller, async (request) => {
    const { prefix, country, type, status, supplier_id, limit, offset } = request.query;
    return svc.listNumbers({
      prefix, country, type, status, supplier_id,
      limit: clampInt(limit, 1, 1000, 100),
      offset: clampInt(offset, 0, 1e7, 0),
    });
  });

  fastify.get('/numbers/:id', adminReseller, async (request) => {
    return svc.getNumber(request.params.id);
  });

  fastify.post('/numbers', adminOnly, async (request) => {
    const body = request.body || {};
    requireFields(body, ['prefix']);
    requireDigits(body.prefix, 'prefix');
    const num = await svc.createNumber(body);
    await logAudit('number.create', request.user.sub, 'numbers', num.id, request.ip, { prefix: body.prefix });
    return num;
  });

  fastify.post('/numbers/bulk', adminOnly, async (request) => {
    const { numbers } = request.body || {};
    if (!Array.isArray(numbers) || !numbers.length) {
      throw { statusCode: 400, message: 'numbers array is required' };
    }
    for (const n of numbers) {
      requireFields(n, ['prefix']);
      requireDigits(n.prefix, 'prefix');
    }
    const result = await svc.bulkCreateNumbers(numbers);
    await logAudit('number.bulk_create', request.user.sub, 'numbers', null, request.ip, { count: result.inserted });
    return result;
  });

  fastify.put('/numbers/:id', adminOnly, async (request) => {
    const num = await svc.updateNumber(request.params.id, request.body || {});
    await logAudit('number.update', request.user.sub, 'numbers', request.params.id, request.ip, request.body);
    return num;
  });

  fastify.delete('/numbers/:id', adminOnly, async (request) => {
    const result = await svc.deleteNumber(request.params.id);
    await logAudit('number.delete', request.user.sub, 'numbers', request.params.id, request.ip, null);
    return result;
  });
}
