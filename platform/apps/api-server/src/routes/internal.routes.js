import { lookupDid } from '../../../../packages/routing/index.js';
import { insertCdr } from '../../../../packages/telephony/index.js';
import { finalizeCdr } from '../../../../packages/billing/index.js';
import { query } from '../../../../packages/database/index.js';

export default async function internalRoutes(fastify) {
  fastify.get('/internal/route/:number', async (req, reply) => {
    const did = await lookupDid(req.params.number);
    if (!did) return reply.code(404).send({ error: 'Number not in service' });
    if (did.client_status !== 'active') return reply.code(403).send({ error: 'Client suspended' });
    return { did };
  });

  fastify.post('/internal/cdr', async (req, reply) => {
    const data = req.body;
    if (!data?.uniqueid) return reply.code(400).send({ error: 'uniqueid required' });

    const existing = await query('SELECT id FROM cdr WHERE uniqueid = ?', [data.uniqueid]);
    if (existing.rows.length) return { id: existing.rows[0].id, duplicate: true };

    const cdrId = await insertCdr(data);

    if (data.disposition === 'ANSWERED' && data.duration > 0) {
      const { rows } = await query('SELECT * FROM cdr WHERE id = ?', [cdrId]);
      if (rows[0]) await finalizeCdr(rows[0]);
    }

    return reply.code(201).send({ id: cdrId });
  });
}
