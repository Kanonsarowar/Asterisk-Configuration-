import { query } from '../db.js';
import { digitsOnly } from '../lib/rbac.js';

/** Asterisk / AGI — no JWT; X-Internal-Key required */
export default async function routeLookupRoutes(fastify) {
  fastify.get('/route/:number', async (req, reply) => {
    const did = digitsOnly(req.params.number);
    if (!did) return reply.code(400).send({ error: 'Invalid number' });

    const n = await query(
      `SELECT n.id, n.did, n.status, n.customer_id, n.ivr_id, n.supplier_id, n.sell_rate,
              i.name AS ivr_name, i.audio_file AS ivr_file, i.language AS ivr_language,
              s.name AS supplier_name, s.sip_host, s.sip_username, s.sip_password, s.cost_per_minute
       FROM numbers n
       LEFT JOIN ivr i ON i.id = n.ivr_id
       LEFT JOIN suppliers s ON s.id = n.supplier_id
       WHERE n.did = $1
       LIMIT 1`,
      [did]
    );
    const row = n.rows[0];
    if (!row) return reply.code(404).send({ error: 'Number not found' });
    if (row.status === 'blocked') return reply.code(403).send({ error: 'Number blocked' });

    const routes = await query(
      `SELECT r.priority, s.id AS supplier_id, s.name, s.sip_host, s.sip_username, s.sip_password, s.cost_per_minute
       FROM routes r
       JOIN suppliers s ON s.id = r.supplier_id
       WHERE r.number_id = $1
       ORDER BY r.priority ASC`,
      [row.id]
    );

    const failover = routes.rows.length
      ? routes.rows
      : row.supplier_id
        ? [
            {
              priority: 0,
              supplier_id: row.supplier_id,
              name: row.supplier_name,
              sip_host: row.sip_host,
              sip_username: row.sip_username,
              sip_password: row.sip_password,
              cost_per_minute: row.cost_per_minute,
            },
          ]
        : [];

    return {
      did: row.did,
      status: row.status,
      ivr: row.ivr_id
        ? { id: row.ivr_id, name: row.ivr_name, file: row.ivr_file, language: row.ivr_language }
        : null,
      primarySupplier: row.supplier_id
        ? {
            id: row.supplier_id,
            name: row.supplier_name,
            sip_host: row.sip_host,
            sip_username: row.sip_username,
            sip_password: row.sip_password,
            cost_per_minute: row.cost_per_minute,
          }
        : null,
      failoverSuppliers: failover,
    };
  });
}
