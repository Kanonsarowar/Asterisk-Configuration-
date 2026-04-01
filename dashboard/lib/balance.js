import { readFileSync, existsSync } from 'fs';
import { mapCdrCsvFields, parseCSVLine, CDR_FILE } from './cdr.js';
import { getNumbers } from './numbers-service.js';

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

function normalizePaymentTerm(t) {
  const x = String(t || 'weekly').toLowerCase();
  if (x === 'monthly') return 'monthly';
  if (x === 'daily') return 'daily';
  return 'weekly';
}

/** Daily and weekly DIDs accrue in the weekly wallet; monthly in the monthly wallet. */
function walletKindForTerm(term) {
  return term === 'monthly' ? 'monthly' : 'weekly';
}

/** Native currency charge from CDR row + DID inventory. */
function nativeChargeForRow(row, numbers) {
  const matched = matchNumberForDst(row.dst, numbers);
  const rateNum = matched ? parseFloat(matched.rate) : 0;
  const rate = Number.isFinite(rateNum) && rateNum > 0 ? rateNum : 0;
  const billMin = (row.billsec || 0) / 60;
  const amt = billMin * rate;
  const rc = matched && String(matched.rateCurrency).toLowerCase() === 'eur' ? 'eur' : 'usd';
  const paymentTerm = normalizePaymentTerm(matched?.paymentTerm);
  return {
    usd: rc === 'usd' ? amt : 0,
    eur: rc === 'eur' ? amt : 0,
    paymentTerm,
  };
}

/** UTC week key: Monday 00:00:00.000 UTC. */
export function utcMondayYmdFromMs(ms) {
  const d = new Date(ms);
  const dow = d.getUTCDay();
  const daysFromMon = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMon);
  d.setUTCHours(0, 0, 0, 0);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function utcMsFromMondayYmd(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return NaN;
  return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
}

