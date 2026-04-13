/**
 * Phase 2: Asterisk AMI — Dial / Hangup → `call_logs` keyed by AMI Uniqueid only.
 * AMI failures are logged; the HTTP process does not exit.
 */
import type { Pool } from 'mysql2/promise';
import type { ResultSetHeader } from 'mysql2';
import { createRequire } from 'module';
import { getPool } from './db.js';

const require = createRequire(import.meta.url);
const AmiClient = require('asterisk-ami-client') as typeof import('asterisk-ami-client').default;

type AmiDict = Record<string, string | undefined>;

function amiFlagEnabled(): boolean {
  const v = (process.env.AMI_ENABLED ?? '1').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function amiHost(): string {
  return (process.env.AMI_HOST || '127.0.0.1').trim() || '127.0.0.1';
}

function amiPort(): number {
  const n = parseInt(process.env.AMI_PORT || '5038', 10);
  return Number.isFinite(n) && n > 0 ? n : 5038;
}

function amiUser(): string {
  return (process.env.AMI_USERNAME || 'carrier').trim() || 'carrier';
}

function amiSecret(): string {
  return process.env.AMI_PASSWORD != null ? String(process.env.AMI_PASSWORD) : 'strongpassword';
}

function digitsOnly(s: unknown): string {
  return String(s ?? '').replace(/\D/g, '');
}

function getField(ev: AmiDict, ...keys: string[]): string {
  for (const k of keys) {
    const v = ev[k];
    if (v != null && String(v).length > 0) return String(v);
  }
  return '';
}

function isDialBegin(ev: AmiDict): boolean {
  const sub = getField(ev, 'SubEvent', 'subevent').toLowerCase();
  if (sub === 'end') return false;
  if (sub === 'begin') return true;
  return sub === '';
}

function prefixFromDestination(destRaw: string): string {
  const d = digitsOnly(destRaw);
  if (d.length >= 3) return d.slice(0, 3);
  return d;
}

/**
 * Start AMI. Must run after `initDb()` so `getPool()` is set.
 */
export function startAMI(): void {
  console.log('AMI INIT STARTING...');

  if (!amiFlagEnabled()) {
    console.log('[ami] disabled (AMI_ENABLED=0)');
    return;
  }

  const pool = getPool();
  if (!pool) {
    console.error('AMI CONNECTION FAILED:', new Error('database pool unavailable (MYSQL_* / initDb)'));
    return;
  }

  const client = new AmiClient({
    reconnect: true,
    maxAttemptsCount: 60,
    attemptsDelay: 3000,
    keepAlive: true,
    keepAliveDelay: 60000,
    emitEventsByTypes: true,
  });

  client.on('connect', () => {
    console.log('AMI Connected');
  });

  client.on('disconnect', () => {
    console.warn('[ami] disconnected from Asterisk AMI');
  });

  client.on('error', (err: unknown) => {
    console.error('[ami] socket/client error:', err);
  });

  client.on('Dial', (raw: unknown) => {
    void handleDial(pool, raw as AmiDict).catch((e) => console.error('[ami] Dial handler:', e));
  });

  client.on('Hangup', (raw: unknown) => {
    void handleHangup(pool, raw as AmiDict).catch((e) => console.error('[ami] Hangup handler:', e));
  });

  client.connect(amiUser(), amiSecret(), { host: amiHost(), port: amiPort() }).catch((err: unknown) => {
    console.error('AMI CONNECTION FAILED:', err);
  });
}

async function handleDial(pool: Pool, ev: AmiDict): Promise<void> {
  if (!isDialBegin(ev)) return;

  const uniqueid = getField(ev, 'Uniqueid', 'UniqueID', 'uniqueid').trim();
  if (!uniqueid) {
    console.warn('[ami] Dial: missing Uniqueid, skip');
    return;
  }

  const destRaw = getField(ev, 'Destination', 'destination');
  const destination = destRaw.slice(0, 64) || null;
  const pfx = prefixFromDestination(destRaw) || null;
  const linkedid = getField(ev, 'Linkedid', 'LinkedID', 'linkedid').trim() || null;
  const callerRaw = getField(ev, 'CallerIDNum', 'CalleridNum', 'calleridnum', 'CID', 'Source');
  const caller = callerRaw.slice(0, 64) || null;

  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO \`call_logs\` (
        \`uniqueid\`, \`linkedid\`, \`caller\`, \`destination\`, \`prefix\`,
        \`vendor_id\`, \`duration\`, \`disposition\`, \`status\`, \`start_time\`, \`created_at\`
      ) VALUES (?, ?, ?, ?, ?, 1, 0, 'ONGOING', 'ONGOING', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`caller\` = VALUES(\`caller\`),
        \`destination\` = VALUES(\`destination\`),
        \`prefix\` = VALUES(\`prefix\`),
        \`linkedid\` = COALESCE(VALUES(\`linkedid\`), \`linkedid\`),
        \`duration\` = 0,
        \`disposition\` = 'ONGOING',
        \`status\` = 'ONGOING',
        \`start_time\` = NOW()`,
      [uniqueid, linkedid, caller, destination, pfx]
    );
  } catch (e) {
    console.error('[ami] Dial insert failed:', (e as Error)?.message || e);
  }
}

async function handleHangup(pool: Pool, ev: AmiDict): Promise<void> {
  const uniqueid = getField(ev, 'Uniqueid', 'UniqueID', 'uniqueid').trim();
  if (!uniqueid) {
    console.warn('[ami] Hangup: missing Uniqueid, skip');
    return;
  }

  const bill = getField(ev, 'BillableSeconds', 'billableseconds');
  const durRaw = getField(ev, 'Duration', 'duration');
  const durationSec =
    bill !== ''
      ? Math.max(0, parseInt(bill, 10) || 0)
      : Math.max(0, parseInt(durRaw, 10) || 0);

  let disposition = getField(ev, 'Cause-txt', 'CauseTxt', 'causetxt');
  if (!disposition) disposition = getField(ev, 'Cause', 'cause');
  if (!disposition) disposition = 'HANGUP';

  const disp = disposition.slice(0, 64);
  const status = disp.slice(0, 32);

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE \`call_logs\` SET \`duration\` = ?, \`disposition\` = ?, \`status\` = ? WHERE \`uniqueid\` = ?`,
      [durationSec, disp, status, uniqueid]
    );
    if ((res.affectedRows ?? 0) === 0) {
      console.warn('[ami] Hangup: no row for uniqueid=', uniqueid);
    }
  } catch (e) {
    console.error('[ami] Hangup update failed:', (e as Error)?.message || e);
  }
}
