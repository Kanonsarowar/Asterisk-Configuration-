import type { FastifyPluginAsync } from 'fastify';
import type { RowDataPacket } from 'mysql2';
import { sendOk, sendErr } from '../lib/api-envelope.js';

function digitsOnly(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

/** DID → audio file path (audio-only IVR). */
export const iprvRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { did: string } }>('/api/did/:did/audio', async (req, reply) => {
    const pool = app.mysqlPool;
    if (!pool) return sendErr(reply, 503, 'DB_UNAVAILABLE', 'Database unavailable');
    const did = digitsOnly(req.params.did).slice(0, 64);
    if (!did) return sendErr(reply, 400, 'INVALID_DID', 'DID required');
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT af.\`path\`, af.\`label\`
         FROM \`audio_map\` m
         INNER JOIN \`audio_files\` af ON af.\`id\` = m.\`audio_file_id\`
         WHERE m.\`did\` = ? LIMIT 1`,
        [did]
      );
      const r = rows?.[0];
      if (!r) {
        return sendErr(reply, 404, 'NO_AUDIO', 'No audio_map for this DID', { did });
      }
      return sendOk(reply, { did, audioPath: String(r.path), label: String(r.label || '') });
    } catch (e) {
      app.log.error(e);
      return sendErr(reply, 503, 'QUERY_FAILED', String((e as Error)?.message || e));
    }
  });

  app.get('/api/live/calls', async (_req, reply) => {
    const pool = app.mysqlPool;
    if (!pool) return sendErr(reply, 503, 'DB_UNAVAILABLE', 'Database unavailable');
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT \`uniqueid\`, \`did\`, \`callerid\`, \`caller\`, \`start_time\`, \`duration\`, \`disposition\`
         FROM \`call_logs\`
         WHERE \`end_time\` IS NULL AND (\`disposition\` = 'ONGOING' OR \`disposition\` IS NULL)
         ORDER BY \`id\` DESC LIMIT 100`
      );
      return sendOk(reply, rows || []);
    } catch (e) {
      app.log.error(e);
      return sendErr(reply, 503, 'QUERY_FAILED', String((e as Error)?.message || e));
    }
  });

  app.get('/api/stats/summary', async (_req, reply) => {
    const pool = app.mysqlPool;
    if (!pool) return sendErr(reply, 503, 'DB_UNAVAILABLE', 'Database unavailable');
    try {
      const windowH = Math.min(168, Math.max(1, parseInt(process.env.STATS_WINDOW_HOURS || '24', 10) || 24));
      const [calls] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM \`call_logs\`
         WHERE COALESCE(\`start_time\`, \`created_at\`) >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [windowH]
      );
      const [answered] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM \`call_logs\`
         WHERE COALESCE(\`start_time\`, \`created_at\`) >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND LOWER(COALESCE(\`disposition\`, \`status\`, '')) LIKE '%normal%'`,
        [windowH]
      );
      const [dur] = await pool.query<RowDataPacket[]>(
        `SELECT AVG(\`duration\`) AS acd FROM \`call_logs\`
         WHERE COALESCE(\`start_time\`, \`created_at\`) >= DATE_SUB(NOW(), INTERVAL ? HOUR)
         AND \`duration\` > 0`,
        [windowH]
      );
      const total = Number(calls?.[0]?.c) || 0;
      const ans = Number(answered?.[0]?.c) || 0;
      const asr = total > 0 ? Math.round((ans / total) * 1000) / 10 : 0;
      const acd = dur?.[0]?.acd != null ? Math.round(Number(dur[0].acd) * 10) / 10 : 0;
      const [cpsRow] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) / GREATEST(? * 3600, 1) AS cps FROM \`call_logs\`
         WHERE COALESCE(\`start_time\`, \`created_at\`) >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
        [windowH, windowH]
      );
      const cps = Math.round(Number(cpsRow?.[0]?.cps || 0) * 1000) / 1000;
      return sendOk(reply, { windowHours: windowH, calls: total, asr, acd, cps });
    } catch (e) {
      app.log.error(e);
      return sendErr(reply, 503, 'QUERY_FAILED', String((e as Error)?.message || e));
    }
  });

  app.get('/api/finance/summary', async (_req, reply) => {
    const pool = app.mysqlPool;
    if (!pool) return sendErr(reply, 503, 'DB_UNAVAILABLE', 'Database unavailable');
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT UPPER(COALESCE(\`currency\`, 'USD')) AS currency,
                COALESCE(SUM(\`revenue\`), 0) AS revenue,
                COALESCE(SUM(\`carrier_cost\`), 0) AS carrier_cost,
                COALESCE(SUM(\`profit\`), 0) AS profit
         FROM \`call_logs\`
         WHERE \`end_time\` IS NOT NULL
         GROUP BY UPPER(COALESCE(\`currency\`, 'USD'))`
      );
      return sendOk(reply, rows || []);
    } catch (e) {
      app.log.error(e);
      return sendErr(reply, 503, 'QUERY_FAILED', String((e as Error)?.message || e));
    }
  });
};
