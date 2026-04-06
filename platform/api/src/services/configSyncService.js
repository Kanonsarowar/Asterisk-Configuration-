import { mkdir, writeFile, readFile, cp } from 'fs/promises';
import { join } from 'path';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { query } from '../db.js';
import {
  generateAsteriskConfigs,
  reloadAsterisk,
  asteriskCliReachable,
  asteriskOutputDir,
} from './configGenerator.js';

const execFileAsync = promisify(execFile);

function bundleChecksum(bundle) {
  return createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
}

/**
 * Copy generated tree to live Asterisk config dir (optional).
 */
export async function installConfigToAsterisk(outDir, installDir) {
  if (!installDir) return;
  await mkdir(installDir, { recursive: true });
  const names = ['pjsip.conf', 'extensions.conf', 'pjsip.d', 'extensions.d'];
  for (const n of names) {
    await cp(join(outDir, n), join(installDir, n), { recursive: true, force: true });
  }
}

async function maybeGitCommit(versionTag, bundle) {
  const repo = process.env.CONFIG_SYNC_GIT_DIR;
  if (!repo) return;
  const msg = `asterisk-config ${versionTag}`;
  try {
    const pjsipPath = join(repo, 'pjsip.generated.conf');
    const extPath = join(repo, 'extensions.generated.conf');
    await writeFile(pjsipPath, bundle.pjsipBody, 'utf8');
    await writeFile(extPath, bundle.extBody, 'utf8');
    await execFileAsync('git', ['add', '-A'], { cwd: repo });
    await execFileAsync('git', ['commit', '-m', msg], { cwd: repo });
  } catch (e) {
    console.warn('[configSync] git commit skipped:', e.message);
  }
}

/**
 * Regenerate configs, optionally version, install, reload Asterisk safely.
 *
 * @param {{
 *   actorId?: number|null,
 *   triggerSource?: string,
 *   recordVersion?: boolean,
 *   reload?: boolean,
 *   skipPreReloadCheck?: boolean
 * }} opts
 */
export async function runConfigSync(opts = {}) {
  const {
    actorId = null,
    triggerSource = 'manual',
    recordVersion = true,
    reload = true,
    skipPreReloadCheck = false,
  } = opts;

  const installDir = process.env.ASTERISK_INSTALL_DIR || '';

  if (reload && !skipPreReloadCheck && process.env.CONFIG_SYNC_SKIP_CLI_CHECK !== '1') {
    const ok = await asteriskCliReachable();
    if (!ok) {
      const err = new Error('Asterisk CLI not reachable; refusing reload (set CONFIG_SYNC_SKIP_CLI_CHECK=1 to override)');
      err.code = 'ASTERISK_UNREACHABLE';
      throw err;
    }
  }

  const { files, checksum, outDir } = await generateAsteriskConfigs();

  const pjsipConf = await readFile(join(outDir, 'pjsip.conf'), 'utf8');
  const extensionsConf = await readFile(join(outDir, 'extensions.conf'), 'utf8');

  const snapshot = {
    pjsipBody: files.pjsipBody,
    extBody: files.extBody,
    pjsipConf,
    extensionsConf,
  };
  const snapshotJson = JSON.stringify(snapshot);

  let versionTag = null;
  if (recordVersion) {
    versionTag = `v-${Date.now()}`;
    await query(
      `INSERT INTO config_versions (version_tag, trigger_source, files_json, snapshot_json, checksum, created_by, applied_at)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))`,
      [
        versionTag,
        String(triggerSource).slice(0, 64),
        JSON.stringify(Object.keys(files)),
        snapshotJson,
        checksum,
        actorId,
      ]
    );
    await maybeGitCommit(versionTag, files);
  }

  if (installDir) {
    await installConfigToAsterisk(outDir, installDir);
  }

  if (reload) {
    await reloadAsterisk();
  }

  return {
    ok: true,
    version_tag: versionTag,
    checksum,
    outDir,
    installed: Boolean(installDir),
    reloaded: reload,
  };
}

/**
 * Write snapshot from DB to ASTERISK_GENERATED_DIR and optionally install + reload.
 */
export async function applySnapshotFromVersion(versionRow, { reload = true } = {}) {
  let raw = versionRow.snapshot_json;
  if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
  if (raw == null || (typeof raw === 'string' && !raw.length)) {
    const err = new Error('No snapshot stored for this version');
    err.code = 'NO_SNAPSHOT';
    throw err;
  }
  const snap = typeof raw === 'string' ? JSON.parse(raw) : typeof raw === 'object' ? raw : JSON.parse(String(raw));
  const out = asteriskOutputDir();
  const pjsipD = join(out, 'pjsip.d');
  const extD = join(out, 'extensions.d');
  await mkdir(pjsipD, { recursive: true });
  await mkdir(extD, { recursive: true });

  await writeFile(join(pjsipD, '10-generated.conf'), snap.pjsipBody, 'utf8');
  await writeFile(join(extD, '10-generated.conf'), snap.extBody, 'utf8');
  await writeFile(join(out, 'pjsip.conf'), snap.pjsipConf, 'utf8');
  await writeFile(join(out, 'extensions.conf'), snap.extensionsConf, 'utf8');

  const bundle = { pjsipBody: snap.pjsipBody, extBody: snap.extBody };
  const checksum = bundleChecksum(bundle);

  const installDir = process.env.ASTERISK_INSTALL_DIR || '';
  if (installDir) {
    await installConfigToAsterisk(out, installDir);
  }

  if (reload) {
    if (process.env.CONFIG_SYNC_SKIP_CLI_CHECK !== '1') {
      const ok = await asteriskCliReachable();
      if (!ok) {
        const err = new Error('Asterisk CLI not reachable; refusing reload');
        err.code = 'ASTERISK_UNREACHABLE';
        throw err;
      }
    }
    await reloadAsterisk();
  }

  return { checksum, outDir: out, matches: checksum === versionRow.checksum };
}

export function shouldPollOutbox() {
  return process.env.CONFIG_SYNC_OUTBOX_POLL !== '0';
}

/**
 * Process pending outbox rows (coalesce one sync per batch).
 */
export async function processConfigSyncOutboxOnce() {
  const r = await query(
    `SELECT id, reason FROM config_sync_outbox WHERE processed_at IS NULL ORDER BY id ASC LIMIT 50`
  );
  if (!r.rows.length) return { processed: 0 };

  const ids = r.rows.map((x) => x.id);
  const reasons = [...new Set(r.rows.map((x) => x.reason))];
  const triggerSource = reasons.length === 1 ? reasons[0] : 'manual';

  try {
    await runConfigSync({
      actorId: null,
      triggerSource,
      recordVersion: true,
      reload: process.env.CONFIG_SYNC_RELOAD !== '0',
    });
  } catch (e) {
    console.error('[configSync] outbox sync failed:', e.message);
    throw e;
  }

  await query(`UPDATE config_sync_outbox SET processed_at = UTC_TIMESTAMP(3) WHERE id IN (${ids.map(() => '?').join(',')})`, ids);

  return { processed: ids.length, triggerSource };
}

export function startConfigSyncOutboxPoller() {
  if (!shouldPollOutbox()) {
    console.log('[configSync] outbox poller disabled (CONFIG_SYNC_OUTBOX_POLL=0)');
    return () => {};
  }
  const ms = parseInt(process.env.CONFIG_SYNC_POLL_MS || '2000', 10) || 2000;
  const t = setInterval(() => {
    processConfigSyncOutboxOnce().catch(() => {});
  }, ms);
  return () => clearInterval(t);
}
