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
      connectionLimit: parseInt(process.env.MYSQL_POOL_LIMIT || '10', 10),
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: 'Z',
    });
  }
  return pool;
}

export async function query(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return { rows: Array.isArray(rows) ? rows : [] };
}
