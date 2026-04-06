import { requireRole } from '../auth/auth.hooks.js';
import * as svc from './users.service.js';
import { logAudit } from '../../lib/audit.js';
import { requireFields, sanitizeString, clampInt, requirePositiveNumber } from '../../lib/validate.js';

export default async function usersRoutes(fastify) {
  const adminOnly = { preHandler: requireRole('admin') };
  const adminReseller = { preHandler: requireRole('admin', 'reseller') };

  fastify.get('/users', adminOnly, async (request) => {
    const { role, status, limit, offset } = request.query;
    return svc.listUsers({
      role, status,
      limit: clampInt(limit, 1, 500, 100),
      offset: clampInt(offset, 0, 1e7, 0),
    });
  });

  fastify.get('/users/:id', adminReseller, async (request) => {
    return svc.getUser(request.params.id);
  });

  fastify.post('/users', adminReseller, async (request) => {
    const body = request.body || {};
    requireFields(body, ['username', 'password']);
    const callerRole = request.user.role;
    const targetRole = body.role || 'user';
    if (callerRole === 'reseller' && targetRole !== 'user') {
      throw { statusCode: 403, message: 'Resellers can only create users' };
    }
    const user = await svc.createUser({
      username: sanitizeString(body.username, 128),
      password: body.password,
      role: targetRole,
      balance: requirePositiveNumber(body.balance ?? 0, 'balance'),
    });
    await logAudit('user.create', request.user.sub, 'users', user.id, request.ip, { username: user.username, role: user.role });
    return user;
  });

  fastify.put('/users/:id', adminOnly, async (request) => {
    const updated = await svc.updateUser(request.params.id, request.body || {});
    await logAudit('user.update', request.user.sub, 'users', request.params.id, request.ip, request.body);
    return updated;
  });

  fastify.post('/users/:id/balance', adminReseller, async (request) => {
    const { amount } = request.body || {};
    if (amount === undefined) throw { statusCode: 400, message: 'amount is required' };
    const updated = await svc.adjustBalance(request.params.id, amount);
    await logAudit('user.balance', request.user.sub, 'users', request.params.id, request.ip, { amount });
    return updated;
  });

  fastify.delete('/users/:id', adminOnly, async (request) => {
    const result = await svc.deleteUser(request.params.id);
    await logAudit('user.delete', request.user.sub, 'users', request.params.id, request.ip, null);
    return result;
  });
}
