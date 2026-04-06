import { badRequest } from './errors.js';

export function requireFields(body, fields) {
  const missing = fields.filter(f => body[f] === undefined || body[f] === null || body[f] === '');
  if (missing.length) {
    throw badRequest(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function requireDigits(value, fieldName) {
  if (!/^\d+$/.test(String(value))) {
    throw badRequest(`${fieldName} must contain only digits`);
  }
}

export function requirePositiveNumber(value, fieldName) {
  const n = Number(value);
  if (isNaN(n) || n < 0) {
    throw badRequest(`${fieldName} must be a non-negative number`);
  }
  return n;
}

export function clampInt(value, min, max, fallback) {
  const n = parseInt(String(value), 10);
  if (isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function sanitizeString(value, maxLen = 255) {
  return String(value || '').trim().slice(0, maxLen);
}
