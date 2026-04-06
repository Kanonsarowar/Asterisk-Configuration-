const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3010';

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
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${API}${path}`, { ...opts, headers });
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
