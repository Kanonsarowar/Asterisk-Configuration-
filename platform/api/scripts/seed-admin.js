import 'dotenv/config';
import { getPool } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';

const user = process.argv[2] || 'admin';
const pass = process.argv[3] || 'AdminChangeMe!';

const pool = getPool();
const h = await hashPassword(pass);
try {
  const [r] = await pool.execute(
    'INSERT INTO users (username, password_hash, role, balance) VALUES (?, ?, ?, 0)',
    [user, h, 'admin']
  );
  console.log(`Created admin user "${user}" (id ${r.insertId}). Change password immediately.`);
} catch (e) {
  if (e.code === 'ER_DUP_ENTRY') console.error('User already exists:', user);
  else throw e;
}
await pool.end().catch(() => {});
