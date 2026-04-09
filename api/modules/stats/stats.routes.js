/**
 * Spec reference: Fastify-style stats routes.
 * The live dashboard implements these under Node `dashboard/server.js` as
 * GET /api/stats/summary | prefix | supplier | failures | cli | pro (bundle).
 * This file is not loaded at runtime unless you wire a separate Fastify app.
 */
export default async function statsRoutesStub(fastify) {
  fastify.log.warn(
    '[stats.routes] Stub only — use Asterisk dashboard server /api/stats/* endpoints'
  );
}
