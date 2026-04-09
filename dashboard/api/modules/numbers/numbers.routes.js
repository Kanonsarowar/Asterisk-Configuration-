/**
 * Spec reference: Fastify-style route registration.
 * Actual handlers live in dashboard/server.js under /api/iprn-inventory/*
 * so the same session cookie works for the existing Asterisk dashboard.
 *
 * To mount in a standalone Fastify app with mysql2 pool as fastify.db:
 *
 *   fastify.get('/numbers', async () => { ... same SQL as listIprnRangeNumbers ... });
 */

export default async function registerNumbersRoutes(fastify) {
  fastify.log.warn('numbers.routes.js: use dashboard server /api/iprn-inventory/* or implement mysql2 here');
}
