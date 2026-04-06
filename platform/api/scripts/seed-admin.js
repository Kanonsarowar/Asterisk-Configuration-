import 'dotenv/config';
import { getPool } from '../src/db.js';
import { hashPassword } from '../src/lib/password.js';

const args = process.argv.slice(2).filter((a) => a !== '--reset');
const reset = process.argv.includes('--reset') || process.env.SEED_RESET === '1';

const user = args[0] || 'admin';
const pass = args[1] || 'AdminChangeMe!';

const pool = getPool();
const h = await hashPassword(pass);

try {
  const [r] = await pool.execute(
    'INSERT INTO users (username, password_hash, role, balance) VALUES (?, ?, ?, 0)',
    [user, h, 'admin']
  );
  console.log(`Created admin user "${user}" (id ${r.insertId}).`);
} catch (e) {
  if (e.code === 'ER_DUP_ENTRY') {
    if (reset) {
      const [u] = await pool.execute('UPDATE users SET password_hash = ? WHERE username = ?', [h, user]);
      console.log(`Reset password for "${user}" (${u.affectedRows} row).`);
    } else {
      console.error(`User "${user}" already exists. To set a new password run:`);
      console.error(`  npm run seed -- ${user} '${pass}' --reset`);
      console.error('Or: SEED_RESET=1 npm run seed -- admin yourpassword');
      process.exit(1);
    }
  } else {
    throw e;
  }
}
await pool.end().catch(() => {});
