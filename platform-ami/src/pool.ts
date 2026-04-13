import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool | null {
  return pool;
}

/** MySQL only for AMI call_logs — no API routes/vendors DDL. */
export async function initPool(): Promise<{ ok: boolean; error?: string }> {
  const host = (process.env.MYSQL_HOST || '127.0.0.1').trim();
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10) || 3306;
  const database = (process.env.MYSQL_DATABASE || '').trim();
  const user = (process.env.MYSQL_USER || '').trim();
  const password = process.env.MYSQL_PASSWORD != null ? String(process.env.MYSQL_PASSWORD) : '';

  if (!database || !user) {
    return { ok: false, error: 'MYSQL_DATABASE and MYSQL_USER are required' };
  }
  if (password === '') {
    return { ok: false, error: 'MYSQL_PASSWORD is required' };
  }

  try {
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 5,
      enableKeepAlive: true,
    });
    await pool.query('SELECT 1 AS ok');
    return { ok: true };
  } catch (e) {
    pool = null;
    return { ok: false, error: String((e as Error)?.message || e) };
  }
}
