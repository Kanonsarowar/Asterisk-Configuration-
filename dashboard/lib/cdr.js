import { readFileSync, existsSync } from 'fs';

const CDR_FILE = '/var/log/asterisk/cdr-csv/Master.csv';

export function getCdrStats(hours = 24) {
  if (!existsSync(CDR_FILE)) {
    return { totalCalls: 0, answeredCalls: 0, failedCalls: 0, totalDuration: 0, avgDuration: 0, callsPerMinute: 0, byPrefix: {}, bySupplier: {}, recentCalls: [] };
  }

  try {
    const raw = readFileSync(CDR_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const cutoff = Date.now() - hours * 3600000;
    const calls = [];

    for (const line of lines) {
      const fields = parseCSVLine(line);
      if (fields.length < 16) continue;
      const startTime = new Date(fields[9]?.replace(/"/g, '')).getTime();
      if (isNaN(startTime) || startTime < cutoff) continue;

      const src = fields[1]?.replace(/"/g, '') || '';
      const dst = fields[2]?.replace(/"/g, '') || '';
      const channel = fields[0]?.replace(/"/g, '') || '';
      const ipMatch = channel.match(/(\d+\.\d+\.\d+\.\d+)/);
      calls.push({
        src,
        dst,
        context: fields[4]?.replace(/"/g, '') || '',
        duration: parseInt(fields[12]?.replace(/"/g, '')) || 0,
        billsec: parseInt(fields[13]?.replace(/"/g, '')) || 0,
        disposition: fields[14]?.replace(/"/g, '') || '',
        start: fields[9]?.replace(/"/g, '') || '',
        channel,
        sourceIp: ipMatch ? ipMatch[1] : '',
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
      byHour,
      recentCalls: calls.slice(-50).reverse()
    };
  } catch {
    return { totalCalls: 0, answeredCalls: 0, failedCalls: 0, totalDuration: 0, avgDuration: 0, callsPerMinute: 0, asr: 0, acd: 0, byHour: {}, recentCalls: [] };
  }
}

function parseCSVLine(line) {
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
