import type { FastifyPluginAsync } from 'fastify';
import type { RowDataPacket } from 'mysql2';

function validatePrefixParam(raw: string): string | null {
  const p = raw.replace(/\D/g, '').slice(0, 32);
  return p.length > 0 ? p : null;
}

/**
 * GET /api/route/:prefix — longest-prefix match against routes.prefix
 */
export const routeResolverRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { prefix: string } }>('/api/route/:prefix', async (req, reply) => {
    const pool = app.mysqlPool;
    if (!pool) {
      return reply.code(503).send({ error: 'Database unavailable' });
    }
    const key = validatePrefixParam(req.params.prefix);
    if (!key) {
      return reply.code(400).send({ error: 'Invalid prefix' });
    }
    try {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT r.\`id\`, r.\`prefix\`, r.\`vendor_id\`, r.\`priority\`, r.\`status\`, r.\`meta\`,
                v.\`name\` AS vendor_name
         FROM \`routes\` r
         LEFT JOIN \`vendors\` v ON v.\`id\` = r.\`vendor_id\`
         WHERE r.\`status\` = 'active'
         ORDER BY CHAR_LENGTH(r.\`prefix\`) DESC`
      );
      const list = rows || [];
      let best: RowDataPacket | null = null;
      for (const r of list) {
        const rp = String(r.prefix || '').replace(/\D/g, '');
        if (key.startsWith(rp) && rp.length > 0) {
          best = r;
          break;
        }
      }
      if (!best) {
        return reply.code(404).send({ error: 'No route for prefix', prefix: key });
      }
      return {
        prefix: key,
        matchedPrefix: String(best.prefix),
        routeId: best.id,
        vendorId: best.vendor_id,
        vendorName: best.vendor_name ?? null,
        priority: best.priority,
        meta: best.meta ?? null,
      };
    } catch (e) {
      app.log.error(e);
      return reply.code(503).send({ error: String((e as Error)?.message || e) });
    }
  });
};
