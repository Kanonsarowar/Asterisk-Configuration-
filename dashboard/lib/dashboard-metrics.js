/**
 * Dashboard KPIs from Asterisk CDR CSV + DID inventory (rates).
 * Uses same parsing as cdr.js (Master.csv).
 * @param {unknown[]} numbers Resolved DID list (from JSON store or MySQL).
 */
import { readFileSync, existsSync } from 'fs';
import { CDR_FILE, parseCSVLine, mapCdrCsvFields } from './cdr.js';

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function fullNumberDigits(n) {
  return digitsOnly(n.countryCode) + digitsOnly(n.prefix) + digitsOnly(n.extension);
}

function matchNumberForDst(dst, numbers) {
  const d = digitsOnly(dst);
  if (!d || !Array.isArray(numbers)) return null;
  let best = null;
  let bestLen = 0;
  for (const n of numbers) {
    const fn = fullNumberDigits(n);
    if (!fn) continue;
    if (d === fn) return n;
    if (d.length >= fn.length && d.endsWith(fn) && fn.length > bestLen) {
      best = n;
      bestLen = fn.length;
    }
  }
  return best;
}

function parseRate(n) {
  const r = parseFloat(n?.rate);
  return isFinite(r) && r >= 0 ? r : 0;
}

function revenueForCall(billsec, num) {
  const sec = Math.max(0, parseInt(billsec, 10) || 0);
  if (!sec || !num) return 0;
  const rate = parseRate(num);
  return (sec / 60) * rate;
}

export function computeDashboardMetrics(numbersIn) {
  const numbers = Array.isArray(numbersIn) ? numbersIn : [];
  const empty = {
    revenueToday: 0,
    revenueMonth: 0,
    asrGlobal: 0,
    acdGlobal: 0,
    topCountry: { code: '—', revenue: 0 },
    worstRoute: { context: '—', asr: 100, calls: 0 },
    liveCps: 0,
    windows: { todayStart: 0, monthStart: 0, cpsWindowSec: 60 },
  };

  if (!existsSync(CDR_FILE)) return empty;

  const now = Date.now();
  const d = new Date();
  const todayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
  const cpsWindowMs = 60_000;
  const cpsCutoff = now - cpsWindowMs;

  let raw;
  try {
    raw = readFileSync(CDR_FILE, 'utf8');
  } catch {
    return empty;
  }

  const lines = raw.trim().split('\n').filter(Boolean);
  let revToday = 0;
  let revMonth = 0;
  /** Month-to-date ASR/ACD ("global" in UI) */
  let monthTotalCalls = 0;
  let monthAnswered = 0;
  let monthBillsecAnswered = 0;

  const byCountry = {};
  const byContext = {};

  let callsLast60 = 0;

  const ancientCutoff = todayStart - 86400000 * 400;

  for (const line of lines) {
    const fields = parseCSVLine(line);
    const row = mapCdrCsvFields(fields);
    if (!row) continue;
    const startTime = new Date(row.start).getTime();
    if (isNaN(startTime)) continue;

    const ctx = String(row.dcontext || '').trim() || 'unknown';
    if (!byContext[ctx]) {
      byContext[ctx] = { total: 0, answered: 0 };
    }
    byContext[ctx].total += 1;
    if (row.disposition === 'ANSWERED') {
      byContext[ctx].answered += 1;
    }

    if (startTime >= cpsCutoff) {
      callsLast60 += 1;
    }

    if (startTime < ancientCutoff) continue;

    const matched = matchNumberForDst(row.dst, numbers);
    const rev = revenueForCall(row.billsec, matched);

    if (startTime >= todayStart && startTime <= now) {
      revToday += rev;

      const cc = matched?.country || 'XX';
      if (!byCountry[cc]) byCountry[cc] = 0;
      byCountry[cc] += rev;
    }

    if (startTime >= monthStart && startTime <= now) {
      revMonth += rev;
      monthTotalCalls += 1;
      if (row.disposition === 'ANSWERED') {
        monthAnswered += 1;
        monthBillsecAnswered += Math.max(0, parseInt(row.billsec, 10) || 0);
      }
    }
  }

  const asrGlobal = monthTotalCalls
    ? +((monthAnswered / monthTotalCalls) * 100).toFixed(1)
    : 0;
  const acdGlobal = monthAnswered ? Math.round(monthBillsecAnswered / monthAnswered) : 0;

  let topCode = '—';
  let topRev = 0;
  for (const [code, r] of Object.entries(byCountry)) {
    if (r > topRev) {
      topRev = r;
      topCode = code;
    }
  }

  let worst = { context: '—', asr: 100, calls: 0 };
  for (const [ctx, v] of Object.entries(byContext)) {
    if (v.total < 5) continue;
    const asr = (v.answered / v.total) * 100;
    if (asr < 20 && (worst.context === '—' || asr < worst.asr)) {
      worst = { context: ctx, asr: +asr.toFixed(1), calls: v.total };
    }
  }
  if (worst.context === '—') {
    let minAsr = 100;
    for (const [ctx, v] of Object.entries(byContext)) {
      if (v.total < 3) continue;
      const asr = (v.answered / v.total) * 100;
      if (asr < minAsr) {
        minAsr = asr;
        worst = { context: ctx, asr: +asr.toFixed(1), calls: v.total };
      }
    }
    if (worst.context === '—') worst = { context: '—', asr: 0, calls: 0 };
  }

  const liveCps = +(callsLast60 / 60).toFixed(2);

  return {
    revenueToday: +revToday.toFixed(2),
    revenueMonth: +revMonth.toFixed(2),
    asrGlobal,
    acdGlobal,
    topCountry: { code: topCode, revenue: +topRev.toFixed(2) },
    worstRoute: worst,
    liveCps,
    windows: { todayStart, monthStart, cpsWindowSec: 60 },
  };
}
