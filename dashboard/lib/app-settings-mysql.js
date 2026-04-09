/**
 * Full app settings in MySQL (suppliers, IVR, trunk, globals, balance, panel admins).
 * Replaces db.json when MYSQL_ENABLED=1 and schema row exists / migrated.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getMysqlPool, isMysqlEnabled, isMysqlNumbersReady } from './mysql.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

/** @returns {boolean} */
export function useMysqlAppSettings() {
  return isMysqlNumbersReady() && getMysqlPool() != null;
}

function defaultStateSkeleton() {
  return {
    numbers: [],
    suppliers: [],
    ivrMenus: [],
    trunkConfig: {},
    globals: {},
    balance: {
      eurPerUsd: 0.92,
      sarPerUsd: 3.75,
      weeklySnapshots: {},
      monthlySnapshots: {},
    },
    adminUsers: [],
  };
}

/** Merge file/defaults — same shape as store.js DEFAULT_DATA for missing keys. */
function normalizeState(raw) {
  const d = defaultStateSkeleton();
  if (!raw || typeof raw !== 'object') return d;
  return {
    numbers: Array.isArray(raw.numbers) ? raw.numbers : [],
    suppliers: Array.isArray(raw.suppliers) ? raw.suppliers : d.suppliers,
    ivrMenus: Array.isArray(raw.ivrMenus) ? raw.ivrMenus : d.ivrMenus,
    trunkConfig: { ...d.trunkConfig, ...(raw.trunkConfig || {}) },
    globals: { ...d.globals, ...(raw.globals || {}) },
    balance: {
      eurPerUsd: raw.balance?.eurPerUsd ?? d.balance.eurPerUsd,
      sarPerUsd: raw.balance?.sarPerUsd ?? d.balance.sarPerUsd,
      weeklySnapshots:
        raw.balance?.weeklySnapshots && typeof raw.balance.weeklySnapshots === 'object'
          ? raw.balance.weeklySnapshots
          : {},
      monthlySnapshots:
        raw.balance?.monthlySnapshots && typeof raw.balance.monthlySnapshots === 'object'
          ? raw.balance.monthlySnapshots
          : {},
    },
    adminUsers: Array.isArray(raw.adminUsers) ? raw.adminUsers : [],
  };
}

function loadFromDbJsonFile() {
  if (!existsSync(DB_FILE)) return null;
  try {
    return JSON.parse(readFileSync(DB_FILE, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Seed dashboard_app_state from db.json once, or insert defaults.
 */
export async function migrateAppStateFromJsonIfNeeded() {
  const p = getMysqlPool();
  if (!p) return;
  const [rows] = await p.query('SELECT `state_json` FROM `dashboard_app_state` WHERE `id` = 1 LIMIT 1');
  if (rows && rows.length > 0) return;

  const fromFile = loadFromDbJsonFile();
  let state;
  if (fromFile) {
    state = normalizeState(fromFile);
    console.log('[mysql] dashboard_app_state: migrated from data/db.json');
  } else {
    // Defaults matching store.js DEFAULT_DATA (without numbers — use MySQL numbers table)
    state = normalizeState({
      suppliers: [
        { id: '1', name: 'Supplier 1 (Vultr)', ips: ['108.61.70.46'] },
        { id: '2', name: 'Supplier 2 (Hetzner)', ips: ['157.90.193.196'] },
        { id: '3', name: 'Supplier 3 (OVH)', ips: ['51.77.77.223'] },
        { id: '4', name: 'Supplier 4 (Hetzner-2)', ips: ['95.217.90.21'] },
        { id: '5', name: 'Supplier 5 (AWS)', ips: ['52.28.165.40', '52.57.172.184', '35.156.119.128'] },
        { id: '6', name: 'Supplier 6 (Contabo)', ips: ['149.12.160.10'] },
        { id: '7', name: '24seven.co.uk', ips: ['93.94.120.49'] },
        { id: '8', name: 'Supplier 8 (DataClub)', ips: ['185.209.147.14'] },
      ],
      ivrMenus: Array.from({ length: 10 }, (_, i) => ({
        id: String(i + 1),
        name: `IVR ${i + 1}`,
        audioFile: '',
      })),
      trunkConfig: {
        publicIp: '167.172.170.88',
        userAgent: 'Asterisk-IPAuth-IVR',
        bindPort: 5060,
        codecs: ['g729', 'alaw', 'ulaw', 'gsm'],
        qualifyFrequency: 60,
        rtpStart: 10000,
        rtpEnd: 20000,
      },
      globals: {
        ivrResponseTimeout: 7,
        ivrDigitTimeout: 5,
        dialplanMode: 'iprn',
        defaultContext: 'from-external',
        fallbackIvrId: '1',
        localExtension: '7001',
        localSecret: 'ChangeMe7001',
        iprnOdbcRouting: false,
      },
      balance: { eurPerUsd: 0.92, sarPerUsd: 3.75, weeklySnapshots: {}, monthlySnapshots: {} },
      adminUsers: [],
    });
    state.numbers = [];
    console.log('[mysql] dashboard_app_state: inserted defaults (no db.json)');
  }

  state.numbers = [];
  await p.execute('INSERT INTO `dashboard_app_state` (`id`, `state_json`) VALUES (1, CAST(? AS JSON))', [
    JSON.stringify(state),
  ]);
}

export async function loadAppStateFromMysql() {
  const p = getMysqlPool();
  if (!p) return null;
  const [rows2] = await p.query('SELECT `state_json` FROM `dashboard_app_state` WHERE `id` = 1 LIMIT 1');
  if (!rows2 || !rows2.length) return null;
  const raw = rows2[0].state_json;
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return normalizeState(parsed);
}

let persistChain = Promise.resolve();

export function persistAppStateToMysql(data) {
  const p = getMysqlPool();
  if (!p) return Promise.resolve();
  const payload = {
    numbers: [],
    suppliers: data.suppliers || [],
    ivrMenus: data.ivrMenus || [],
    trunkConfig: data.trunkConfig || {},
    globals: data.globals || {},
    balance: data.balance || {},
    adminUsers: (data.adminUsers || []).map((u) => ({
      username: u.username,
      passwordHash: u.passwordHash,
    })),
  };
  const json = JSON.stringify(payload);
  persistChain = persistChain.then(async () => {
    const [r] = await p.execute('UPDATE `dashboard_app_state` SET `state_json` = CAST(? AS JSON) WHERE `id` = 1', [
      json,
    ]);
    if (r.affectedRows === 0) {
      await p.execute('INSERT INTO `dashboard_app_state` (`id`, `state_json`) VALUES (1, CAST(? AS JSON))', [json]);
    }
  });
  return persistChain.catch((e) => {
    console.error('[mysql] persistAppStateToMysql:', e?.message || e);
  });
}

/** Optional: write-through backup for disaster recovery (not used for reads). */
export function writeDbJsonBackup(data) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      numbers: [],
      suppliers: data.suppliers || [],
      ivrMenus: data.ivrMenus || [],
      trunkConfig: data.trunkConfig || {},
      globals: data.globals || {},
      balance: data.balance || {},
      adminUsers: data.adminUsers || [],
    };
    writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('[mysql] db.json backup write failed:', e?.message || e);
  }
}
