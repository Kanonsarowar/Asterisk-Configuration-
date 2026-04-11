import type { FastifyPluginAsync } from 'fastify';
import type { RowDataPacket } from 'mysql2';

function prefixGroupLen(): number {
  const n = parseInt(process.env.PREFIX_GROUP_LEN || '3', 10);
  if (Number.isNaN(n) || n < 1 || n > 16) return 3;
  return n;
}

function digitsOnly(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

function isAnsweredStatus(status: unknown): boolean {
  const t = String(status ?? '').toLowerCase();
  return ['answered', 'answer', 'completed', 'complete', 'ok'].includes(t);
}

/**
 * GET /api/live — aggregate from call_logs by leading digit prefix of destination.
 */
export const liveRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/live', async (_req, reply) => {
    const pool = app.mysqlPool;
    if (!pool) {
      return reply.code(503).send({ error: 'Database unavailable' });
    }
    const len = prefixGroupLen();
    const maxRows = Math.min(100000, Math.max(1000, parseInt(process.env.LIVE_SAMPLE_ROWS || '50000', 10) || 50000));
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT \`destination\`, \`duration\`, \`status\` FROM \`call_logs\` ORDER BY \`id\` DESC LIMIT ?`,
        [maxRows]
      );
      const agg = new Map<string, { calls: number; answered: number; durSum: number; durCount: number }>();
      for (const r of rows || []) {
        const d = digitsOnly(r.destination);
        if (d.length < len) continue;
        const pfx = d.slice(0, len);
        let g = agg.get(pfx);
        if (!g) {
          g = { calls: 0, answered: 0, durSum: 0, durCount: 0 };
          agg.set(pfx, g);
        }
        g.calls += 1;
        if (isAnsweredStatus(r.status)) g.answered += 1;
        const dur = r.duration != null ? Number(r.duration) : NaN;
        if (Number.isFinite(dur) && dur > 0) {
          g.durSum += dur;
          g.durCount += 1;
        }
      }
      const out = [...agg.entries()]
        .map(([prefix, g]) => {
          const asr = g.calls > 0 ? Math.round((g.answered / g.calls) * 1000) / 10 : 0;
          const acd = g.durCount > 0 ? Math.round((g.durSum / g.durCount) * 10) / 10 : 0;
          return { prefix, calls: g.calls, asr, acd };
        })
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 200);
      return out;
    } catch (e) {
      app.log.error(e);
      return reply.code(503).send({ error: String((e as Error)?.message || e) });
    }
  });
};
