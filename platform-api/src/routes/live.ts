import type { FastifyPluginAsync } from 'fastify';
import type { RowDataPacket } from 'mysql2';
import { sendOk, sendErr } from '../lib/api-envelope.js';

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
      return sendErr(reply, 503, 'DB_UNAVAILABLE', 'Database unavailable', {
        hint: app.dbInitError ?? 'check MYSQL_* in .env',
      });
    }
    const len = prefixGroupLen();
    const maxRows = Math.min(100000, Math.max(1000, parseInt(process.env.LIVE_SAMPLE_ROWS || '50000', 10) || 50000));
    try {
      const [tables] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = 'call_logs'`
      );
      if (!tables?.[0] || Number(tables[0].c) < 1) {
        return sendOk(reply, []);
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT COALESCE(NULLIF(\`destination\`, ''), NULLIF(\`did\`, ''), \`prefix\`) AS dest_key,
                \`duration\`, \`status\`, \`disposition\`
         FROM \`call_logs\` ORDER BY \`id\` DESC LIMIT ?`,
        [maxRows]
      );
      const agg = new Map<string, { calls: number; answered: number; durSum: number; durCount: number }>();
      for (const r of rows || []) {
        const d = digitsOnly((r as RowDataPacket).dest_key ?? r.destination);
        if (d.length < len) continue;
        const pfx = d.slice(0, len);
        let g = agg.get(pfx);
        if (!g) {
          g = { calls: 0, answered: 0, durSum: 0, durCount: 0 };
          agg.set(pfx, g);
        }
        g.calls += 1;
        if (isAnsweredStatus(r.status) || isAnsweredStatus((r as RowDataPacket).disposition)) g.answered += 1;
        const dur = r.duration != null ? Number(r.duration) : NaN;
        if (Number.isFinite(dur) && dur > 0) {
          g.durSum += dur;
          g.durCount += 1;
        }
      }
      const rowsOut = [...agg.entries()]
        .map(([prefix, g]) => {
          const asr = g.calls > 0 ? Math.round((g.answered / g.calls) * 1000) / 10 : 0;
          const acd = g.durCount > 0 ? Math.round((g.durSum / g.durCount) * 10) / 10 : 0;
          return { prefix, calls: g.calls, asr, acd };
        })
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 200);
      /** Phase 1: `data` is the array of `{ prefix, calls, asr, acd }` (envelope wraps it). */
      return sendOk(reply, rowsOut);
    } catch (e) {
      app.log.error(e);
      return sendErr(reply, 503, 'QUERY_FAILED', String((e as Error)?.message || e));
    }
  });
};
