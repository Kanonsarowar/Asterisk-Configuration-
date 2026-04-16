const windows = new Map();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;
const BLOCK_MS = 300_000;

export function rateLimitCheck(ip, endpoint = '*') {
  const key = `${ip}:${endpoint}`;
  const now = Date.now();
  let entry = windows.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, count: 0, blockedUntil: 0 };
    windows.set(key, entry);
  }
  if (entry.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((entry.blockedUntil - now) / 1000) };
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    entry.blockedUntil = now + BLOCK_MS;
    return { allowed: false, retryAfter: Math.ceil(BLOCK_MS / 1000) };
  }
  return { allowed: true, remaining: MAX_REQUESTS - entry.count };
}

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS * 2;
  for (const [k, v] of windows) {
    if (v.windowStart < cutoff && v.blockedUntil < Date.now()) windows.delete(k);
  }
}, 60_000).unref();
