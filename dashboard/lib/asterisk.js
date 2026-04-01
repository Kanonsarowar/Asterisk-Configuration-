import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const AST_CMD = 'sudo asterisk -rx';

async function runCmd(cmd) {
  try {
    const { stdout, stderr } = await execAsync(`${AST_CMD} "${cmd}"`, { timeout: 10000 });
    return { ok: true, output: stdout.trim(), error: stderr.trim() };
  } catch (err) {
    return { ok: false, output: '', error: err.message };
  }
}

export async function getStatus() {
  const [version, uptime, channels, sysinfo] = await Promise.all([
    runCmd('core show version'),
    runCmd('core show uptime'),
    runCmd('core show channels'),
    runCmd('core show sysinfo')
  ]);

  let channelCount = 0;
  let callCount = 0;
  if (channels.ok) {
    const lines = channels.output.split('\n');
    for (const line of lines) {
      const activeMatch = line.match(/(\d+)\s+active channel/);
      const callMatch = line.match(/(\d+)\s+active call/);
      if (activeMatch) channelCount = parseInt(activeMatch[1]);
      if (callMatch) callCount = parseInt(callMatch[1]);
    }
  }

  let uptimeStr = 'Unknown';
  let reloadStr = 'Unknown';
  if (uptime.ok) {
    const lines = uptime.output.split('\n');
    for (const line of lines) {
      if (line.includes('System uptime:')) uptimeStr = line.split('System uptime:')[1].trim();
      if (line.includes('Last reload:')) reloadStr = line.split('Last reload:')[1].trim();
    }
  }

  let totalRam = 0, freeRam = 0, processCount = 0;
  if (sysinfo.ok) {
    const lines = sysinfo.output.split('\n');
    for (const line of lines) {
      const ramTotal = line.match(/Total RAM:\s+(\d+)/);
      const ramFree = line.match(/Free RAM:\s+(\d+)/);
      const procs = line.match(/Number of Processes:\s+(\d+)/);
      if (ramTotal) totalRam = parseInt(ramTotal[1]);
      if (ramFree) freeRam = parseInt(ramFree[1]);
      if (procs) processCount = parseInt(procs[1]);
    }
  }

  return {
    version: version.ok ? version.output : 'Not Running',
    running: version.ok,
    uptime: uptimeStr,
    lastReload: reloadStr,
    activeChannels: channelCount,
    activeCalls: callCount,
    totalRamMB: Math.round(totalRam / 1024),
    freeRamMB: Math.round(freeRam / 1024),
    processCount
  };
}

function secToHms(secStr) {
  const s = Math.max(0, parseInt(String(secStr), 10) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Asterisk concise: Channel!Context!Exten!Priority!State!App!AppData!CallerID!...!Duration!... */
function parseConciseChannels(text) {
  const calls = [];
  const lines = String(text || '').split('\n').map(s => s.trim()).filter(Boolean);
  for (const line of lines) {
    if (/active channels?/i.test(line) || /calls processed/i.test(line)) continue;
    const delim = line.includes('!') ? '!' : (line.includes('|') ? '|' : '');
    if (!delim) continue;
    const p = line.split(delim);
    if (p.length < 8) continue;
    const channel = p[0] || '';
    const context = p[1] || '';
    const exten = p[2] || '';
    const state = p[4] || '';
    const callerid = p[7] || '';
    // Concise field order varies by version; duration often last numeric before uniqueid
    let duration = '';
    if (p.length > 11 && /^\d+$/.test(p[11]) && Number(p[11]) < 86400) duration = secToHms(p[11]);
    else if (p.length > 10 && /^\d+$/.test(p[10]) && Number(p[10]) < 86400) duration = secToHms(p[10]);
    else duration = p[10] || p[11] || '';
    const bridgedTo = p[12] || p[11] || '';
    const endpoint = channel.startsWith('PJSIP/')
      ? channel.substring(6).replace(/-[0-9a-f]+$/i, '')
      : '';

    calls.push({
      channel,
      endpoint,
      context,
      exten,
      state,
      callerid,
      duration,
      bridgedTo,
      destinationNumber: ''
    });
  }
  return calls;
}

/** Fallback when concise is empty or unparsable — matches PJSIP/... lines from verbose table */
function parseVerboseChannels(text) {
  const calls = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.includes('Channel') && t.includes('Context')) continue;
    if (/^\d+\s+active channels?/i.test(t)) break;
    if (!/^(PJSIP\/|Local\/|SIP\/)/.test(t)) continue;
    const parts = t.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 5) continue;
    const channel = parts[0];
    const context = parts[1] || '';
    const exten = parts[2] || '';
    const state = parts[4] || '';
    const durMatch = t.match(/\d{2}:\d{2}:\d{2}/);
    const duration = durMatch ? durMatch[0] : '';
    const cidMatch = t.match(/\b\d{8,15}\b/);
    const callerid = cidMatch ? cidMatch[0] : '';
    const endpoint = channel.startsWith('PJSIP/')
      ? channel.substring(6).replace(/-[0-9a-f]+$/i, '')
      : '';
    calls.push({
      channel,
      endpoint,
      context,
      exten,
      state,
      callerid,
      duration,
      bridgedTo: '',
      destinationNumber: ''
    });
  }
  return calls;
}

/** Read __INBOUND_DID set in did-routing before Goto IVR (EXTEN in ivr-* is "s", not the DID). */
function parseDurationFromShowChannel(text) {
  const s = String(text || '');
  const m = s.match(/Duration\s*:\s*(\d+:\d{2}:\d{2})/i);
  if (m) return m[1];
  const mU = s.match(/(?:Channel\s+)?[Uu]ptime\s*:\s*(\d+:\d{2}:\d{2})/i);
  if (mU) return mU[1];
  const m2 = s.match(/Duration\s*:\s*(\d+)\s*s/i);
  if (m2) return secToHms(m2[1]);
  return '';
}

