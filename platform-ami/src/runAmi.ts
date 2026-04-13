import { loadEnvFromFile } from './lib/env.js';
import { initPool, getPool } from './pool.js';
import { migrateCallLogsForAmi } from './migrate.js';
import { startAMI } from './ami.js';

loadEnvFromFile();

const db = await initPool();
if (!db.ok) {
  console.error('[platform-ami] MySQL init failed:', db.error);
  process.exit(1);
}

const pool = getPool();
if (pool) {
  try {
    await migrateCallLogsForAmi(pool);
  } catch (e) {
    console.error('[platform-ami] migration failed:', (e as Error)?.message || e);
  }
}

startAMI();

process.stdin.resume();
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
