import { query } from '../db.js';
import { internalApiKey } from '../hooks/authenticate.js';
import { digitsOnly } from '../lib/rbac.js';
import { findNumberForDestination, resolveRouteSuppliers } from '../lib/routingEngine.js';
import { finalizeCdrFinancials } from '../lib/billing.js';

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
          },
        },
      },
    },
    async (req, reply) => {
      const b = req.body;
      const dest = digitsOnly(b.destination);
      const num = await findNumberForDestination(dest);
      const customerId = num?.customer_id ?? null;
      const userRow = customerId
        ? (await query('SELECT user_id FROM customers WHERE id = ?', [customerId])).rows[0]
        : null;
      const userId = userRow?.user_id ?? null;
      const suppliers = await resolveRouteSuppliers(dest, b.cli || '', num);
      const supplierId = b.supplier_id ?? suppliers[0]?.supplier_id ?? num?.supplier_id ?? null;

      try {
        const ins = await query(
          `INSERT INTO cdr (call_id, uniqueid, cli, destination, start_time, answer_time, end_time, duration, disposition, supplier_id, user_id, customer_id, number_id, matched_prefix)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            b.call_id || null,
            b.uniqueid || null,
            b.cli || null,
            dest,
            b.start_time || null,
            b.answer_time || null,
            b.end_time || null,
            b.duration ?? 0,
            b.disposition || null,
            supplierId,
            userId,
            customerId,
            num?.id ?? null,
            num?.prefix || null,
          ]
        );
        const id = ins.insertId;
        await finalizeCdrFinancials(id);
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
