import { verifyToken } from './auth.service.js';
import { unauthorized, forbidden } from '../../lib/errors.js';

export async function authenticate(request, reply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw unauthorized('Missing Authorization header');
  }
  const token = header.slice(7);
  request.user = verifyToken(token);
}

export function requireRole(...roles) {
  return async function (request, reply) {
    await authenticate(request, reply);
    if (!roles.includes(request.user.role)) {
      throw forbidden(`Requires role: ${roles.join(' or ')}`);
    }
  };
}

export function requireAnyAuth(request, reply) {
  return authenticate(request, reply);
}
