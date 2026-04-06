export class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(msg = 'Resource not found') {
  return new AppError(404, msg);
}

export function badRequest(msg = 'Bad request', details) {
  return new AppError(400, msg, details);
}

export function forbidden(msg = 'Forbidden') {
  return new AppError(403, msg);
}

export function unauthorized(msg = 'Unauthorized') {
  return new AppError(401, msg);
}
