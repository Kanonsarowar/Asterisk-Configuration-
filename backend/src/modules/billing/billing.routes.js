import { requireRole, authenticate } from '../auth/auth.hooks.js';
import * as svc from './billing.service.js';
import { logAudit } from '../../lib/audit.js';
import { requireFields, clampInt } from '../../lib/validate.js';

export default async function billingRoutes(fastify) {
  const adminOnly = { preHandler: requireRole('admin') };
  const anyAuth = { preHandler: authenticate };

  fastify.post('/billing/process-call', adminOnly, async (request) => {
    const body = request.body || {};
    requireFields(body, ['call_id', 'destination', 'start_time', 'duration', 'disposition']);
    const result = await svc.processCall(body);
    return result;
  });

  fastify.get('/invoices', anyAuth, async (request) => {
    const q = request.query;
    const userFilter = request.user.role === 'user' ? { user_id: request.user.sub } : {};
    return svc.listInvoices({
      ...q, ...userFilter,
      limit: clampInt(q.limit, 1, 200, 50),
      offset: clampInt(q.offset, 0, 1e7, 0),
    });
  });

  fastify.get('/invoices/:id', anyAuth, async (request) => {
    const inv = await svc.getInvoice(request.params.id);
    if (request.user.role === 'user' && String(inv.user_id) !== request.user.sub) {
      throw { statusCode: 403, message: 'Forbidden' };
    }
    return inv;
  });

  fastify.post('/invoices/generate', adminOnly, async (request) => {
    const body = request.body || {};
    requireFields(body, ['user_id', 'period_start', 'period_end']);
    const inv = await svc.generateInvoice(body);
    await logAudit('invoice.generate', request.user.sub, 'invoices', inv.id, request.ip, {
      user_id: body.user_id, period: `${body.period_start} to ${body.period_end}`,
    });
    return inv;
  });

  fastify.put('/invoices/:id/status', adminOnly, async (request) => {
    const { status } = request.body || {};
    if (!status) throw { statusCode: 400, message: 'status is required' };
    const inv = await svc.updateInvoiceStatus(request.params.id, status);
    await logAudit('invoice.status', request.user.sub, 'invoices', request.params.id, request.ip, { status });
    return inv;
  });
}
