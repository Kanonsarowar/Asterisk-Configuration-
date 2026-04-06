import '../src/config.js';
import { getPool, closePool } from '../src/db.js';
import { hashPassword } from '../src/modules/auth/auth.service.js';

const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'admin123';
const role = process.argv[4] || 'admin';

const pool = getPool();
const hash = await hashPassword(password);

try {
  await pool.execute(
    'INSERT INTO users (username, password_hash, role, balance) VALUES (?, ?, ?, 0)',
    [username, hash, role]
  );
  console.log(`Created ${role} user "${username}"`);
} catch (e) {
  if (e.code === 'ER_DUP_ENTRY') {
    await pool.execute('UPDATE users SET password_hash = ? WHERE username = ?', [hash, username]);
    console.log(`Updated password for existing user "${username}"`);
  } else {
    throw e;
  }
}

await closePool();
