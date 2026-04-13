/**
 * Phase 2: Asterisk AMI — Dial / Hangup → `call_logs` keyed strictly by AMI Uniqueid.
 * Errors are logged; the HTTP server process does not exit on AMI failure.
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

/** Inbound DID → IVR: dialplan uses Answer() in `[ivr-*]` with no Dial — log on Answer Newexten. */
function ivrAnswerInsertEnabled(): boolean {
  const v = (process.env.AMI_IVR_ANSWER_INSERT ?? '1').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function ivrContextRegex(): RegExp {
  const raw = (process.env.AMI_IVR_CONTEXT_REGEX ?? '').trim();
  if (raw.length > 0) {
    try {
      return new RegExp(raw);
    } catch {
      console.warn('[ami] AMI_IVR_CONTEXT_REGEX invalid; using ^ivr-\\d+$');
    }
  }
  return /^ivr-\d+$/;
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

function prefix3(destDigits: string): string {
  if (destDigits.length >= 3) return destDigits.slice(0, 3);
  return destDigits;
}

/** Destination digits for Dial leg (dial string, exten, or destination channel). */
function destinationFromDial(ev: AmiDict): { digits: string; label: string } {
  const direct = digitsOnly(
    getField(ev, 'DialString', 'dialstring', 'Exten', 'exten', 'DestCallerIDNum', 'destcalleridnum')
  );
  if (direct.length > 0) {
    return { digits: direct, label: getField(ev, 'DialString', 'dialstring', 'Exten', 'exten') };
  }
  const destCh = getField(ev, 'Destination', 'destination');
  return { digits: digitsOnly(destCh), label: destCh };
}

/** DID / destination hints when channel is already in `[ivr-*]` (after routing). */
function destinationFromIvrNewexten(ev: AmiDict): { digits: string; label: string } {
  const line = digitsOnly(
    getField(
      ev,
      'ConnectedLineNum',
      'Connectedlinenum',
      'connectedlinenum',
      'Exten',
      'exten',
      'Extension',
      'extension'
    )
  );
  if (line.length > 0 && line !== 's') {
    return {
      digits: line,
      label: getField(ev, 'ConnectedLineNum', 'Connectedlinenum', 'Exten', 'exten', 'Extension'),
    };
  }
  const ch = getField(ev, 'Channel', 'channel');
  return { digits: digitsOnly(ch), label: ch };
}

/**
 * Start AMI client. Uses `getPool()` from `db.ts` (must run after `initDb()`).
 */
export function startAMI(): void {
  if (!amiFlagEnabled()) {
    console.log('[ami] disabled (AMI_ENABLED=0)');
    return;
  }

  const pool = getPool();
  if (!pool) {
    console.error('[ami] skipped: database pool unavailable');
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
    console.warn('[ami] disconnected from Asterisk AMI (reconnecting if enabled)');
  });

  client.on('error', (err: unknown) => {
    console.error('[ami] socket/client error:', err);
  });

  client.on('Newexten', (raw: unknown) => {
    void handleNewextenIvrAnswer(pool, raw as AmiDict).catch((e) =>
      console.error('[ami] Newexten handler:', e)
    );
  });

  client.on('Dial', (raw: unknown) => {
    console.log('Dial event received');
    void handleDial(pool, raw as AmiDict).catch((e) => console.error('[ami] Dial handler:', e));
  });

  client.on('Hangup', (raw: unknown) => {
    console.log('Hangup event received');
    void handleHangup(pool, raw as AmiDict).catch((e) => console.error('[ami] Hangup handler:', e));
  });

  client
    .connect(amiUser(), amiSecret(), { host: amiHost(), port: amiPort() })
    .then(() => {
      console.log(`AMI Connected (session ${amiHost()}:${amiPort()} user=${amiUser()})`);
    })
    .catch((err: unknown) => {
      console.error('[ami] connect failed (API keeps running):', err);
    });
}

/**
 * Inbound DID → IVR: `[ivr-N]` + `Answer()` — no Dial; open call_logs row on this Uniqueid.
 */
async function handleNewextenIvrAnswer(pool: Pool, ev: AmiDict): Promise<void> {
  if (!ivrAnswerInsertEnabled()) return;

  const ctx = getField(ev, 'Context', 'context').trim();
  if (!ivrContextRegex().test(ctx)) return;

  const app = getField(ev, 'Application', 'application').trim().toLowerCase();
  if (app !== 'answer') return;

  const uniqueid = getField(ev, 'Uniqueid', 'UniqueID', 'uniqueid').trim();
  if (!uniqueid) {
    console.warn('[ami] Newexten IVR Answer: missing Uniqueid, skip');
    return;
  }

  console.log('Newexten IVR Answer event received');

  const linkedid = getField(ev, 'Linkedid', 'LinkedID', 'linkedid').trim() || null;
  const callerRaw = getField(ev, 'CallerIDNum', 'CalleridNum', 'calleridnum', 'CID');
  const caller = callerRaw.slice(0, 64) || null;
  const { digits: destDigits, label: destLabel } = destinationFromIvrNewexten(ev);
  const destination = (destDigits || destLabel).slice(0, 64) || null;
  const pfx = prefix3(destDigits) || null;

  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO \`call_logs\` (
        \`uniqueid\`, \`linkedid\`, \`caller\`, \`destination\`, \`prefix\`,
        \`vendor_id\`, \`duration\`, \`status\`, \`start_time\`, \`created_at\`
      ) VALUES (?, ?, ?, ?, ?, 1, 0, 'ONGOING', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`caller\` = COALESCE(NULLIF(VALUES(\`caller\`), ''), \`caller\`),
        \`destination\` = COALESCE(NULLIF(VALUES(\`destination\`), ''), \`destination\`),
        \`prefix\` = COALESCE(NULLIF(VALUES(\`prefix\`), ''), \`prefix\`),
        \`linkedid\` = COALESCE(VALUES(\`linkedid\`), \`linkedid\`)`,
      [uniqueid, linkedid, caller, destination, pfx]
    );
  } catch (e) {
    console.error('[ami] Newexten IVR insert failed:', (e as Error)?.message || e);
  }
}

