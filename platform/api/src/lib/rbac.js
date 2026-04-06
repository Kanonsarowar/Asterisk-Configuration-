import { query } from '../db.js';

export function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

/** Resolve JWT user + optional customer row for end users */
export async function loadUserContext(userId) {
  const u = await query(
    'SELECT id, username, role, parent_user_id, balance, status FROM users WHERE id = ?',
    [userId]
  );
  const user = u.rows[0];
  if (!user) return null;
  if (user.status === 'suspended') return null;
  let customerId = null;
  if (user.role === 'user') {
    const c = await query('SELECT id FROM customers WHERE user_id = ? LIMIT 1', [userId]);
    customerId = c.rows[0]?.id ?? null;
  }
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    parentUserId: user.parent_user_id,
    balance: user.balance,
    customerId,
  };
}

/** SQL fragment + params for numbers list visibility */
export function numbersScopeSql(ctx) {
  if (ctx.role === 'admin') {
    return { where: 'TRUE', params: [] };
  }
  if (ctx.role === 'reseller') {
    return {
      where: `(n.provisioned_by = ? OR n.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?))`,
      params: [ctx.id, ctx.id],
    };
  }
  if (ctx.role === 'user' && ctx.customerId) {
    return {
      where: 'n.customer_id = ?',
      params: [ctx.customerId],
    };
  }
  return { where: 'FALSE', params: [] };
}

export function customersScopeSql(ctx) {
  if (ctx.role === 'admin') return { where: 'TRUE', params: [] };
  if (ctx.role === 'reseller') {
    return { where: 'c.reseller_user_id = ?', params: [ctx.id] };
  }
  if (ctx.role === 'user' && ctx.customerId) {
    return { where: 'c.id = ?', params: [ctx.customerId] };
  }
  return { where: 'FALSE', params: [] };
}

export function cdrScopeSql(ctx) {
  if (ctx.role === 'admin') return { where: 'TRUE', params: [] };
  if (ctx.role === 'reseller') {
    return {
      where: `cdr.customer_id IN (SELECT id FROM customers WHERE reseller_user_id = ?)`,
      params: [ctx.id],
    };
  }
  if (ctx.role === 'user' && ctx.customerId) {
    return { where: 'cdr.customer_id = ?', params: [ctx.customerId] };
  }
  return { where: 'FALSE', params: [] };
}

export async function canAccessNumber(ctx, row) {
  if (!row) return false;
  if (ctx.role === 'admin') return true;
  if (ctx.role === 'reseller') {
    if (row.provisioned_by === ctx.id) return true;
    if (!row.customer_id) return false;
    const c = await query('SELECT reseller_user_id FROM customers WHERE id = ?', [row.customer_id]);
    return c.rows[0]?.reseller_user_id === ctx.id;
  }
  if (ctx.role === 'user') return row.customer_id === ctx.customerId;
  return false;
}

export async function canAccessCustomer(ctx, customerId) {
  if (!customerId) return false;
  if (ctx.role === 'admin') return true;
  const c = await query('SELECT reseller_user_id, user_id FROM customers WHERE id = ?', [customerId]);
  const row = c.rows[0];
  if (!row) return false;
  if (ctx.role === 'reseller') return row.reseller_user_id === ctx.id;
  if (ctx.role === 'user') return customerId === ctx.customerId;
  return false;
}

export function routesScopeSql(ctx) {
  return numbersScopeSql(ctx);
}

export function requireRoles(...roles) {
  return async function (req, reply) {
    const ctx = req.userCtx;
    if (!ctx) return reply.code(401).send({ error: 'Unauthorized' });
    if (!roles.includes(ctx.role)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  };
}

export async function userHasPermission(userId, perm) {
  const r = await query(
    'SELECT 1 FROM user_permissions WHERE user_id = ? AND perm = ? LIMIT 1',
    [userId, perm]
  );
  return r.rows.length > 0;
}
