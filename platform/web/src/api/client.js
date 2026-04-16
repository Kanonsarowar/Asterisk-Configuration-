const BASE = '';

export function getToken() { return localStorage.getItem('iprn_token'); }
export function setToken(t) { localStorage.setItem('iprn_token', t); }
export function clearToken() { localStorage.removeItem('iprn_token'); localStorage.removeItem('iprn_user'); }
export function getUser() { try { return JSON.parse(localStorage.getItem('iprn_user')); } catch { return null; } }
export function setUser(u) { localStorage.setItem('iprn_user', JSON.stringify(u)); }

export async function api(path, opts = {}) {
  const token = getToken();
  const headers = { ...opts.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  if (res.status === 401) { clearToken(); window.location.href = '/login'; return; }
  if (res.status === 429) { throw new Error('Rate limited. Please wait.'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
