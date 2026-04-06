import { query } from '../db.js';
import { customersScopeSql, requireRoles } from '../lib/rbac.js';
import { auditLog } from '../lib/audit.js';

export default async function customersRoutes(fastify) {
  fastify.get('/customers', async (req) => {
    const ctx = req.userCtx;
    const { where, params } = customersScopeSql(ctx);
    const r = await query(
      `SELECT c.*,
        (SELECT COUNT(*) FROM numbers n WHERE n.customer_id = c.id) AS assigned_numbers
       FROM customers c
       WHERE ${where}
       ORDER BY c.name`,
      params
    );
    return { customers: r.rows };
  });

  fastify.post('/customers', {
    preHandler: [requireRoles('admin', 'reseller')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const { name, user_id: userId, company, contact_info: contactInfo, status } = req.body || {};
    if (!name || !String(name).trim()) return reply.code(400).send({ error: 'name required' });
    const st = status === 'suspended' ? 'suspended' : 'active';
    let resellerUserId = null;
    if (ctx.role === 'reseller') resellerUserId = ctx.id;
    else if (ctx.role === 'admin' && req.body.reseller_user_id != null) {
      resellerUserId = parseInt(req.body.reseller_user_id, 10) || null;
    }
    const contactJson = contactInfo != null ? JSON.stringify(contactInfo) : null;
    const ins = await query(
      `INSERT INTO customers (name, company, contact_info, user_id, reseller_user_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [String(name).trim(), company ? String(company).slice(0, 255) : null, contactJson, userId || null, resellerUserId, st]
    );
    const id = ins.insertId;
    const full = await query('SELECT * FROM customers WHERE id = ?', [id]);
    await auditLog('customer_create', ctx.id, { id });
    return full.rows[0];
  });

  fastify.put('/customers/:id', {
    preHandler: [requireRoles('admin', 'reseller')],
  }, async (req, reply) => {
    const ctx = req.userCtx;
    const id = parseInt(req.params.id, 10);
    const { where, params } = customersScopeSql(ctx);
    const full = await query(`SELECT * FROM customers c WHERE c.id = ? AND (${where})`, [id, ...params]);
    if (!full.rows[0]) return reply.code(404).send({ error: 'Not found' });
    const row = full.rows[0];
    const { name, user_id: userId, company, contact_info: contactInfo, status } = req.body || {};
    const newName = name !== undefined ? String(name).trim() : row.name;
    const newUser = userId !== undefined ? userId : row.user_id;
    const newCompany = company !== undefined ? company : row.company;
    const newContact =
      contactInfo !== undefined ? JSON.stringify(contactInfo) : row.contact_info;
    const newStatus =
      status === 'suspended' || status === 'active' ? status : row.status;
    await query(
      `UPDATE customers SET name = ?, user_id = ?, company = ?, contact_info = ?, status = ? WHERE id = ?`,
      [newName, newUser, newCompany, newContact, newStatus, id]
    );
    const r = await query('SELECT * FROM customers WHERE id = ?', [id]);
    return r.rows[0];
  });
}
