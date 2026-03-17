import { existsSync, statSync, openSync, readSync, closeSync } from 'fs';

const LOG_FILES = [
  '/var/log/asterisk/messages',
  '/var/log/asterisk/full',
];

export function getRecentInvites(limit = 100) {
  let logFile = null;
  for (const f of LOG_FILES) {
    if (existsSync(f)) { logFile = f; break; }
  }
  if (!logFile) return [];

  try {
    const stat = statSync(logFile);
    const readSize = Math.min(stat.size, 512 * 1024);
    const fd = openSync(logFile, 'r');
    const buf = Buffer.alloc(readSize);
    readSync(fd, buf, 0, readSize, Math.max(0, stat.size - readSize));
    closeSync(fd);
    const content = buf.toString('utf8');

    const invites = [];
    const lines = content.split('\n');
    for (const line of lines) {
      const hasSip = line.includes('INVITE') || line.includes('chan_pjsip') || line.includes('res_pjsip') || line.includes('SecurityEvent');
      if (!hasSip) continue;

      const ts = line.substring(0, 24).trim();
      const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
      const ip = ipMatch ? ipMatch[1] : 'unknown';

      if (line.includes('Reject') || line.includes('denied') || line.includes('No matching endpoint') || line.includes('Failed') || line.includes('SecurityEvent')) {
        invites.push({ time: ts, ip, did: '', raw: line.substring(0, 250), type: 'BLOCKED' });
      } else if (line.includes('INVITE') || line.includes('Inbound call')) {
        const didMatch = line.match(/INVITE sip:([^@\s]+)/) || line.match(/EXTEN=(\S+)/);
        invites.push({ time: ts, ip, did: didMatch ? didMatch[1] : '', raw: line.substring(0, 250), type: 'INVITE' });
      }
    }
    return invites.slice(-limit).reverse();
  } catch {
    return [];
  }
}
