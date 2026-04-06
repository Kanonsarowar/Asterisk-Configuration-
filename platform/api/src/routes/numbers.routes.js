import { query } from '../db.js';
import { digitsOnly, numbersScopeSql, canAccessNumber, canAccessCustomer } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';
import { scheduleAsteriskSync } from '../services/autoSync.js';

function listNumbersQuery(ctx) {
  const { where, params } = numbersScopeSql(ctx);
  return {
    text: `SELECT n.*, c.name AS customer_name, s.name AS supplier_name, i.name AS ivr_name
           FROM numbers n
           LEFT JOIN customers c ON c.id = n.customer_id
           LEFT JOIN suppliers s ON s.id = n.supplier_id
           LEFT JOIN ivr i ON i.id = n.ivr_id
           WHERE ${where}
           ORDER BY COALESCE(n.did, n.range_start)`,
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
    if (ctx.role === 'user') return reply.code(403).send({ error: 'Forbidden' });

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
          rate_per_min: p[4] != null && p[4] !== '' ? parseFloat(p[4]) : 0,
          type: p[5] === 'premium' ? 'premium' : 'non-premium',
        });
      }
    }
    if (!Array.isArray(rows) || !rows.length) {
      return reply.code(400).send({ error: 'rows array or csv required' });
    }

    const provisionedBy = ctx.role === 'reseller' ? ctx.id : body.provisioned_by ?? null;
    let inserted = 0;
    for (const raw of rows) {
      const did = raw.did ? digitsOnly(raw.did) : '';
      const country = String(raw.country || '').slice(0, 8);
      const prefix = String(raw.prefix || '').slice(0, 32);
      const supplierId = raw.supplier_id && Number.isFinite(raw.supplier_id) ? raw.supplier_id : null;
      const rate = Number.isFinite(Number(raw.rate_per_min)) ? Number(raw.rate_per_min) : 0;
      const typ = raw.type === 'premium' ? 'premium' : 'non-premium';
      if (did && did.length >= 7) {
        await query(
          `INSERT INTO numbers (did, prefix, range_start, range_end, country, supplier_id, rate_per_min, type, status, provisioned_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)
           ON DUPLICATE KEY UPDATE
             country = VALUES(country),
             prefix = VALUES(prefix),
             supplier_id = COALESCE(VALUES(supplier_id), supplier_id),
             rate_per_min = VALUES(rate_per_min),
             type = VALUES(type),
             provisioned_by = COALESCE(numbers.provisioned_by, VALUES(provisioned_by))`,
          [did, prefix || did.slice(0, 5), did, did, country, supplierId, rate, typ, provisionedBy]
        );
        inserted++;
      } else if (raw.range_start && raw.range_end) {
        const rs = digitsOnly(raw.range_start);
        const re = digitsOnly(raw.range_end);
        if (rs && re && rs.length >= 5 && re.length >= 5) {
          await query(
            `INSERT INTO numbers (did, prefix, range_start, range_end, country, supplier_id, rate_per_min, type, status, provisioned_by)
             VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, 'available', ?)`,
            [prefix || rs.slice(0, 5), rs, re, country, supplierId, rate, typ, provisionedBy]
          );
          inserted++;
        }
      }
    }
    await auditLog('numbers_import', ctx.id, { count: inserted });
    if (inserted > 0) scheduleAsteriskSync('numbers');
    return { ok: true, imported: inserted };
  });

  fastify.post('/numbers/assign', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'user') return reply.code(403).send({ error: 'Forbidden' });
    const { number_ids: numberIds, customer_id: customerId } = req.body || {};
    if (!Array.isArray(numberIds) || !numberIds.length || !customerId) {
      return reply.code(400).send({ error: 'number_ids and customer_id required' });
    }
    if (!(await canAccessCustomer(ctx, customerId))) {
      return reply.code(403).send({ error: 'Cannot assign to this customer' });
    }
    for (const nid of numberIds) {
      const n = await query('SELECT * FROM numbers WHERE id = ?', [nid]);
      const row = n.rows[0];
      if (!(await canAccessNumber(ctx, row))) return reply.code(403).send({ error: 'Forbidden number' });
      await query(`UPDATE numbers SET customer_id = ?, status = 'assigned', allocation_date = UTC_TIMESTAMP(3) WHERE id = ?`, [
        customerId,
        nid,
      ]);
    }
    await auditLog('numbers_assign', ctx.id, { numberIds, customerId });
    return { ok: true };
  });

  fastify.post('/numbers/update-status', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'user') return reply.code(403).send({ error: 'Forbidden' });
    const { ids, status } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) return reply.code(400).send({ error: 'ids required' });
    const allowed = ['available', 'assigned', 'testing', 'blocked'];
    if (!allowed.includes(status)) return reply.code(400).send({ error: 'invalid status' });
    for (const nid of ids) {
      const n = await query('SELECT * FROM numbers WHERE id = ?', [nid]);
      if (!(await canAccessNumber(ctx, n.rows[0]))) return reply.code(403).send({ error: 'Forbidden' });
      await query('UPDATE numbers SET status = ? WHERE id = ?', [status, nid]);
    }
    await auditLog('numbers_status', ctx.id, { ids, status });
    scheduleAsteriskSync('numbers');
    return { ok: true };
  });

  fastify.put('/numbers/:id', async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'user') return reply.code(403).send({ error: 'Forbidden' });
    const id = parseInt(req.params.id, 10);
    const n = await query('SELECT * FROM numbers WHERE id = ?', [id]);
    const row = n.rows[0];
    if (!(await canAccessNumber(ctx, row))) return reply.code(403).send({ error: 'Forbidden' });
    const b = req.body || {};
    const fields = [];
    const vals = [];
    if (Object.prototype.hasOwnProperty.call(b, 'ivr_id')) {
      fields.push('ivr_id = ?');
      vals.push(b.ivr_id);
    }
    if (Object.prototype.hasOwnProperty.call(b, 'supplier_id')) {
      fields.push('supplier_id = ?');
      vals.push(b.supplier_id);
    }
    if (Object.prototype.hasOwnProperty.call(b, 'rate_per_min')) {
      fields.push('rate_per_min = ?');
      vals.push(b.rate_per_min);
    }
    if (Object.prototype.hasOwnProperty.call(b, 'type')) {
      fields.push('type = ?');
      vals.push(b.type === 'premium' ? 'premium' : 'non-premium');
    }
    if (Object.prototype.hasOwnProperty.call(b, 'prefix')) {
      fields.push('prefix = ?');
      vals.push(String(b.prefix).slice(0, 32));
    }
    if (!fields.length) return row;
    vals.push(id);
    await query(`UPDATE numbers SET ${fields.join(', ')} WHERE id = ?`, vals);
    scheduleAsteriskSync('numbers');
    const r = await query('SELECT * FROM numbers WHERE id = ?', [id]);
    return r.rows[0];
  });

  fastify.post('/numbers', {
    schema: {
      body: {
        type: 'object',
        required: ['range_start', 'range_end'],
        properties: {
          did: { type: 'string' },
          prefix: { type: 'string' },
          range_start: { type: 'string' },
          range_end: { type: 'string' },
          country: { type: 'string' },
          supplier_id: { type: 'integer' },
          rate_per_min: { type: 'number' },
          type: { type: 'string', enum: ['premium', 'non-premium'] },
        },
      },
    },
  }, async (req, reply) => {
    const ctx = req.userCtx;
    if (ctx.role === 'user') return reply.code(403).send({ error: 'Forbidden' });
    const b = req.body;
    const did = b.did ? digitsOnly(b.did) : null;
    const rs = digitsOnly(b.range_start);
    const re = digitsOnly(b.range_end);
    if (!rs || !re) return reply.code(400).send({ error: 'invalid range' });
    const prefix = String(b.prefix || rs.slice(0, 5)).slice(0, 32);
    const country = String(b.country || '').slice(0, 8);
    const supplierId = b.supplier_id ?? null;
    const rate = Number(b.rate_per_min) || 0;
    const typ = b.type === 'premium' ? 'premium' : 'non-premium';
    const provisionedBy = ctx.role === 'reseller' ? ctx.id : null;
    const ins = await query(
      `INSERT INTO numbers (did, prefix, range_start, range_end, country, supplier_id, rate_per_min, type, status, provisioned_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)`,
      [did, prefix, rs, re, country, supplierId, rate, typ, provisionedBy]
    );
    const newId = ins.insertId;
    const r = await query('SELECT * FROM numbers WHERE id = ?', [newId]);
    await auditLog('number_create', ctx.id, { id: newId });
    scheduleAsteriskSync('numbers');
    return r.rows[0];
  });
}