function utcSundayYmdAfterMonday(mondayYmd) {
  const ms = utcMsFromMondayYmd(mondayYmd);
  if (isNaN(ms)) return mondayYmd;
  const end = ms + 6 * 86400000;
  const dt = new Date(end);
  const y = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

/** First day of calendar month UTC: YYYY-MM-01 */
function utcMonthStartYmdFromMs(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function utcMonthEndYmdFromStart(monthStartYmd) {
  const [y, mo] = monthStartYmd.split('-').map(Number);
  const end = new Date(Date.UTC(y, mo, 0));
  const yy = end.getUTCFullYear();
  const mm = String(end.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(end.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addToMap(map, key, usd, eur) {
  const cur = map.get(key) || { usd: 0, eur: 0 };
  cur.usd += usd;
  cur.eur += eur;
  map.set(key, cur);
}

export function computeWalletAggregatesFromCdr(numbers) {
  const weekly = new Map();
  const monthly = new Map();
  let parsedRows = 0;
  if (!existsSync(CDR_FILE)) {
    return { weekly, monthly, parsedRows, cdrMissing: true, readError: false };
  }
  try {
    const raw = readFileSync(CDR_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      const fields = parseCSVLine(line);
      const row = mapCdrCsvFields(fields);
      if (!row) continue;
      const startMs = new Date(row.start).getTime();
      if (isNaN(startMs)) continue;
      parsedRows++;
      const { usd, eur, paymentTerm } = nativeChargeForRow(row, numbers);
      if (usd === 0 && eur === 0) continue;
      const kind = walletKindForTerm(paymentTerm);
      if (kind === 'weekly') {
        addToMap(weekly, utcMondayYmdFromMs(startMs), usd, eur);
      } else {
        addToMap(monthly, utcMonthStartYmdFromMs(startMs), usd, eur);
      }
    }
  } catch {
    return { weekly, monthly, parsedRows, cdrMissing: false, readError: true };
  }
  return { weekly, monthly, parsedRows, cdrMissing: false, readError: false };
}

function normalizeWeekSnap(s) {
  if (s == null) return { totalUsd: 0, totalEur: 0 };
  if (typeof s === 'number') return { totalUsd: s, totalEur: 0 };
  return {
    totalUsd: Number(s.totalUsd) || 0,
    totalEur: Number(s.totalEur) || 0,
  };
}

function sarFromUsdEur(usd, eur, eurPerUsd, sarPerUsd) {
  const e = Math.max(0, eurPerUsd);
  const s = Math.max(0, sarPerUsd);
  const eurToSar = e > 0 ? s / e : 0;
  return +(usd * s + eur * eurToSar).toFixed(6);
}

function packWalletRow(key, secondaryYmd, tot, eurPerUsd, sarPerUsd, isCurrent, period) {
  const usd = +((tot.usd || 0)).toFixed(6);
  const eur = +((tot.eur || 0)).toFixed(6);
  return {
    period,
    primaryKey: key,
    rangeEndUtc: secondaryYmd,
    totalUsd: usd,
    totalEur: eur,
    totalSar: sarFromUsdEur(usd, eur, eurPerUsd, sarPerUsd),
    isCurrent,
  };
}

export async function buildBalanceReport(store) {
  const numbers = await getNumbers(store);
  const cfg = store.getBalanceConfig();
  const { weekly, monthly, parsedRows, cdrMissing, readError } = computeWalletAggregatesFromCdr(numbers);

  const now = Date.now();
  const currentWeekKey = utcMondayYmdFromMs(now);
  const currentMonMs = utcMsFromMondayYmd(currentWeekKey);
  const currentMonthKey = utcMonthStartYmdFromMs(now);

  const weeklySnaps = { ...(cfg.weeklySnapshots || {}) };
  const monthlySnaps = { ...(cfg.monthlySnapshots || {}) };
  let snapshotsChanged = false;

  for (const [wk, tot] of weekly) {
    const wkm = utcMsFromMondayYmd(wk);
    if (isNaN(wkm) || wkm >= currentMonMs) continue;
    if (weeklySnaps[wk] == null) {
      weeklySnaps[wk] = { totalUsd: tot.usd, totalEur: tot.eur, savedAt: new Date().toISOString() };
      snapshotsChanged = true;
    }
  }

  for (const [mk, tot] of monthly) {
    if (mk >= currentMonthKey) continue;
    if (monthlySnaps[mk] == null) {
      monthlySnaps[mk] = { totalUsd: tot.usd, totalEur: tot.eur, savedAt: new Date().toISOString() };
      snapshotsChanged = true;
    }
  }

  if (snapshotsChanged) {
    store.updateBalanceConfig({ weeklySnapshots: weeklySnaps, monthlySnapshots: monthlySnaps });
  }

  const eurPerUsd = Math.max(0, parseFloat(cfg.eurPerUsd) || 0);
  const sarPerUsd = Math.max(0, parseFloat(cfg.sarPerUsd) || 0);

  function mergeWeek(key) {
    const fromCdr = weekly.get(key) || { usd: 0, eur: 0 };
    if (key === currentWeekKey) return { usd: fromCdr.usd, eur: fromCdr.eur };
    if (fromCdr.usd > 0 || fromCdr.eur > 0) return { usd: fromCdr.usd, eur: fromCdr.eur };
    const sn = normalizeWeekSnap(weeklySnaps[key]);
    return { usd: sn.totalUsd, eur: sn.totalEur };
  }

  function mergeMonth(key) {
    const fromCdr = monthly.get(key) || { usd: 0, eur: 0 };
    if (key === currentMonthKey) return { usd: fromCdr.usd, eur: fromCdr.eur };
    if (fromCdr.usd > 0 || fromCdr.eur > 0) return { usd: fromCdr.usd, eur: fromCdr.eur };
    const sn = normalizeWeekSnap(monthlySnaps[key]);
    return { usd: sn.totalUsd, eur: sn.totalEur };
  }

  const weeklyHistory = [];
  let wMs = currentMonMs;
  for (let i = 0; i < 52; i++) {
    const key = utcMondayYmdFromMs(wMs);
    const tot = mergeWeek(key);
    weeklyHistory.push(
      packWalletRow(
        key,
        utcSundayYmdAfterMonday(key),
        tot,
        eurPerUsd,
        sarPerUsd,
        key === currentWeekKey,
        'week'
      )
    );
    wMs -= 7 * 86400000;
  }

  const monthlyHistory = [];
  const [cy, cm] = currentMonthKey.split('-').map(Number);
  let y = cy;
  let m = cm;
  for (let i = 0; i < 24; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}-01`;
    const tot = mergeMonth(key);
    monthlyHistory.push(
      packWalletRow(
        key,
        utcMonthEndYmdFromStart(key),
        tot,
        eurPerUsd,
        sarPerUsd,
        key === currentMonthKey,
        'month'
      )
    );
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  const curWeekTot = mergeWeek(currentWeekKey);
  const curMonthTot = mergeMonth(currentMonthKey);

  return {
    ok: true,
    cdrMissing,
    readError: !!readError,
    parsedRows,
    weekBoundsNote: 'Weekly wallet: UTC Monday 00:00 – Sunday 23:59. Includes payment terms Weekly and Daily. Monthly wallet: calendar month UTC.',
    config: {
      eurPerUsd: cfg.eurPerUsd,
      sarPerUsd: cfg.sarPerUsd,
    },
    weeklyWallet: {
      current: packWalletRow(
        currentWeekKey,
        utcSundayYmdAfterMonday(currentWeekKey),
        curWeekTot,
        eurPerUsd,
        sarPerUsd,
        true,
        'week'
      ),
      weeks: weeklyHistory,
    },
    monthlyWallet: {
      current: packWalletRow(
        currentMonthKey,
        utcMonthEndYmdFromStart(currentMonthKey),
        curMonthTot,
        eurPerUsd,
        sarPerUsd,
        true,
        'month'
      ),
      months: monthlyHistory,
    },
  };
}
