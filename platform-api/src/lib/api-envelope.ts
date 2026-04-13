import type { FastifyReply } from 'fastify';

export type ApiSuccess<T> = { success: true; data: T };
export type ApiErrorBody = {
  success: false;
  error: { code: string; message: string; details?: Record<string, unknown> };
};

export function sendOk<T>(reply: FastifyReply, data: T, status = 200) {
  return reply.code(status).send({ success: true, data } satisfies ApiSuccess<T>);
}

export function sendErr(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
) {
  const body: ApiErrorBody = { success: false, error: { code, message } };
  if (details && Object.keys(details).length) body.error.details = details;
  return reply.code(status).send(body);
}
