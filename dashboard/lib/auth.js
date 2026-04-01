import { createHash, randomBytes } from 'crypto';

const SESSIONS = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_USER = process.env.DASH_USER || 'admin';
const DEFAULT_PASS = process.env.DASH_PASS || 'admin123';

export function hashPassword(pass) {
  return createHash('sha256').update(String(pass), 'utf8').digest('hex');
}

function createPanelSession(username) {
  const token = randomBytes(32).toString('hex');
  SESSIONS.set(token, { kind: 'panel', username, created: Date.now() });
  return token;
}

/** Tenant portal session (MySQL iprn_users). */
export function createTenantSession(row) {
  const token = randomBytes(32).toString('hex');
  SESSIONS.set(token, {
    kind: 'tenant',
    userId: row.id,
    role: String(row.role || 'user').toLowerCase(),
    parentUserId: row.parent_user_id != null ? row.parent_user_id : null,
    username: row.username,
    created: Date.now(),
  });
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const session = SESSIONS.get(token);
  if (!session) return null;
  if (Date.now() - session.created > SESSION_TTL) {
    SESSIONS.delete(token);
    return null;
  }
  if (!session.kind) {
    return { ...session, kind: 'panel' };
  }
  return session;
}

/**
 * Env user (DASH_USER / DASH_PASS) always works (break-glass).
 * Extra admins from store.getAdminUsers(): [{ username, passwordHash }].
 */
export function authenticate(username, password, getAdminUsers) {
  if (!username || !password) return null;
  const u = String(username).trim();
  const p = String(password);
  if (u === DEFAULT_USER && p === DEFAULT_PASS) {
    return createPanelSession(u);
  }
  const list = typeof getAdminUsers === 'function' ? getAdminUsers() : [];
  if (!Array.isArray(list) || !list.length) return null;
  const h = hashPassword(p);
  for (const row of list) {
    if (row && String(row.username) === u && row.passwordHash === h) {
      return createPanelSession(u);
    }
  }
  return null;
}

export function validateSession(token) {
  return !!getSession(token);
}

export function destroySession(token) {
  SESSIONS.delete(token);
}

export function parseCookie(cookieStr) {
  if (!cookieStr) return {};
  return Object.fromEntries(cookieStr.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  }));
}
