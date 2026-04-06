import mysql from 'mysql2/promise';
import { config } from './config.js';

let pool = null;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      waitForConnections: true,
      connectionLimit: config.mysql.poolSize,
      enableKeepAlive: true,
      namedPlaceholders: false,
    });
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function healthCheck() {
  const p = getPool();
  const [rows] = await p.query('SELECT 1 AS ok');
  return rows[0]?.ok === 1;
}
