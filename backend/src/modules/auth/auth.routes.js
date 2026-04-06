import { login } from './auth.service.js';
import { logAudit } from '../../lib/audit.js';
import { requireFields } from '../../lib/validate.js';

export default async function authRoutes(fastify) {
  fastify.post('/auth/login', async (request, reply) => {
    const { username, password } = request.body || {};
    requireFields({ username, password }, ['username', 'password']);

    const result = await login(username, password);
    await logAudit('user.login', result.user.id, 'users', result.user.id, request.ip, null);
    return result;
  });
}
