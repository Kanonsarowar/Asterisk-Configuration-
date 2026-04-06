import jwt from 'jsonwebtoken';
import { loadUserContext } from '../lib/rbac.js';

/** Runs from root preHandler only for `/api/*` paths (see server.js). */
export async function authenticateJwt(req, reply) {
  if (req.method === 'OPTIONS') return;
  const path = req.url.split('?')[0];
  if (path.startsWith('/api/cdr/ingest')) return;
  if (path === '/api/config/sync' && req.method === 'POST') {
    const key = req.headers['x-internal-key'];
    if (process.env.INTERNAL_API_KEY && key === process.env.INTERNAL_API_KEY) return;
  }

  const auth = req.headers.authorization;
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return reply.code(500).send({ error: 'Server misconfigured' });
  }
  try {
    req.user = jwt.verify(token, secret);
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
  const sub = req.user?.sub;
  const id = typeof sub === 'string' ? parseInt(sub, 10) : sub;
  if (!Number.isFinite(id)) {
    return reply.code(401).send({ error: 'Invalid token' });
  }
  const ctx = await loadUserContext(id);
  if (!ctx) return reply.code(401).send({ error: 'User not found' });
  req.userCtx = ctx;
}

export async function internalApiKey(req, reply) {
  const key = req.headers['x-internal-key'];
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected || key !== expected) {
    return reply.code(403).send({ error: 'Forbidden' });
  }
}
