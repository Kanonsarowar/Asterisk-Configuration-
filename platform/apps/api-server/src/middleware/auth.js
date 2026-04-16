import { verifyToken, loadUserContext } from '../../../../packages/auth/index.js';

const PUBLIC_PATHS = new Set(['/login', '/health']);
const INTERNAL_PREFIX = '/internal/';

export async function authHook(req, reply) {
  if (req.method === 'OPTIONS') return;
  const path = req.url.split('?')[0];

  if (PUBLIC_PATHS.has(path)) return;

  if (path.startsWith(INTERNAL_PREFIX)) {
    const key = req.headers['x-internal-key'];
    if (!process.env.INTERNAL_API_KEY || key !== process.env.INTERNAL_API_KEY) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    return;
  }

  if (!path.startsWith('/api/')) return;

  const auth = req.headers.authorization;
  if (!auth || !/^Bearer\s+/i.test(auth)) {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  try {
    const payload = verifyToken(auth.replace(/^Bearer\s+/i, '').trim());
    req.user = payload;
    const sub = typeof payload.sub === 'string' ? parseInt(payload.sub, 10) : payload.sub;
    if (!Number.isFinite(sub)) return reply.code(401).send({ error: 'Invalid token' });

    const ctx = await loadUserContext(sub);
    if (!ctx) return reply.code(401).send({ error: 'User deactivated' });
    req.userCtx = ctx;
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}