function parseInboundDidFromShowChannel(text) {
  const s = String(text || '');
  const patterns = [
    /__INBOUND_DID\s*[=:]\s*(\d+)/i,
    /INBOUND_DID\s*[=:]\s*(\d+)/i,
    /Variable:\s*__INBOUND_DID[\s\S]*?Value:\s*(\d+)/i,
    /Variable:\s*INBOUND_DID[\s\S]*?Value:\s*(\d+)/i,
    /DNID\s*[=:]\s*(\d+)/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return '';
}

async function enrichCallsDestination(calls) {
  const list = Array.isArray(calls) ? calls : [];
  const tasks = list.map(async (c) => {
    const ch = c.channel || '';
    if (!ch) return { ...c, destinationNumber: c.exten || '', duration: c.duration || '' };
    const detail = await runCmd(`core show channel ${ch.replace(/"/g, '')}`);
    const inbound = detail.ok ? parseInboundDidFromShowChannel(detail.output) : '';
    const destinationNumber = inbound || c.exten || '';
    const fromDetail = detail.ok ? parseDurationFromShowChannel(detail.output) : '';
    const duration = fromDetail || c.duration || '';
    return { ...c, destinationNumber, duration };
  });
  return Promise.all(tasks);
}

export async function getChannels() {
  const concise = await runCmd('core show channels concise');
  let calls = parseConciseChannels(concise.ok ? concise.output : '');

  // Only run verbose when concise did not yield rows (saves one slow CLI round-trip).
  let verbose = { ok: false, output: '' };
  if (!calls.length) {
    verbose = await runCmd('core show channels verbose');
    calls = parseVerboseChannels(verbose.ok ? verbose.output : '');
  }

  calls = await enrichCallsDestination(calls);

  const output = (verbose.ok && verbose.output)
    ? verbose.output
    : (concise.ok ? concise.output : '');

  return {
    ok: concise.ok || verbose.ok,
    output: output || '',
    calls
  };
}

export async function reloadDialplan() {
  return runCmd('dialplan reload');
}

export async function reloadPjsip() {
  return runCmd('module reload res_pjsip.so');
}

export async function reloadAll() {
  const dp = await reloadDialplan();
  const pj = await reloadPjsip();
  const acl = await runCmd('module reload acl');
  const fo = await runCmd('module reload func_odbc.so');
  return { dialplan: dp, pjsip: pj, acl, funcOdbc: fo };
}

export async function getPjsipStatus() {
  const [endpoints, identifies] = await Promise.all([
    runCmd('pjsip show endpoints'),
    runCmd('pjsip show identifies')
  ]);
  return { endpoints, identifies };
}

export async function getDialplanContext(context) {
  return runCmd(`dialplan show ${context}`);
}

export async function getLoadedModules() {
  const result = await runCmd('module show');
  if (!result.ok) return { count: 0 };
  const lastLine = result.output.split('\n').pop();
  const match = lastLine.match(/(\d+)\s+modules loaded/);
  return { count: match ? parseInt(match[1]) : 0 };
}

export async function getPjsipEndpoints() {
  return runCmd('pjsip show endpoints');
}

/**
 * Parse `pjsip show contacts` into Avail / Unavail (and unknown) for dashboard.
 */
/**
 * Outbound test/originate for tenant call generator. Set TENANT_ORIGINATE_CMD e.g.
 *   channel originate Local/7001@from-internal application Dial PJSIP/{DEST}@your-endpoint
 * Placeholders: {DEST} (required), {FROM} (optional — your assigned DID, for logging/custom dialplan).
 */
export async function originateFromEnv(placeholders) {
  let cmd = (process.env.TENANT_ORIGINATE_CMD || '').trim();
  if (!cmd) {
    return { ok: false, code: 'NOT_CONFIGURED', error: 'Set TENANT_ORIGINATE_CMD in the dashboard environment' };
  }
  const safe = {};
  for (const [k, v] of Object.entries(placeholders || {})) {
    const d = String(v || '').replace(/[^\d+]/g, '');
    safe[String(k).toUpperCase()] = d;
  }
  for (const key of Object.keys(safe)) {
    cmd = cmd.split(`{${key}}`).join(safe[key]);
  }
  if (!/^channel originate /i.test(cmd)) {
    return { ok: false, error: 'TENANT_ORIGINATE_CMD must start with "channel originate "' };
  }
  return runCmd(cmd);
}

export async function getPjsipContactsSummary() {
  const raw = await runCmd('pjsip show contacts');
  if (!raw.ok) {
    return { ok: false, error: raw.error, contacts: [] };
  }
  const contacts = [];
  for (const line of raw.output.split('\n')) {
    const t = line.trim();
    if (!t || /^Contact:/i.test(t) && t.length < 12) continue;
    if (/^Objects found:/i.test(t)) break;
    const avail = /\bAvail\b/i.test(t) && !/Unavail/i.test(t);
    const unavail = /\bUnavail/i.test(t);
    const m = t.match(/Contact:\s*(\S+)/i) || t.match(/\s+(\S+@\S+)\s+/);
    const uri = m ? m[1] : t.split(/\s+/)[0] || '';
    if (!uri || uri === 'Contact:') continue;
    let state = 'unknown';
    if (unavail) state = 'unavailable';
    else if (avail) state = 'available';
    contacts.push({ uri, state, line: t.slice(0, 200) });
  }
  return { ok: true, contacts, rawHead: raw.output.split('\n').slice(0, 5).join('\n') };
}
