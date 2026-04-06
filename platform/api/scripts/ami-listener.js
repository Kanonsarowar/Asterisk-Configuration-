/**
 * AMI listener:
 * - Real-time call monitor: upserts live_calls (Newchannel, Newstate, DialBegin).
 * - Optional CDR → MySQL: on Cdr event, insert via insertCdrFromPbx (same logic as HTTP ingest).
 *
 * Env:
 *   AMI_HOST, AMI_PORT, AMI_USER, AMI_SECRET
 *   MYSQL_* (for DB path; required unless CDR_HTTP_ONLY=1)
 *   CDR_FROM_AMI=1 — enable Cdr → DB (default on if MYSQL_* set)
 *   CDR_HTTP_ONLY=1 — skip live_calls / skip direct DB; POST CDR to API only
 *   CDR_INGEST_URL — e.g. http://127.0.0.1:3010/api/cdr/ingest (uses INTERNAL_API_KEY)
 *   INTERNAL_API_KEY — for HTTP ingest
 */
import 'dotenv/config';
import ami from 'asterisk-manager';
import mysql from 'mysql2/promise';
import { insertCdrFromPbx } from '../src/lib/cdrInsert.js';

const useHttpCdr = Boolean(process.env.CDR_INGEST_URL && process.env.INTERNAL_API_KEY);
const httpOnly = process.env.CDR_HTTP_ONLY === '1';
const cdrFromAmi =
  !httpOnly &&
  (process.env.CDR_FROM_AMI === '1' ||
    (process.env.CDR_FROM_AMI !== '0' && process.env.MYSQL_USER && process.env.MYSQL_DATABASE));

let pool;
if (!httpOnly && process.env.MYSQL_USER && process.env.MYSQL_DATABASE) {
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD ?? '',
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 4,
  });
}

const am = ami(
  parseInt(process.env.AMI_PORT || '5038', 10),
  process.env.AMI_HOST || '127.0.0.1',
  process.env.AMI_USER || 'admin',
  process.env.AMI_SECRET || '',
  true
);

am.keepConnected();

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

function pick(ev, ...keys) {
  for (const k of keys) {
    if (ev[k] != null && ev[k] !== '') return ev[k];
    const lower = k.toLowerCase();
    for (const ek of Object.keys(ev)) {
      if (ek.toLowerCase() === lower) return ev[ek];
    }
  }
  return '';
}

function directionFromContext(ctx) {
  const c = String(ctx || '').toLowerCase();
  if (c.includes('inbound') || c.includes('from-trunk') || c.includes('from-supplier')) return 'inbound';
  if (c.includes('outbound') || c.includes('from-internal') || c.includes('prefix-routes'))
    return 'outbound';
  return 'unknown';
}

function destFromDialstring(ds) {
  const s = String(ds || '');
  const m = s.match(/\/([^@\/;]+)/);
  return m ? digits(m[1]) : digits(s);
}

async function upsertLive(ev) {
  if (!pool) return;
  const uniqueid = pick(ev, 'uniqueid', 'Uniqueid');
  const channel = pick(ev, 'channel', 'Channel');
  if (!uniqueid) return;

  const context = pick(ev, 'context', 'Context');
  const exten = pick(ev, 'exten', 'Exten');
  const cidNum = pick(ev, 'calleridnum', 'CallerIDNum', 'callerid');
  const connected = pick(ev, 'connectedlinenum', 'ConnectedLineNum');
  const linkedid = pick(ev, 'linkedid', 'Linkedid') || null;
  const accountcode = pick(ev, 'accountcode', 'AccountCode') || null;
  const state = pick(ev, 'channelstate', 'ChannelStateDesc', 'state') || null;

  let cli = digits(cidNum);
  let destination = digits(exten) || digits(connected);
  const direction = directionFromContext(context);

  if (ev.event === 'DialBegin') {
    const ds = pick(ev, 'dialstring', 'DialString');
    const d = destFromDialstring(ds);
    if (d) destination = d;
  }

  await pool.execute(
    `INSERT INTO live_calls (uniqueid, linkedid, channel, dialplan_context, exten, accountcode, cli, destination, direction, state, started_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE
       channel = COALESCE(VALUES(channel), channel),
       linkedid = COALESCE(VALUES(linkedid), linkedid),
       dialplan_context = COALESCE(VALUES(dialplan_context), dialplan_context),
       exten = COALESCE(VALUES(exten), exten),
       accountcode = COALESCE(VALUES(accountcode), accountcode),
       cli = COALESCE(NULLIF(VALUES(cli), ''), cli),
       destination = COALESCE(NULLIF(VALUES(destination), ''), destination),
       direction = IF(VALUES(direction) <> 'unknown', VALUES(direction), direction),
       state = COALESCE(VALUES(state), state),
       last_seen_at = UTC_TIMESTAMP(3)`,
    [
      uniqueid,
      linkedid,
      channel || null,
      context || null,
      exten || null,
      accountcode,
      cli || null,
      destination || null,
      direction,
      state,
    ]
  );
}

