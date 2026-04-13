/**
 * Phase 2: Asterisk AMI — Dial / Hangup → `call_logs` (keyed by AMI uniqueid / linkedid).
 * Does not throw into the HTTP server; failures are logged only.
 */
import type { Pool } from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { createRequire } from 'module';

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

/** Inbound IVR only: track AMI Linkedids (fallback Uniqueid) that have entered an IVR dialplan context. */
function ivrOnlyEnabled(): boolean {
  const v = (process.env.AMI_IVR_ONLY ?? '1').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Match repo dialplan `[ivr-1]` … `[ivr-10]`. Override with AMI_IVR_CONTEXT_REGEX. */
function ivrContextRegex(): RegExp {
  const raw = (process.env.AMI_IVR_CONTEXT_REGEX ?? '').trim();
  if (raw.length > 0) {
    try {
      return new RegExp(raw);
    } catch {
      console.warn('[ami] AMI_IVR_CONTEXT_REGEX invalid; using default ^ivr-\\d+$');
    }
  }
  return /^ivr-\d+$/;
}

/** Linkedids (and some Uniqueids) seen in IVR context — bounded cleanup on Hangup. */
const ivrCallIds = new Set<string>();
const IVR_TRACK_CAP = 50000;

function trackIvrCallId(id: string): void {
  const k = id.trim();
  if (!k) return;
  if (ivrCallIds.size >= IVR_TRACK_CAP) {
    const first = ivrCallIds.values().next().value as string | undefined;
    if (first) ivrCallIds.delete(first);
  }
  ivrCallIds.add(k);
}

function isTrackedIvrCall(linkedid: string, uniqueid: string): boolean {
  const lid = linkedid.trim();
  const uid = uniqueid.trim();
  if (lid && ivrCallIds.has(lid)) return true;
  if (uid && ivrCallIds.has(uid)) return true;
  return false;
}

function untrackIvrCall(linkedid: string, uniqueid: string): void {
  const lid = linkedid.trim();
  const uid = uniqueid.trim();
  if (lid) ivrCallIds.delete(lid);
  if (uid) ivrCallIds.delete(uid);
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
  // Older Asterisk: Dial without SubEvent is treated as begin
  return sub === '';
}

function prefix3(destDigits: string): string {
  if (destDigits.length >= 3) return destDigits.slice(0, 3);
  return destDigits;
}

/** Prefer explicit dial string / exten; fall back to digits in Destination channel name. */
function destinationDigitsFromDial(ev: AmiDict): { digits: string; label: string } {
  const direct = digitsOnly(
    getField(ev, 'DialString', 'dialstring', 'Exten', 'exten', 'DestCallerIDNum', 'destcalleridnum')
  );
  if (direct.length > 0) return { digits: direct, label: getField(ev, 'DialString', 'dialstring', 'Exten', 'exten') };
  const destCh = getField(ev, 'Destination', 'destination');
  const fromCh = digitsOnly(destCh);
  return { digits: fromCh, label: destCh };
}

function destinationDigitsFromNewexten(ev: AmiDict): { digits: string; label: string } {
  const line = digitsOnly(
    getField(ev, 'ConnectedLineNum', 'Connectedlinenum', 'connectedlinenum', 'Exten', 'exten')
  );
  if (line.length > 0) {
    return {
      digits: line,
      label: getField(ev, 'ConnectedLineNum', 'Connectedlinenum', 'Exten', 'exten'),
    };
  }
  const ch = getField(ev, 'Channel', 'channel');
  return { digits: digitsOnly(ch), label: ch };
}

async function upsertCallLogOngoing(
  pool: Pool,
  rowKey: string,
  linkedid: string,
  caller: string | null,
  destination: string | null,
  pfx: string | null
): Promise<void> {
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
    [rowKey, linkedid || null, caller, destination, pfx]
  );
}

/** IVR context `[ivr-N]`: track call + insert ONGOING (dialplan often has no Dial). */
async function handleNewexten(pool: Pool, ev: AmiDict): Promise<void> {
  if (!ivrOnlyEnabled()) return;

  const ctx = getField(ev, 'Context', 'context').trim();
  if (!ivrContextRegex().test(ctx)) return;

  const linkedid = getField(ev, 'Linkedid', 'LinkedID', 'linkedid');
  const uniqueid = getField(ev, 'Uniqueid', 'UniqueID', 'uniqueid');
  if (linkedid) trackIvrCallId(linkedid);
  if (uniqueid) trackIvrCallId(uniqueid);
  const rowKey = linkedid || uniqueid;
  if (!rowKey) return;
  trackIvrCallId(rowKey);

  const callerRaw = getField(ev, 'CallerIDNum', 'CalleridNum', 'calleridnum', 'CID');
  const caller = callerRaw.slice(0, 64) || null;
  const { digits: destDigits, label: destLabel } = destinationDigitsFromNewexten(ev);
  const pfx = prefix3(destDigits);
  const destination = (destDigits || destLabel).slice(0, 64) || null;

  try {
    await upsertCallLogOngoing(pool, rowKey, linkedid, caller, destination, pfx || null);
  } catch (e) {
    console.error('[ami] Newexten IVR insert failed:', (e as Error)?.message || e);
  }
}

/**
 * Start AMI client; safe to call when pool is null (no-ops with log).
 */
