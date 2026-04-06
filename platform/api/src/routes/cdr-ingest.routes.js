import { internalApiKey } from '../hooks/authenticate.js';
import { insertCdrFromPbx } from '../lib/cdrInsert.js';

/**
 * Internal: insert CDR from ODBC/custom script. Secured with X-Internal-Key.
 */
export default async function cdrIngestRoutes(fastify) {
  fastify.post(
    '/cdr/ingest',
    {
      preHandler: [internalApiKey],
      schema: {
        body: {
          type: 'object',
          required: ['destination'],
          properties: {
            call_id: { type: 'string' },
            uniqueid: { type: 'string' },
            cli: { type: 'string' },
            destination: { type: 'string' },
            start_time: { type: 'string' },
            answer_time: { type: 'string' },
            end_time: { type: 'string' },
            duration: { type: 'integer' },
            disposition: { type: 'string' },
            supplier_id: { type: 'integer' },
            matched_prefix: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const b = req.body;
      try {
        const { id } = await insertCdrFromPbx(b);
        return { id };
      } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') {
          return reply.code(409).send({ error: 'Duplicate call_id' });
        }
        throw e;
      }
    }
  );
}
