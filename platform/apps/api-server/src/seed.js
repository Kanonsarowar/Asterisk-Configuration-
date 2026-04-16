import 'dotenv/config';
import { query } from '../../../packages/database/index.js';
import { hashPassword } from '../../../packages/auth/index.js';

const username = process.argv[2] || 'admin';
const password = process.argv[3] || 'admin123';

async function seed() {
  const { rows } = await query('SELECT id FROM users WHERE username = ?', [username]);
  if (rows.length) {
    console.log(`User '${username}' already exists (id=${rows[0].id})`);
    process.exit(0);
  }
  const hash = await hashPassword(password);
  const { insertId } = await query(
    `INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, 'superadmin', 'active')`,
    [username, `${username}@platform.local`, hash]
  );
  console.log(`Created superadmin user '${username}' (id=${insertId})`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
