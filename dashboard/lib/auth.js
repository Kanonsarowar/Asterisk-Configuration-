import { createHash, randomBytes } from 'crypto';

const SESSIONS = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_USER = process.env.DASH_USER || 'admin';
const DEFAULT_PASS = process.env.DASH_PASS || 'admin123';

function hashPassword(pass) {
  return createHash('sha256').update(pass).digest('hex');
}

export function authenticate(username, password) {
  if (username === DEFAULT_USER && password === DEFAULT_PASS) {
    const token = randomBytes(32).toString('hex');
    SESSIONS.set(token, { username, created: Date.now() });
    return token;
  }
  return null;
}

export function validateSession(token) {
  if (!token) return false;
  const session = SESSIONS.get(token);
  if (!session) return false;
  if (Date.now() - session.created > SESSION_TTL) {
    SESSIONS.delete(token);
    return false;
  }
  return true;
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
