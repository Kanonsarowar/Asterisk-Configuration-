import { query } from '../db.js';
import { digitsOnly, numbersScopeSql, canAccessNumber, canAccessCustomer } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

function listNumbersQuery(ctx) {
  const { where, params } = numbersScopeSql(ctx);
  return {
    text: `SELECT n.*, c.name AS customer_name, s.name AS supplier_name, i.name AS ivr_name
           FROM numbers n
           LEFT JOIN customers c ON c.id = n.customer_id
           LEFT JOIN suppliers s ON s.id = n.supplier_id
           LEFT JOIN ivr i ON i.id = n.ivr_id
           WHERE ${where}
           ORDER BY n.did`,
    values: params,
  };
}

export default async function numbersRoutes(fastify) {
  fastify.get('/numbers', async (req) => {
    const ctx = req.userCtx;
    const q = listNumbersQuery(ctx);
    const r = await query(q.text, q.values);
    return { numbers: r.rows };
  });

  fastify.post('/numbers/import', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client') return reply.code(403).send({ error: 'Forbidden' });

    const body = req.body || {};
    let rows = body.rows;
    if (!rows && body.csv) {
      const lines = String(body.csv).trim().split(/\r?\n/).filter(Boolean);
      rows = [];
      const start = lines[0]?.toLowerCase().includes('did') ? 1 : 0;
      for (let i = start; i < lines.length; i++) {
        const p = lines[i].split(/[,;\t]/).map((s) => s.trim());
        rows.push({
          did: p[0],
          country: p[1] || '',
          prefix: p[2] || '',
          supplier_id: p[3] ? parseInt(p[3], 10) : null,
          sell_rate: p[4] != null && p[4] !== '' ? parseFloat(p[4]) : 0,
        });
      }
    }
    if (!Array.isArray(rows) || !rows.length) {
      return reply.code(400).send({ error: 'rows array or csv required' });
    }

    const provisionedBy = ctx.role === 'reseller' ? ctx.id : body.provisioned_by ?? null;
    let inserted = 0;
    for (const raw of rows) {
      const did = digitsOnly(raw.did);
      if (!did || did.length < 7) continue;
      const country = String(raw.country || '').slice(0, 8);
      const prefix = String(raw.prefix || '').slice(0, 64);
      const supplierId = raw.supplier_id && Number.isFinite(raw.supplier_id) ? raw.supplier_id : null;
      const sellRate = Number.isFinite(Number(raw.sell_rate)) ? Number(raw.sell_rate) : 0;
      await query(
        `INSERT INTO numbers (did, country, prefix, supplier_id, sell_rate, status, provisioned_by)
         VALUES ($1,$2,$3,$4,$5,'available',$6)
         ON CONFLICT (did) DO UPDATE SET
           country = EXCLUDED.country,
           prefix = EXCLUDED.prefix,
           supplier_id = COALESCE(EXCLUDED.supplier_id, numbers.supplier_id),
           sell_rate = EXCLUDED.sell_rate,
           provisioned_by = COALESCE(numbers.provisioned_by, EXCLUDED.provisioned_by)`,
        [did, country, prefix, supplierId, sellRate, provisionedBy]
      );
      inserted++;
    }
    await auditLog('numbers_import', ctx.id, { count: inserted });
    return { ok: true, imported: inserted };
  });

  fastify.post('/numbers/assign', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client') return reply.code(403).send({ error: 'Forbidden' });
    const { number_ids: numberIds, customer_id: customerId } = req.body || {};
    if (!Array.isArray(numberIds) || !numberIds.length || !customerId) {
      return reply.code(400).send({ error: 'number_ids and customer_id required' });
    }
    if (!(await canAccessCustomer(ctx, customerId))) {
      return reply.code(403).send({ error: 'Cannot assign to this customer' });
    }
    for (const nid of numberIds) {
      const n = await query('SELECT * FROM numbers WHERE id = $1', [nid]);
      const row = n.rows[0];
      if (!(await canAccessNumber(ctx, row))) return reply.code(403).send({ error: 'Forbidden number' });
      await query(
        `UPDATE numbers SET customer_id = $1, status = 'assigned', allocation_date = NOW() WHERE id = $2`,
        [customerId, nid]
      );
    }
    await auditLog('numbers_assign', ctx.id, { numberIds, customerId });
    return { ok: true };
  });

  fastify.post('/numbers/update-status', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client') return reply.code(403).send({ error: 'Forbidden' });
    const { ids, status } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return reply.code(400).send({ error: 'ids required' });
    const allowed = ['available', 'assigned', 'testing', 'blocked'];
    if (!allowed.includes(status)) return reply.code(400).send({ error: 'invalid status' });
    for (const nid of ids) {
      const n = await query('SELECT * FROM numbers WHERE id = $1', [nid]);
      if (!(await canAccessNumber(ctx, n.rows[0]))) return reply.code(403).send({ error: 'Forbidden' });
      await query('UPDATE numbers SET status = $1 WHERE id = $2', [status, nid]);
    }
    await auditLog('numbers_status', ctx.id, { ids, status });
    return { ok: true };
  });

  fastify.put('/numbers/:id', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'client') return reply.code(403).send({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const n = await query('SELECT * FROM numbers WHERE id = $1', [id]);
    const row = n.rows[0];
    if (!(await canAccessNumber(ctx, row))) return reply.code(403).send({ error: 'Forbidden' });
    const b = req.body || {};
    const fields = [];
    const vals = [];
    let i = 1;
    if (Object.prototype.hasOwnProperty.call(b, 'ivr_id')) {
      fields.push(`ivr_id = $${i++}`);
      vals.push(b.ivr_id);
    }
    if (Object.prototype.hasOwnProperty.call(b, 'supplier_id')) {
      fields.push(`supplier_id = $${i++}`);
      vals.push(b.supplier_id);
    }
    if (Object.prototype.hasOwnProperty.call(b, 'sell_rate')) {
      fields.push(`sell_rate = $${i++}`);
      vals.push(b.sell_rate);
    }
    if (!fields.length) return row;
    vals.push(id);
    const r = await query(
      `UPDATE numbers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      vals
    );
    return r.rows[0];
  });
}
