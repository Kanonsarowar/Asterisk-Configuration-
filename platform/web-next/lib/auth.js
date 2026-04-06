/** Client-side helpers (JWT in localStorage). */

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('iprn_user') || 'null');
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem('iprn_user', JSON.stringify(user));
  else localStorage.removeItem('iprn_user');
}

export function isAdminOrReseller(user) {
  const r = user?.role;
  return r === 'admin' || r === 'reseller';
}

export function isAdmin(user) {
  return user?.role === 'admin';
}
