/**
 * API base URL for fetch().
 *
 * - Prefer same-origin `/api/platform` (Next proxies to Fastify on the server) for tablets/VPS.
 * - If build had NEXT_PUBLIC_API_URL=http://127.0.0.1:3010, the tablet would call itself and
 *   get "Failed to fetch" — we override that at runtime when hostname is not localhost.
 */
export function getApiBase() {
  const pub = process.env.NEXT_PUBLIC_API_URL;
  const trimmed = pub != null ? String(pub).trim() : '';

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalHost =
      host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (trimmed && /127\.0\.0\.1|localhost/i.test(trimmed) && !isLocalHost) {
      return `${window.location.origin}/api/platform`;
    }
    if (trimmed) return trimmed.replace(/\/$/, '');
    return '/api/platform';
  }

  /* SSR — build default */
  if (trimmed) return trimmed.replace(/\/$/, '');
  return '/api/platform';
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('iprn_token');
}

export function setToken(t) {
  localStorage.setItem('iprn_token', t);
}

export function clearToken() {
  localStorage.removeItem('iprn_token');
}

export async function api(path, opts = {}) {
  const base = getApiBase();
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${base}${path}`, { ...opts, headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(data?.error || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}
