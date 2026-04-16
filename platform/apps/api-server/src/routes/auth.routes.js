import { authenticateUser } from '../../../../packages/auth/index.js';
import { auditLog } from '../lib/audit.js';

export default async function authRoutes(fastify) {
  fastify.post('/login', async (req, reply) => {
    const { username, password } = req.body || {};
    if (!username || !password) return reply.code(400).send({ error: 'username and password required' });

    const result = await authenticateUser(username, password);
    if (!result) return reply.code(401).send({ error: 'Invalid credentials' });

    await auditLog('login', result.user.id, { ip: req.ip });
    return result;
  });
}
