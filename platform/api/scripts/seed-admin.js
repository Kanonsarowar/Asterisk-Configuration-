import 'dotenv/config';
import { getPool } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';

const user = process.argv[2] || 'admin';
const pass = process.argv[3] || 'AdminChangeMe!';

const pool = getPool();
const h = await hashPassword(pass);
try {
  await pool.query(
    'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)',
    [user, h, 'admin']
  );
  console.log(`Created admin user "${user}" (change password immediately).`);
} catch (e) {
  if (e.code === '23505') console.error('User already exists:', user);
  else throw e;
}
await pool.end().catch(() => {});
