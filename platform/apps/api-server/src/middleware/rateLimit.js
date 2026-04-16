const windows = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 200;
const BLOCK_MS = 300_000;

export async function rateLimitHook(req, reply) {
  const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '0.0.0.0';
  const key = ip;
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    entry = { start: now, count: 0, blocked: 0 };
    windows.set(key, entry);
  }
  if (entry.blocked > now) {
    reply.header('Retry-After', String(Math.ceil((entry.blocked - now) / 1000)));
    return reply.code(429).send({ error: 'Too many requests' });
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    entry.blocked = now + BLOCK_MS;
    return reply.code(429).send({ error: 'Rate limit exceeded' });
  }
  reply.header('X-RateLimit-Remaining', String(MAX_REQUESTS - entry.count));
}

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [k, v] of windows) {
    if (v.start < cutoff && v.blocked < Date.now()) windows.delete(k);
  }
}, 60_000).unref();
