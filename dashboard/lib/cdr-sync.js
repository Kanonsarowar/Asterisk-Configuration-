/**
 * Incremental sync: Asterisk Master.csv → MySQL `call_logs`.
 * dedup_hash UNIQUE prevents duplicates; offset stored in data/cdr_sync_state.json.
 */
import { createHash } from 'crypto';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'fs';
import { open } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { CDR_FILE as DEFAULT_CDR, parseCSVLine, mapCdrCsvFields } from './cdr.js';

const CDR_FILE = String(process.env.CDR_MASTER_PATH || DEFAULT_CDR).trim() || DEFAULT_CDR;
import { getMysqlPool, isMysqlEnabled } from './mysql.js';
import { matchNumberForDestination } from './call-stats-mysql.js';

const __dirnameCdr = dirname(fileURLToPath(import.meta.url));

function statePath() {
  return join(__dirnameCdr, '..', 'data', 'cdr_sync_state.json');
}

function loadState() {
  const p = statePath();
  try {
    if (!existsSync(p)) return { byteOffset: 0, partial: '', inode: null };
    const j = JSON.parse(readFileSync(p, 'utf8'));
    return {
      byteOffset: Math.max(0, parseInt(String(j.byteOffset), 10) || 0),
      partial: typeof j.partial === 'string' ? j.partial : '',
      inode: j.inode != null ? Number(j.inode) : null,
    };
  } catch {
    return { byteOffset: 0, partial: '', inode: null };
  }
}

function saveState(s) {
  const p = statePath();
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(s, null, 2), 'utf8');
  } catch (e) {
    console.error('[cdr-sync] state write:', e?.message || e);
  }
}

function rowDedupHash(fields) {
  return createHash('sha256').update(fields.join('\x1e'), 'utf8').digest('hex');
}

function parseCdrTimeToMysql(startRaw) {
  const s = String(startRaw || '').replace(/"/g, '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * @param {unknown[]} numbers DID list (same as dashboard numbers API)
 */
export async function syncCdrToCallLogs(numbers) {
  const out = {
    ok: false,
    skipped: true,
    reason: '',
    inserted: 0,
    duplicates: 0,
    skippedNoMatch: 0,
    skippedBad: 0,
    errors: 0,
    byteOffset: 0,
    file: CDR_FILE,
  };

  if (!isMysqlEnabled()) {
    out.reason = 'MYSQL_DISABLED';
    return out;
  }
  const pool = getMysqlPool();
  if (!pool) {
    out.reason = 'NO_POOL';
    return out;
  }
  if (!existsSync(CDR_FILE)) {
    out.reason = 'CDR_FILE_MISSING';
    return out;
  }

  let fst;
  try {
    fst = statSync(CDR_FILE);
  } catch (e) {
    out.reason = String(e?.message || e);
    return out;
  }

  let state = loadState();
  if (state.inode != null && fst.ino != null && Number(state.inode) !== Number(fst.ino)) {
    state = { byteOffset: 0, partial: '', inode: fst.ino };
  }
  if (state.byteOffset > fst.size) {
    state.byteOffset = 0;
    state.partial = '';
  }

  let chunk;
  try {
    const fh = await open(CDR_FILE, 'r');
    try {
      const toRead = Math.max(0, fst.size - state.byteOffset);
      chunk = Buffer.alloc(toRead);
      if (toRead > 0) {
        await fh.read(chunk, 0, toRead, state.byteOffset);
      } else {
        chunk = Buffer.alloc(0);
      }
    } finally {
      await fh.close();
    }
  } catch (e) {
    out.reason = String(e?.message || e);
    return out;
  }

  const bytesRead = chunk.length;
  const text = state.partial + chunk.toString('utf8');
  const lines = text.split('\n');
  let partial = '';
  if (text.length > 0 && !text.endsWith('\n')) {
    partial = lines.pop() || '';
  }

  out.skipped = false;
  out.ok = true;
  const newOffset = state.byteOffset + bytesRead;
  const nums = Array.isArray(numbers) ? numbers : [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = parseCSVLine(line);
    const row = mapCdrCsvFields(fields);
    if (!row) {
      out.skippedBad += 1;
      continue;
    }

    const matched = matchNumberForDestination(row.dst, nums);
    if (!matched) {
      out.skippedNoMatch += 1;
      continue;
    }

    const billsec = Math.max(0, parseInt(String(row.billsec), 10) || 0);
    const status = String(row.disposition || '').toUpperCase() === 'ANSWERED' ? 'ANSWERED' : 'FAILED';
    const caller = String(row.src || '').slice(0, 64);
    const destination = String(row.dst || '').slice(0, 64);
    const dedup = rowDedupHash(fields);
    const cdrStart = parseCdrTimeToMysql(row.start);

    try {
      let result;
      if (cdrStart) {
        [result] = await pool.execute(
          `INSERT IGNORE INTO \`call_logs\` (\`caller\`, \`destination\`, \`duration\`, \`status\`, \`dedup_hash\`, \`cdr_start\`)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [caller, destination, billsec, status, dedup, cdrStart]
        );
      } else {
        [result] = await pool.execute(
          `INSERT IGNORE INTO \`call_logs\` (\`caller\`, \`destination\`, \`duration\`, \`status\`, \`dedup_hash\`)
           VALUES (?, ?, ?, ?, ?)`,
          [caller, destination, billsec, status, dedup]
        );
      }
      const ar = result?.affectedRows;
      if (ar === 1) out.inserted += 1;
      else out.duplicates += 1;
    } catch (e) {
      out.errors += 1;
      if (out.errors <= 5) {
        console.error('[cdr-sync] insert:', e?.message || e);
      }
    }
  }

  saveState({
    byteOffset: newOffset,
    partial,
    inode: fst.ino != null ? fst.ino : state.inode,
    lastRun: new Date().toISOString(),
    lastFileSize: fst.size,
  });

  out.byteOffset = newOffset;
  return out;
}