export function startAMI(pool: Pool | null): void {
  if (!amiFlagEnabled()) {
    console.log('[ami] disabled (AMI_ENABLED=0)');
    return;
  }
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
    const mode = ivrOnlyEnabled() ? 'inbound IVR only (Newexten ivr-* + Dial/Hangup)' : 'all Dial/Hangup';
    console.log(`[ami] connected to ${amiHost()}:${amiPort()} as ${amiUser()} (${mode} → call_logs)`);
  });

  client.on('disconnect', () => {
    console.warn('[ami] disconnected from Asterisk AMI (reconnecting if enabled)');
  });

  client.on('error', (err: unknown) => {
    console.error('[ami] error:', err);
  });

  client.on('Newexten', (raw: unknown) => {
    void handleNewexten(pool, raw as AmiDict).catch((e) => console.error('[ami] Newexten handler:', e));
  });

  client.on('Dial', (raw: unknown) => {
    void handleDial(pool, raw as AmiDict).catch((e) => console.error('[ami] Dial handler:', e));
  });

  client.on('Hangup', (raw: unknown) => {
    void handleHangup(pool, raw as AmiDict).catch((e) => console.error('[ami] Hangup handler:', e));
  });

  client
    .connect(amiUser(), amiSecret(), { host: amiHost(), port: amiPort() })
    .catch((err: unknown) => {
      console.error('[ami] connect failed (API keeps running):', err);
    });
}

async function handleDial(pool: Pool, ev: AmiDict): Promise<void> {
  if (!isDialBegin(ev)) return;

  const linkedid = getField(ev, 'Linkedid', 'LinkedID', 'linkedid');
  const uniqueid = getField(ev, 'Uniqueid', 'UniqueID', 'uniqueid');

  if (ivrOnlyEnabled() && !isTrackedIvrCall(linkedid, uniqueid)) {
    return;
  }

  const { digits: destDigits, label: destLabel } = destinationDigitsFromDial(ev);
  const callerRaw = getField(ev, 'CallerIDNum', 'CalleridNum', 'calleridnum', 'CID', 'Source', 'Channel');
  const caller = callerRaw.slice(0, 64);

  const rowKey = linkedid || uniqueid;
  if (!rowKey) {
    console.warn('[ami] Dial Begin: missing Linkedid/Uniqueid, skip insert', {
      Event: getField(ev, 'Event'),
    });
    return;
  }

  const pfx = prefix3(destDigits);
  const destination = (destDigits || destLabel).slice(0, 64) || null;

  try {
    await upsertCallLogOngoing(pool, rowKey, linkedid, caller || null, destination, pfx || null);
  } catch (e) {
    console.error('[ami] Dial insert failed:', (e as Error)?.message || e);
  }
}

async function handleHangup(pool: Pool, ev: AmiDict): Promise<void> {
  const uid = getField(ev, 'Uniqueid', 'UniqueID', 'uniqueid');
  const lid = getField(ev, 'Linkedid', 'LinkedID', 'linkedid');

  if (ivrOnlyEnabled() && !isTrackedIvrCall(lid, uid)) {
    return;
  }

  const bill = getField(ev, 'BillableSeconds', 'billableseconds');
  const durRaw = getField(ev, 'Duration', 'duration');
  const durationSec =
    bill !== ''
      ? Math.max(0, parseInt(bill, 10) || 0)
      : Math.max(0, parseInt(durRaw, 10) || 0);

  let disposition = getField(ev, 'Cause-txt', 'CauseTxt', 'causetxt', 'Cause', 'cause');
  if (!disposition) disposition = 'HANGUP';

  if (!uid && !lid) {
    console.warn('[ami] Hangup: no Uniqueid/Linkedid, skip update');
    return;
  }

  try {
    let affected = 0;

    // Row key on Dial is `linkedid || dial Uniqueid`; Hangup often carries the call Linkedid first.
    if (lid) {
      const [r1] = await pool.execute<ResultSetHeader>(
        `UPDATE \`call_logs\`
         SET \`duration\` = ?, \`status\` = ?
         WHERE \`uniqueid\` <=> ?
         LIMIT 1`,
        [durationSec, disposition.slice(0, 32), lid]
      );
      affected = r1.affectedRows ?? 0;
    }

    if (affected === 0 && uid) {
      const [r2] = await pool.execute<ResultSetHeader>(
        `UPDATE \`call_logs\`
         SET \`duration\` = ?, \`status\` = ?
         WHERE \`uniqueid\` <=> ?
         LIMIT 1`,
        [durationSec, disposition.slice(0, 32), uid]
      );
      affected = r2.affectedRows ?? 0;
    }

    if (affected === 0 && lid) {
      const [r3] = await pool.execute<ResultSetHeader>(
        `UPDATE \`call_logs\`
         SET \`duration\` = ?, \`status\` = ?
         WHERE \`linkedid\` <=> ? AND \`status\` = 'ONGOING'
         ORDER BY \`id\` DESC
         LIMIT 1`,
        [durationSec, disposition.slice(0, 32), lid]
      );
      affected = r3.affectedRows ?? 0;
    }

    if (affected === 0) {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT \`id\`, \`uniqueid\`, \`linkedid\` FROM \`call_logs\`
         WHERE \`uniqueid\` IN (?, ?) OR \`linkedid\` IN (?, ?)
         ORDER BY \`id\` DESC LIMIT 3`,
        [uid || '', lid || '', uid || '', lid || '']
      );
      console.warn('[ami] Hangup: no row updated for', { uid, lid, durationSec, disposition, hint: rows });
    } else if (ivrOnlyEnabled()) {
      untrackIvrCall(lid, uid);
    }
  } catch (e) {
    console.error('[ami] Hangup update failed:', (e as Error)?.message || e);
  }
}
