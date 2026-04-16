import { getLiveCalls, getLiveCallCount } from '../../../../packages/telephony/index.js';

export default async function liveRoutes(fastify) {
  fastify.get('/live/calls', async (req) => {
    const ctx = req.userCtx;
    const clientId = ctx.role === 'client' ? ctx.clientId : null;
    const calls = await getLiveCalls(clientId);
    return { calls, count: calls.length };
  });

  fastify.get('/live/stats', async () => {
    const count = await getLiveCallCount();
    return { active_calls: count };
  });
}
