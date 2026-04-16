import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlDir = join(__dirname, '..', 'sql');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'iprn',
    multipleStatements: true,
  });

  await conn.execute(`CREATE TABLE IF NOT EXISTS _migrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const [applied] = await conn.execute('SELECT filename FROM _migrations ORDER BY id');
  const appliedSet = new Set(applied.map(r => r.filename));

  const files = readdirSync(sqlDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.sample'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip: ${file} (already applied)`);
      continue;
    }
    console.log(`  apply: ${file}`);
    const sql = readFileSync(join(sqlDir, file), 'utf8');
    try {
      await conn.query(sql);
      await conn.execute('INSERT INTO _migrations (filename) VALUES (?)', [file]);
      count++;
    } catch (err) {
      console.error(`  FAILED: ${file} — ${err.message}`);
      process.exit(1);
    }
  }

  console.log(`Migrations complete. Applied ${count} new migration(s).`);
  await conn.end();
}

main().catch(err => { console.error(err); process.exit(1); });
