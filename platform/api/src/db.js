import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    const host = process.env.MYSQL_HOST || '127.0.0.1';
    const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
    const user = process.env.MYSQL_USER;
    const password = process.env.MYSQL_PASSWORD ?? '';
    const database = process.env.MYSQL_DATABASE;
    if (!user || !database) {
      throw new Error('MYSQL_USER and MYSQL_DATABASE are required');
    }
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: parseInt(process.env.MYSQL_POOL_LIMIT || '32', 10),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: 'Z',
      dateStrings: false,
    });
  }
  return pool;
}

/**
 * Execute SQL with positional placeholders (?).
 * SELECT: { rows }. INSERT/UPDATE/DELETE: { rows: [], insertId?, affectedRows? }.
 */
export async function query(text, params = []) {
  const p = getPool();
  const [result] = await p.execute(text, params);
  if (Array.isArray(result)) {
    return { rows: result };
  }
  return {
    rows: [],
    insertId: result.insertId,
    affectedRows: result.affectedRows,
  };
}

/** Get insertId / affectedRows from last write when needed */
export async function executeRaw(text, params = []) {
  const p = getPool();
  const [result] = await p.execute(text, params);
  return result;
}
