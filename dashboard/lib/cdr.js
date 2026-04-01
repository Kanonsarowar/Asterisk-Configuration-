import { readFileSync, existsSync } from 'fs';

export const CDR_FILE = '/var/log/asterisk/cdr-csv/Master.csv';

/**
 * Asterisk cdr-csv Master.csv column order:
 * accountcode,src,dst,dcontext,clid,channel,dstchannel,lastapp,lastdata,start,answer,end,duration,billsec,disposition,amaflags,...
 */
export function mapCdrCsvFields(fields) {
  if (fields.length < 15) return null;
  const strip = (i) => (fields[i] || '').replace(/"/g, '').trim();
  const acct = strip(0).toLowerCase();
  if (acct === 'accountcode' || acct === 'account') return null;

  const startRaw = strip(9);
  if (!startRaw || startRaw.toLowerCase() === 'start') return null;

  const channel = strip(5);
  const ipMatch = channel.match(/(\d+\.\d+\.\d+\.\d+)/);

  return {
    accountcode: strip(0),
    src: strip(1),
    dst: strip(2),
    dcontext: strip(3),
    clid: strip(4),
    channel,
    sourceIp: ipMatch ? ipMatch[1] : '',
    start: startRaw,
    duration: parseInt(strip(12), 10) || 0,
    billsec: parseInt(strip(13), 10) || 0,
    disposition: strip(14),
  };
}

export function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; current += ch; }
    else if (ch === ',' && !inQuotes) { fields.push(current); current = ''; }
    else { current += ch; }
  }
  fields.push(current);
  return fields;
}

function parseLocalDayStart(ymd) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function parseLocalDayEnd(ymd) {
  const parts = String(ymd || '').split('-').map(Number);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  const [y, m, d] = parts;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

export function getCdrStats(hours = 24) {
  if (!existsSync(CDR_FILE)) {
    return { totalCalls: 0, answeredCalls: 0, failedCalls: 0, totalDuration: 0, avgDuration: 0, callsPerMinute: 0, byPrefix: {}, bySupplier: {}, recentCalls: [], asr: 0, acd: 0, byHour: {} };
  }

  try {
    const raw = readFileSync(CDR_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const cutoff = Date.now() - hours * 3600000;
    const calls = [];

    for (const line of lines) {
      const fields = parseCSVLine(line);
      const row = mapCdrCsvFields(fields);
      if (!row) continue;
      const startTime = new Date(row.start).getTime();
      if (isNaN(startTime) || startTime < cutoff) continue;

      calls.push({
        src: row.src,
        dst: row.dst,
        context: row.dcontext,
        duration: row.duration,
        billsec: row.billsec,
        disposition: row.disposition,
        start: row.start,
        channel: row.channel,
        sourceIp: row.sourceIp,
      });
    }

    const answered = calls.filter(c => c.disposition === 'ANSWERED');
    const failed = calls.filter(c => c.disposition !== 'ANSWERED');
    const totalDuration = answered.reduce((s, c) => s + c.billsec, 0);
    const spanMinutes = Math.max(1, (Date.now() - cutoff) / 60000);

    const byHour = {};
    for (const c of calls) {
      const h = c.start.substring(0, 13);
      byHour[h] = (byHour[h] || 0) + 1;
    }

    return {
      totalCalls: calls.length,
      answeredCalls: answered.length,
      failedCalls: failed.length,
      totalDuration,
      avgDuration: answered.length ? Math.round(totalDuration / answered.length) : 0,
      callsPerMinute: +(calls.length / spanMinutes).toFixed(2),
      asr: calls.length ? +((answered.length / calls.length) * 100).toFixed(1) : 0,
      acd: answered.length ? Math.round(totalDuration / answered.length) : 0,
      byPrefix: {},
      bySupplier: {},
      byHour,
      recentCalls: calls.slice(-50).reverse()
    };
  } catch {
    return { totalCalls: 0, answeredCalls: 0, failedCalls: 0, totalDuration: 0, avgDuration: 0, callsPerMinute: 0, asr: 0, acd: 0, byPrefix: {}, bySupplier: {}, byHour: {}, recentCalls: [] };
  }
}

/** Full CDR list for history UI (newest first). Optional dateFrom/dateTo: YYYY-MM-DD (local). */
export function getCdrHistory(hours = 168, limit = 500, opts = {}) {
  if (!existsSync(CDR_FILE)) {
    return { ok: true, calls: [], total: 0, file: CDR_FILE, message: 'CDR file not found' };
  }
  try {
    const raw = readFileSync(CDR_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);

    let fromMs = Date.now() - hours * 3600000;
    let toMs = Date.now();
    if (opts.dateFrom) {
      const t = parseLocalDayStart(opts.dateFrom);
      if (t != null) fromMs = t;
    }
    if (opts.dateTo) {
      const t = parseLocalDayEnd(opts.dateTo);
      if (t != null) toMs = Math.min(t, Date.now());
    }
    if (fromMs > toMs) {
      const x = fromMs;
      fromMs = toMs;
      toMs = x;
    }

    const calls = [];

    for (const line of lines) {
      const fields = parseCSVLine(line);
      const row = mapCdrCsvFields(fields);
      if (!row) continue;

      const startTime = new Date(row.start).getTime();
      if (isNaN(startTime) || startTime < fromMs || startTime > toMs) continue;

      calls.push({
        src: row.src,
        dst: row.dst,
        context: row.dcontext,
        duration: row.duration,
        billsec: row.billsec,
        disposition: row.disposition,
        start: row.start,
        channel: row.channel,
        sourceIp: row.sourceIp,
      });
    }

    calls.sort((a, b) => new Date(b.start) - new Date(a.start));
    const total = calls.length;
    const cap = Math.min(Math.max(1, limit), 5000);
    return { ok: true, calls: calls.slice(0, cap), total, file: CDR_FILE };
  } catch (e) {
    return { ok: false, calls: [], total: 0, error: String(e.message || e) };
  }
}
