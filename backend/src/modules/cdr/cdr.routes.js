import { requireRole, authenticate } from '../auth/auth.hooks.js';
import * as svc from './cdr.service.js';
import { clampInt } from '../../lib/validate.js';

export default async function cdrRoutes(fastify) {
  const adminOnly = { preHandler: requireRole('admin') };
  const anyAuth = { preHandler: authenticate };

  fastify.get('/cdr', anyAuth, async (request) => {
    const q = request.query;
    const userFilter = request.user.role === 'user' ? { user_id: request.user.sub } : {};
    return svc.listCdr({
      ...q, ...userFilter,
      limit: clampInt(q.limit, 1, 1000, 100),
      offset: clampInt(q.offset, 0, 1e7, 0),
    });
  });

  fastify.get('/cdr/export', adminOnly, async (request, reply) => {
    const csv = await svc.getCdrCsv(request.query);
    reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename=cdr_export.csv')
      .send(csv);
  });

  fastify.get('/cdr/summary', adminOnly, async (request) => {
    return svc.getSummary(request.query);
  });

  fastify.get('/cdr/:id', anyAuth, async (request) => {
    const row = await svc.getCdr(request.params.id);
    if (!row) throw { statusCode: 404, message: 'CDR not found' };
    if (request.user.role === 'user' && String(row.user_id) !== request.user.sub) {
      throw { statusCode: 403, message: 'Forbidden' };
    }
    return row;
  });
}
