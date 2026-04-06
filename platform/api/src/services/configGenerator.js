import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { query } from '../db.js';
import { getBillingSettings } from '../lib/settings.js';
import { orderSupplierIdsForPrefix } from '../lib/routingEngine.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function asteriskOutputDir() {
  return process.env.ASTERISK_GENERATED_DIR || join(process.cwd(), '../asterisk-generated');
}

/**
 * Generate modular pjsip.d + extensions.d from MySQL (no hardcoded routes).
 */
export async function generateAsteriskConfigs() {
  const out = asteriskOutputDir();
  const pjsipD = join(out, 'pjsip.d');
  const extD = join(out, 'extensions.d');
  await mkdir(pjsipD, { recursive: true });
  await mkdir(extD, { recursive: true });

  const sup = await query(
    `SELECT id, name, host, port, username, password, protocol FROM suppliers WHERE active = 1 ORDER BY id`
  );

  const pjsipLines = [];
  pjsipLines.push('; IPRN auto-generated PJSIP — modular');
  pjsipLines.push('[transport-udp]');
  pjsipLines.push('type=transport');
  pjsipLines.push('protocol=udp');
  pjsipLines.push('bind=0.0.0.0');
  pjsipLines.push('');

  for (const s of sup.rows) {
    const id = s.id;
    const base = `supplier_${id}`;
    const host = String(s.host || '').replace(/\s/g, '');
    const port = Number(s.port) || 5060;
    const user = String(s.username || '');
    const pass = String(s.password || '');
    pjsipLines.push(`; ${s.name || base} (${s.protocol})`);
    pjsipLines.push(`[${base}_aor]`);
    pjsipLines.push('type=aor');
    pjsipLines.push(`contact=sip:${host}:${port}`);
    pjsipLines.push('');
    pjsipLines.push(`[${base}_auth]`);
    pjsipLines.push('type=auth');
    pjsipLines.push('auth_type=userpass');
    pjsipLines.push(`username=${user}`);
    pjsipLines.push(`password=${pass}`);
    pjsipLines.push('');
    pjsipLines.push(`[${base}]`);
    pjsipLines.push('type=endpoint');
    pjsipLines.push('context=iprn-inbound');
    pjsipLines.push('disallow=all');
    pjsipLines.push('allow=ulaw,alaw');
    pjsipLines.push(`aors=${base}_aor`);
    pjsipLines.push(`outbound_auth=${base}_auth`);
    if (user) pjsipLines.push(`from_user=${user}`);
    pjsipLines.push('');
  }

  const routes = await query(
    `SELECT r.prefix, r.priority, r.rate, r.supplier_id, s.cost_per_minute
     FROM routes r
     JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.active = 1 AND s.active = 1
     ORDER BY CHAR_LENGTH(r.prefix) DESC, r.prefix, r.priority ASC, r.supplier_id ASC`
  );

  const billing = await getBillingSettings();
  const byPrefix = new Map();
  for (const row of routes.rows) {
    const pfx = String(row.prefix || '').replace(/\D/g, '');
    if (!pfx) continue;
    if (!byPrefix.has(pfx)) byPrefix.set(pfx, []);
    byPrefix.get(pfx).push(row);
  }

  const extLines = [];
  extLines.push('; IPRN auto-generated dialplan');
  extLines.push('[general]');
  extLines.push('static=yes');
  extLines.push('writeprotect=no');
  extLines.push('');

  extLines.push('[iprn-inbound]');
  extLines.push('exten => _X.,1,NoOp(IPRN inbound ${EXTEN})');
  extLines.push(' same => n,Set(DID=${FILTER(0-9,${EXTEN})})');
  extLines.push(' same => n,Goto(iprn-routes,${DID},1)');
  extLines.push('');

  extLines.push('[iprn-routes]');
  const prefixes = [...byPrefix.keys()].sort((a, b) => b.length - a.length || a.localeCompare(b));
  if (!prefixes.length) {
    extLines.push('exten => _X.,1,NoOp(No routes configured)');
    extLines.push(' same => n,Hangup()');
  } else {
    for (const pfx of prefixes) {
      const rows = byPrefix.get(pfx);
      const ids = orderSupplierIdsForPrefix(rows, billing);
      /* Prefix at start of dialed number; X! = one or more digits after prefix */
      const pat = `_${pfx}X!`;
      extLines.push(
        `; Prefix ${pfx} — failover (${billing.routing_mode || 'priority'}) ${ids.join(' -> ')}`
      );
      extLines.push(`exten => ${pat},1,NoOp(Match prefix ${pfx} dest \${EXTEN})`);
      extLines.push(' same => n,Set(DEST=${EXTEN})');
      for (const sid of ids) {
        extLines.push(` same => n,Dial(PJSIP/\${DEST}@supplier_${sid},30)`);
        extLines.push(' same => n,GotoIf($["${DIALSTATUS}"="ANSWER"]?done)');
      }
      extLines.push(' same => n,Hangup()');
      extLines.push(' same => n(done),Hangup()');
      extLines.push('');
    }
    extLines.push('exten => _X.,1,NoOp(No prefix match for ${EXTEN})');
    extLines.push(' same => n,Hangup()');
  }

  const pjsipBody = pjsipLines.join('\n') + '\n';
  const extBody = extLines.join('\n') + '\n';

  await writeFile(join(pjsipD, '10-generated.conf'), pjsipBody, 'utf8');
  await writeFile(join(extD, '10-generated.conf'), extBody, 'utf8');

  const pjsipConf = `; IPRN generated root — include modular fragments\n#include "pjsip.d/10-generated.conf"\n`;
  const extensionsConf = `; IPRN generated root\n#include "extensions.d/10-generated.conf"\n`;
  await writeFile(join(out, 'pjsip.conf'), pjsipConf, 'utf8');
  await writeFile(join(out, 'extensions.conf'), extensionsConf, 'utf8');

  const bundle = { pjsipBody, extBody };
  const checksum = createHash('sha256').update(JSON.stringify(bundle)).digest('hex');

  return { files: bundle, checksum, outDir: out };
}

export async function reloadAsterisk() {
  const bin = process.env.ASTERISK_BIN || 'asterisk';
  const useSudo = process.env.ASTERISK_USE_SUDO === '1' || process.env.ASTERISK_USE_SUDO === 'true';
  const rx = async (args) => {
    if (useSudo) {
      await execFileAsync('sudo', [bin, ...args]);
    } else {
      await execFileAsync(bin, args);
    }
  };
  try {
    await rx(['-rx', 'module reload res_pjsip.so']);
  } catch {
    /* optional — build may lack PJSIP */
  }
  try {
    await rx(['-rx', 'dialplan reload']);
  } catch (e) {
    console.warn('[config] dialplan reload failed', e.message);
    throw e;
  }
}

/**
 * Best-effort: confirm Asterisk CLI responds before mutating live config.
 */
export async function asteriskCliReachable() {
  const bin = process.env.ASTERISK_BIN || 'asterisk';
  const useSudo = process.env.ASTERISK_USE_SUDO === '1' || process.env.ASTERISK_USE_SUDO === 'true';
  try {
    if (useSudo) {
      await execFileAsync('sudo', [bin, '-rx', 'core show version']);
    } else {
      await execFileAsync(bin, ['-rx', 'core show version']);
    }
    return true;
  } catch {
    return false;
  }
}
