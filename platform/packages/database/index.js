import mysql from 'mysql2/promise';

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: parseInt(process.env.MYSQL_PORT || '3306', 10),
      user: process.env.MYSQL_USER || 'iprn',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'iprn',
      socketPath: process.env.MYSQL_SOCKET || undefined,
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

export async function query(sql, params = []) {
  const [result] = await getPool().execute(sql, params);
  if (Array.isArray(result)) return { rows: result };
  return { rows: [], insertId: result.insertId, affectedRows: result.affectedRows };
}

export async function transaction(fn) {
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
