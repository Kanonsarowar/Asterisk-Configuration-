/**
 * Call Statistics Pro — aggregates from MySQL `call_logs` + DID inventory match (no DB schema change).
 * Joins are done in JS: `call_logs` has caller/destination, not number_id/supplier_id/revenue columns.
 */
import { fullNumberDigits, rowToApp } from './numbers-mysql.js';

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function toAppNumberShape(n) {
  if (!n) return null;
  if (n.countryCode !== undefined && n.prefix !== undefined) return n;
  return rowToApp(n);
}

export function matchNumberForDestination(dst, numbers) {
  const d = digitsOnly(dst);
  if (!d || !Array.isArray(numbers)) return null;
  let best = null;
  let bestLen = 0;
  for (const raw of numbers) {
    const n = toAppNumberShape(raw);
    if (!n) continue;
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

function revenueForDurationSec(sec, num) {
  const s = Math.max(0, parseInt(sec, 10) || 0);
  if (!s || !num) return 0;
  return (s / 60) * parseRate(num);
}

function isAnsweredStatus(status) {
  return String(status || '').trim().toUpperCase() === 'ANSWERED';
}

function rowTimeMs(row) {
  const t = row.cdr_start != null ? row.cdr_start : row.created_at;
  if (t instanceof Date) return t.getTime();
  const n = new Date(t).getTime();
  return isNaN(n) ? 0 : n;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {number} hoursWindow e.g. 24
 */
export async function fetchCallLogsInHours(pool, hoursWindow) {
  const h = Math.min(168, Math.max(1, parseInt(String(hoursWindow), 10) || 24));
  const spanHours = h * 2;
  const [rows] = await pool.query(
    `SELECT \`caller\`, \`destination\`, \`duration\`, \`status\`, \`created_at\`, \`cdr_start\`
     FROM \`call_logs\`
     WHERE COALESCE(\`cdr_start\`, \`created_at\`) >= DATE_SUB(NOW(), INTERVAL ? HOUR)`,
    [spanHours]
  );
  return { rows, hoursWindow: h };
}

/**
 * @param {any[]} rows from fetchCallLogsInHours
 * @param {unknown[]} numbers normalized app numbers (countryCode, prefix, extension, rate, supplierId, …)
 * @param {{ id: number, name?: string }[]} suppliers from store
 */
export function aggregateCallLogsPro(rows, numbers, suppliers, hoursWindow) {
  const now = Date.now();
  const h = hoursWindow;
  const currStart = now - h * 3600000;
  const prevStart = now - 2 * h * 3600000;
  const prevEnd = currStart;

  const supplierNameById = new Map();
  for (const s of suppliers || []) {
    if (s && s.id != null) supplierNameById.set(Number(s.id), String(s.name || `Supplier ${s.id}`));
  }

  const appNums = Array.isArray(numbers) ? numbers.map(toAppNumberShape).filter(Boolean) : [];

  let totalCurr = 0;
  let answeredCurr = 0;
  let failedCurr = 0;
  let durAnsweredCurr = 0;
  let revenueCurr = 0;
  let totalDurationCurr = 0;

  let totalPrev = 0;
  let answeredPrev = 0;

  const byPrefix = {};
  const bySupplier = {};
  const byStatus = {};
  const byCli = { KSA: { calls: 0, answered: 0 }, INTL: { calls: 0, answered: 0 } };

  for (const row of rows) {
    const t = rowTimeMs(row);
    if (!t) continue;
    const inCurr = t >= currStart;
    const inPrev = t >= prevStart && t < prevEnd;
    if (!inCurr && !inPrev) continue;

    const dest = row.destination;
    const matched = matchNumberForDestination(dest, appNums);
    const prefix = matched?.prefix ? String(matched.prefix) : '—';
    const supIdRaw = matched?.supplierId ?? matched?.supplier_id;
    const supId = supIdRaw !== undefined && supIdRaw !== '' ? Number(supIdRaw) : NaN;
    const supName = !isNaN(supId) && supplierNameById.has(supId)
      ? supplierNameById.get(supId)
      : (!isNaN(supId) ? `ID ${supId}` : '—');

    const dur = row.duration != null ? parseInt(String(row.duration), 10) : 0;
    const sec = Math.max(0, isFinite(dur) ? dur : 0);
    const ans = isAnsweredStatus(row.status);

    if (inPrev) {
      totalPrev += 1;
      if (ans) answeredPrev += 1;
    }

    if (inCurr) {
      totalCurr += 1;
      totalDurationCurr += sec;
      if (ans) {
        answeredCurr += 1;
        durAnsweredCurr += sec;
      } else {
        failedCurr += 1;
      }

      revenueCurr += revenueForDurationSec(sec, matched);

      const st = String(row.status || 'unknown').trim() || 'unknown';
      byStatus[st] = (byStatus[st] || 0) + 1;

      if (!byPrefix[prefix]) {
        byPrefix[prefix] = { prefix, calls: 0, answered: 0, durationSum: 0, revenue: 0 };
      }
      byPrefix[prefix].calls += 1;
      if (ans) {
        byPrefix[prefix].answered += 1;
        byPrefix[prefix].durationSum += sec;
      }
      byPrefix[prefix].revenue += revenueForDurationSec(sec, matched);

      const sk = supName;
      if (!bySupplier[sk]) {
        bySupplier[sk] = { name: sk, calls: 0, answered: 0, durationSum: 0 };
      }
      bySupplier[sk].calls += 1;
      if (ans) {
        bySupplier[sk].answered += 1;
        bySupplier[sk].durationSum += sec;
      }

      const cli = digitsOnly(row.caller || '');
      const bucket = cli.startsWith('966') ? 'KSA' : 'INTL';
      byCli[bucket].calls += 1;
      if (ans) byCli[bucket].answered += 1;
    }
  }

  const asrCurr = totalCurr ? (answeredCurr / totalCurr) * 100 : 0;
  const asrPrev = totalPrev ? (answeredPrev / totalPrev) * 100 : null;
  const acdCurr = answeredCurr ? durAnsweredCurr / answeredCurr : 0;

  const prefixRows = Object.values(byPrefix)
    .map((p) => {
      const asr = p.calls ? (p.answered / p.calls) * 100 : 0;
      const acd = p.answered ? p.durationSum / p.answered : 0;
      return {
        prefix: p.prefix,
        calls: p.calls,
        asr: +asr.toFixed(1),
        acd: +acd.toFixed(1),
        revenue: +p.revenue.toFixed(4),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const supplierRows = Object.values(bySupplier)
    .map((s) => {
      const asr = s.calls ? (s.answered / s.calls) * 100 : 0;
      const acd = s.answered ? s.durationSum / s.answered : 0;
      return {
        name: s.name,
        calls: s.calls,
        asr: +asr.toFixed(1),
        acd: +acd.toFixed(1),
      };
    })
    .sort((a, b) => b.calls - a.calls);

  const failureRows = Object.entries(byStatus)
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const cliRows = ['KSA', 'INTL'].map((cli_type) => {
    const x = byCli[cli_type];
    const asr = x.calls ? (x.answered / x.calls) * 100 : 0;
    return { cli_type, calls: x.calls, asr: +asr.toFixed(1) };
  });

  const spanMinutes = Math.max(1, h * 60);
  const callsPerMinute = +(totalCurr / spanMinutes).toFixed(2);

  return {
    summary: {
      total_calls: totalCurr,
      answered: answeredCurr,
      failed: failedCurr,
      acd: +acdCurr.toFixed(2),
      total_duration: totalDurationCurr,
      revenue: +revenueCurr.toFixed(4),
      asr: +asrCurr.toFixed(2),
      calls_per_minute: callsPerMinute,
      hours: h,
      previous_asr: asrPrev != null ? +asrPrev.toFixed(2) : null,
      asr_drop:
        asrPrev != null && totalPrev >= 5 ? +Math.max(0, asrPrev - asrCurr).toFixed(2) : null,
    },
    prefix: prefixRows,
    supplier: supplierRows,
    failures: failureRows,
    cli: cliRows,
  };
}

/**
 * Recent rows for Call Statistics table (MySQL), with DID match for prefix / supplier label.
 */
export async function fetchCallLogsRecentForUi(pool, numbers, suppliers, hours, limit) {
  const h = Math.min(168, Math.max(1, parseInt(String(hours), 10) || 24));
  const lim = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 50));
  const supplierNameById = new Map();
  for (const s of suppliers || []) {
    if (s && s.id != null) supplierNameById.set(Number(s.id), String(s.name || `Supplier ${s.id}`));
  }
  const appNums = Array.isArray(numbers) ? numbers.map(toAppNumberShape).filter(Boolean) : [];

  const [rows] = await pool.query(
    `SELECT \`caller\`, \`destination\`, \`duration\`, \`status\`,
            COALESCE(\`cdr_start\`, \`created_at\`) AS \`ts\`
     FROM \`call_logs\`
     WHERE COALESCE(\`cdr_start\`, \`created_at\`) >= DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY COALESCE(\`cdr_start\`, \`created_at\`) DESC
     LIMIT ?`,
    [h, lim]
  );

  const list = rows || [];
  return list.map((r) => {
    const dst = r.destination;
    const matched = matchNumberForDestination(dst, appNums);
    const supIdRaw = matched?.supplierId ?? matched?.supplier_id;
    const supId = supIdRaw !== undefined && supIdRaw !== '' ? Number(supIdRaw) : NaN;
    let supplierName = '—';
    if (!isNaN(supId) && supplierNameById.has(supId)) supplierName = supplierNameById.get(supId);
    else if (!isNaN(supId)) supplierName = `ID ${supId}`;

    const dstr = String(dst || '');
    const prefix = matched?.prefix
      ? String(matched.prefix)
      : (dstr.length > 4 ? dstr.substring(0, dstr.length - 4) : dstr);

    const disp = String(r.status || '').toUpperCase() === 'ANSWERED' ? 'ANSWERED' : String(r.status || 'UNKNOWN');
    return {
      src: String(r.caller || ''),
      dst: dstr,
      billsec: Math.max(0, parseInt(String(r.duration), 10) || 0),
      disposition: disp,
      prefix,
      supplierName,
      source: 'mysql',
    };
  });
}
