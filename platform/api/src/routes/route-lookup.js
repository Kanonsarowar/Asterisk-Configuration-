import {
  findNumberForDestination,
  resolveRouteSuppliers,
  checkFraudAndCps,
} from '../lib/routingEngine.js';
import { digitsOnly } from '../lib/rbac.js';

/** Asterisk / AGI — no JWT; X-Internal-Key required */
export default async function routeLookupRoutes(fastify) {
  fastify.get('/route/:number', async (req, reply) => {
    const did = digitsOnly(req.params.number);
    if (!did) return reply.code(400).send({ error: 'Invalid number' });

    const cli = req.headers['x-cli'] || req.query.cli || '';
    const fraud = await checkFraudAndCps(cli);
    if (!fraud.allow) {
      return reply.code(429).send({ error: 'Throttled', reason: fraud.reason });
    }

    const row = await findNumberForDestination(did);
    if (!row) return reply.code(404).send({ error: 'Number not found' });
    if (row.status === 'blocked') return reply.code(403).send({ error: 'Number blocked' });

    const suppliers = await resolveRouteSuppliers(did, cli, row);
    const primary = suppliers[0] || null;

    return {
      did,
      status: row.status,
      type: row.type,
      matched_prefix: row.prefix,
      ivr: row.ivr_id
        ? { id: row.ivr_id, name: row.ivr_name, file: row.ivr_file, language: row.ivr_language }
        : null,
      primarySupplier: primary
        ? {
            id: primary.supplier_id,
            name: primary.name,
            host: primary.host,
            port: primary.port,
            username: primary.username,
            password: primary.password,
            protocol: primary.protocol,
            cost_per_minute: primary.cost_per_minute,
            route_rate: primary.rate,
          }
        : null,
      failoverSuppliers: suppliers.map((s) => ({
        supplier_id: s.supplier_id,
        name: s.name,
        host: s.host,
        port: s.port,
        username: s.username,
        password: s.password,
        protocol: s.protocol,
        cost_per_minute: s.cost_per_minute,
        priority: s.priority,
        rate: s.rate,
      })),
    };
  });
}