async function deleteLive(uniqueid) {
  if (!pool || !uniqueid) return;
  await pool.execute('DELETE FROM live_calls WHERE uniqueid = ?', [uniqueid]);
}

function amiTimeToSql(t) {
  if (!t) return null;
  const s = String(t);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.replace(' ', 'T').slice(0, 23);
  const n = parseInt(t, 10);
  if (Number.isFinite(n) && n > 1000000000) {
    return new Date(n * 1000).toISOString().slice(0, 23).replace('T', ' ');
  }
  return null;
}

async function handleCdr(ev) {
  const uniqueid = pick(ev, 'uniqueid', 'Uniqueid');
  const linkedid = pick(ev, 'linkedid', 'Linkedid');
  const src = pick(ev, 'source', 'Source', 'calleridnum', 'CallerIDNum');
  const dst = pick(ev, 'destination', 'Destination');
  const disposition = pick(ev, 'disposition', 'Disposition');
  const duration = parseInt(pick(ev, 'billableseconds', 'BillableSeconds', 'duration', 'Duration') || '0', 10);
  const start = amiTimeToSql(pick(ev, 'starttime', 'StartTime'));
  const answer = amiTimeToSql(pick(ev, 'answertime', 'AnswerTime'));
  const end = amiTimeToSql(pick(ev, 'endtime', 'EndTime'));

  const body = {
    call_id: linkedid || uniqueid || null,
    uniqueid: uniqueid || null,
    cli: src || null,
    destination: dst || null,
    start_time: start,
    answer_time: answer,
    end_time: end,
    duration: Number.isFinite(duration) ? duration : 0,
    disposition: disposition || null,
  };

  if (httpOnly && !useHttpCdr) {
    console.error('[cdr] CDR_HTTP_ONLY=1 but CDR_INGEST_URL / INTERNAL_API_KEY missing');
    return;
  }

  if (useHttpCdr) {
    const res = await fetch(process.env.CDR_INGEST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': process.env.INTERNAL_API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error('[cdr http]', res.status, txt);
    }
    return;
  }

  if (cdrFromAmi && pool) {
    try {
      await insertCdrFromPbx(body);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return;
      console.error('[cdr db]', e.message);
    }
  }
}

am.on('managerevent', async (ev) => {
  try {
    const evName = ev.event || ev.Event;
    if (httpOnly && evName !== 'Cdr') return;

    if (evName === 'Newchannel' || evName === 'Newstate' || evName === 'DialBegin') {
      await upsertLive({ ...ev, event: evName });
    }
    if (evName === 'Hangup') {
      const uid = pick(ev, 'uniqueid', 'Uniqueid');
      await deleteLive(uid);
    }
    if (evName === 'Cdr') {
      await handleCdr(ev);
    }
  } catch (e) {
    console.error('[ami]', e.message);
  }
});

am.on('error', (err) => console.error('[ami] error', err));

const modes = [];
if (pool && !httpOnly) modes.push('live_calls');
if (cdrFromAmi && (pool || useHttpCdr)) modes.push(useHttpCdr ? 'cdr→http' : 'cdr→mysql');
console.log('AMI listener:', modes.join(', ') || '(no DB/http — set MYSQL_* or CDR_INGEST_URL)');