async function handleDial(pool: Pool, ev: AmiDict): Promise<void> {
  if (!isDialBegin(ev)) return;

  const uniqueid = getField(ev, 'Uniqueid', 'UniqueID', 'uniqueid').trim();
  if (!uniqueid) {
    console.warn('[ami] Dial: missing Uniqueid, skip insert');
    return;
  }

  const linkedid = getField(ev, 'Linkedid', 'LinkedID', 'linkedid').trim() || null;
  const { digits: destDigits, label: destLabel } = destinationFromDial(ev);
  const destination = (destDigits || destLabel).slice(0, 64) || null;
  const pfx = prefix3(destDigits) || null;
  const callerRaw = getField(ev, 'CallerIDNum', 'CalleridNum', 'calleridnum', 'CID', 'Source');
  const caller = callerRaw.slice(0, 64) || null;

  try {
    await pool.execute<ResultSetHeader>(
      `INSERT INTO \`call_logs\` (
        \`uniqueid\`, \`linkedid\`, \`caller\`, \`destination\`, \`prefix\`,
        \`vendor_id\`, \`duration\`, \`status\`, \`start_time\`, \`created_at\`
      ) VALUES (?, ?, ?, ?, ?, 1, 0, 'ONGOING', NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`caller\` = VALUES(\`caller\`),
        \`destination\` = VALUES(\`destination\`),
        \`prefix\` = VALUES(\`prefix\`),
        \`linkedid\` = COALESCE(VALUES(\`linkedid\`), \`linkedid\`),
        \`duration\` = 0,
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
    console.warn('[ami] Hangup: missing Uniqueid, skip update');
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

  const status = disposition.slice(0, 32);

  try {
    const [res] = await pool.execute<ResultSetHeader>(
      `UPDATE \`call_logs\` SET \`duration\` = ?, \`status\` = ? WHERE \`uniqueid\` = ?`,
      [durationSec, status, uniqueid]
    );
    const n = res.affectedRows ?? 0;
    if (n === 0) {
      console.warn('[ami] Hangup: no row for uniqueid=', uniqueid);
    }
  } catch (e) {
    console.error('[ami] Hangup update failed:', (e as Error)?.message || e);
  }
}
