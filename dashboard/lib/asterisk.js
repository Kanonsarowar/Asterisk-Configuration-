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

export async function getChannels() {
  const result = await runCmd('core show channels verbose');
  return { ok: result.ok, output: result.output };
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
  return { dialplan: dp, pjsip: pj, acl };
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
