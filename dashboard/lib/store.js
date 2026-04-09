import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  parseClientName,
  isAllocatedRecord,
  normalizeAllocationStatus,
  ALLOCATED_STATUS,
  POOL_STATUS,
} from './numbers-allocation.js';
import { hashPassword } from './auth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  numbers: [],
  suppliers: [
    { id: '1', name: 'Supplier 1 (Vultr)', ips: ['108.61.70.46'] },
    { id: '2', name: 'Supplier 2 (Hetzner)', ips: ['157.90.193.196'] },
    { id: '3', name: 'Supplier 3 (OVH)', ips: ['51.77.77.223'] },
    { id: '4', name: 'Supplier 4 (Hetzner-2)', ips: ['95.217.90.21'] },
    { id: '5', name: 'Supplier 5 (AWS)', ips: ['52.28.165.40', '52.57.172.184', '35.156.119.128'] },
    { id: '6', name: 'Supplier 6 (Contabo)', ips: ['149.12.160.10'] },
    { id: '7', name: 'Supplier 7 (myLoc)', ips: ['93.94.120.49'] },
    { id: '8', name: 'Supplier 8 (DataClub)', ips: ['185.209.147.14'] }
  ],
  ivrMenus: [
    { id: '1', name: 'IVR 1', audioFile: '' },
    { id: '2', name: 'IVR 2', audioFile: '' },
    { id: '3', name: 'IVR 3', audioFile: '' },
    { id: '4', name: 'IVR 4', audioFile: '' },
    { id: '5', name: 'IVR 5', audioFile: '' },
    { id: '6', name: 'IVR 6', audioFile: '' },
    { id: '7', name: 'IVR 7', audioFile: '' },
    { id: '8', name: 'IVR 8', audioFile: '' },
    { id: '9', name: 'IVR 9', audioFile: '' },
    { id: '10', name: 'IVR 10', audioFile: '' }
  ],
  trunkConfig: {
    publicIp: '167.172.170.88',
    userAgent: 'Asterisk-IPAuth-IVR',
    bindPort: 5060,
    codecs: ['g729', 'alaw', 'ulaw', 'gsm'],
    qualifyFrequency: 60,
    rtpStart: 10000,
    rtpEnd: 20000
  },
  globals: {
    ivrResponseTimeout: 7,
    ivrDigitTimeout: 5,
    dialplanMode: 'iprn',
    defaultContext: 'from-external',
    fallbackIvrId: '1',
    localExtension: '7001',
    localSecret: 'ChangeMe7001',
    /** When true, matched DIDs use ODBC number_inventory + PJSIP Dial instead of IVR (see extensions.conf). */
    iprnOdbcRouting: false,
  },
  balance: {
    eurPerUsd: 0.92,
    sarPerUsd: 3.75,
    weeklySnapshots: {},
    monthlySnapshots: {}
  },
  /** Extra PBX panel admins (SHA256 password). Env DASH_USER always works too. */
  adminUsers: []
};

function load() {
  if (!existsSync(DB_FILE)) {
    save(DEFAULT_DATA);
    return structuredClone(DEFAULT_DATA);
  }
  try {
    const data = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    if (!data.suppliers) data.suppliers = DEFAULT_DATA.suppliers;
    if (!data.numbers) data.numbers = DEFAULT_DATA.numbers;
    if (!data.ivrMenus) data.ivrMenus = DEFAULT_DATA.ivrMenus;
    if (!data.trunkConfig) data.trunkConfig = DEFAULT_DATA.trunkConfig;
    data.trunkConfig = { ...DEFAULT_DATA.trunkConfig, ...data.trunkConfig };
    data.globals = { ...DEFAULT_DATA.globals, ...(data.globals || {}) };
    if (data.globals.iprnOdbcRouting === undefined) data.globals.iprnOdbcRouting = false;
    if (!Array.isArray(data.adminUsers)) data.adminUsers = [];
    if (!data.balance || typeof data.balance !== 'object') {
      data.balance = structuredClone(DEFAULT_DATA.balance);
    } else {
      data.balance = {
        eurPerUsd: data.balance.eurPerUsd ?? DEFAULT_DATA.balance.eurPerUsd,
        sarPerUsd: data.balance.sarPerUsd ?? DEFAULT_DATA.balance.sarPerUsd,
        weeklySnapshots: data.balance.weeklySnapshots && typeof data.balance.weeklySnapshots === 'object'
          ? data.balance.weeklySnapshots
          : {},
        monthlySnapshots: data.balance.monthlySnapshots && typeof data.balance.monthlySnapshots === 'object'
          ? data.balance.monthlySnapshots
          : {}
      };
    }
    if (Array.isArray(data.numbers)) {
      let numMig = false;
      for (const n of data.numbers) {
        if (n.rateCurrency === undefined) { n.rateCurrency = 'usd'; numMig = true; }
        if (n.paymentTerm === undefined) { n.paymentTerm = 'weekly'; numMig = true; }
      }
      if (numMig) save(data);
    }
    // One-time migration: clear legacy seeded DID data.
    if (!data.globals.didDataResetDone) {
      data.numbers = [];
      data.globals.didDataResetDone = true;
      save(data);
    }
    return data;
  } catch {
    save(DEFAULT_DATA);
    return structuredClone(DEFAULT_DATA);
  }
}

function save(data) {
  writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function nextId(collection) {
  const maxId = collection.reduce((max, item) => Math.max(max, parseInt(item.id) || 0), 0);
  return String(maxId + 1);
}

function pickClientName(n) {
  if (n.clientName !== undefined) {
    if (n.clientName === null || n.clientName === '') return null;
    return String(n.clientName);
  }
  if (n.client_name !== undefined) {
    if (n.client_name === null || n.client_name === '') return null;
    return String(n.client_name);
  }
  return undefined;
}

function pickAllocationDate(n) {
  if (n.allocationDate !== undefined) {
    if (n.allocationDate === null || n.allocationDate === '') return null;
    return String(n.allocationDate);
  }
  if (n.allocation_date !== undefined) {
    if (n.allocation_date === null || n.allocation_date === '') return null;
    return String(n.allocation_date);
  }
  return undefined;
}

/** rateCurrency: usd | eur; paymentTerm: weekly | monthly | daily (daily uses weekly wallet). */
export function normalizeNumberRecord(n) {
  const rateCurrency = String(n.rateCurrency || 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd';
  let paymentTerm = String(n.paymentTerm || 'weekly').toLowerCase();
  if (!['weekly', 'monthly', 'daily'].includes(paymentTerm)) paymentTerm = 'weekly';
  const status = normalizeAllocationStatus(n.status);
  const out = { ...n, rateCurrency, paymentTerm, status };
  if (n.prefixInventoryId != null && String(n.prefixInventoryId).trim() !== '') {
    out.prefixInventoryId = String(n.prefixInventoryId).trim();
  }
  const pc = pickClientName(n);
  if (pc !== undefined) out.clientName = pc;
  const pd = pickAllocationDate(n);
  if (pd !== undefined) out.allocationDate = pd;
  delete out.client_name;
  delete out.allocation_date;
  return out;
}

export class Store {
  constructor() {
    this.data = load();
  }

  // Numbers
  getNumbers() { return this.data.numbers; }
  getNumber(id) { return this.data.numbers.find(n => n.id === id); }
  addNumber(num) {
    const n = normalizeNumberRecord(num);
    n.id = nextId(this.data.numbers);
    this.data.numbers.push(n);
    save(this.data);
    return n;
  }
  updateNumber(id, updates) {
    const idx = this.data.numbers.findIndex(n => n.id === id);
    if (idx === -1) return null;
    const merged = normalizeNumberRecord({ ...this.data.numbers[idx], ...updates, id });
    this.data.numbers[idx] = merged;
    save(this.data);
    return merged;
  }
  deleteNumber(id) {
    const idx = this.data.numbers.findIndex(n => n.id === id);
    if (idx === -1) return false;
    this.data.numbers.splice(idx, 1);
    save(this.data);
    return true;
  }
  deleteNumbersByPrefix(country, countryCode, prefix) {
    const before = this.data.numbers.length;
    this.data.numbers = this.data.numbers.filter(n => !(n.country === country && n.countryCode === countryCode && n.prefix === prefix));
    save(this.data);
    return before - this.data.numbers.length;
  }
  addBulkNumbers(nums) {
    const out = [];
    for (const num of nums) {
      const n = normalizeNumberRecord(num);
      n.id = nextId(this.data.numbers);
      this.data.numbers.push(n);
      out.push(n);
    }
    save(this.data);
    return out;
  }

  /**
   * @returns {{ ok: true, number: object } | { ok: false, status: number, code: string, error: string }}
   */
  assignNumber(id, clientName) {
    const idx = this.data.numbers.findIndex(n => n.id === id);
    if (idx === -1) return { ok: false, status: 404, code: 'NOT_FOUND', error: 'Number not found' };
    const ex = this.data.numbers[idx];
    if (isAllocatedRecord(ex)) {
      return { ok: false, status: 409, code: 'ALREADY_ALLOCATED', error: 'This DID is already allocated' };
    }
    const parsed = parseClientName(clientName);
    if (!parsed.ok) return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: parsed.error };
    const merged = normalizeNumberRecord({
      ...ex,
      status: ALLOCATED_STATUS,
      clientName: parsed.value,
      allocationDate: new Date().toISOString(),
    });
    this.data.numbers[idx] = { ...merged, id: ex.id };
    save(this.data);
    return { ok: true, number: this.data.numbers[idx] };
  }

  /**
   * @returns {{ ok: true, number: object } | { ok: false, status: number, code: string, error: string }}
   */
  releaseNumber(id) {
    const idx = this.data.numbers.findIndex(n => n.id === id);
    if (idx === -1) return { ok: false, status: 404, code: 'NOT_FOUND', error: 'Number not found' };
    const ex = this.data.numbers[idx];
    if (!isAllocatedRecord(ex)) {
      return { ok: false, status: 400, code: 'NOT_ALLOCATED', error: 'Number is not allocated' };
    }
    const merged = normalizeNumberRecord({
      ...ex,
      status: POOL_STATUS,
      clientName: null,
      allocationDate: null,
    });
    this.data.numbers[idx] = { ...merged, id: ex.id };
    save(this.data);
    return { ok: true, number: this.data.numbers[idx] };
  }

  // Suppliers
  getSuppliers() { return this.data.suppliers; }
  getSupplier(id) { return this.data.suppliers.find(s => s.id === id); }
  addSupplier(supplier) {
    supplier.id = nextId(this.data.suppliers);
    this.data.suppliers.push(supplier);
    save(this.data);
    return supplier;
  }
  updateSupplier(id, updates) {
    const idx = this.data.suppliers.findIndex(s => s.id === id);
    if (idx === -1) return null;
    this.data.suppliers[idx] = { ...this.data.suppliers[idx], ...updates, id };
    save(this.data);
    return this.data.suppliers[idx];
  }
  deleteSupplier(id) {
    const idx = this.data.suppliers.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.data.suppliers.splice(idx, 1);
    save(this.data);
    return true;
  }

  // IVR Menus (fixed 10 slots - only update allowed)
  getIvrMenus() { return this.data.ivrMenus; }
  getIvrMenu(id) { return this.data.ivrMenus.find(m => m.id === id); }
  updateIvrMenu(id, updates) {
    const idx = this.data.ivrMenus.findIndex(m => m.id === id);
    if (idx === -1) return null;
    this.data.ivrMenus[idx] = { ...this.data.ivrMenus[idx], ...updates, id };
    save(this.data);
    return this.data.ivrMenus[idx];
  }

  // Trunk Config
  getTrunkConfig() { return this.data.trunkConfig; }
  updateTrunkConfig(config) {
    this.data.trunkConfig = { ...this.data.trunkConfig, ...config };
    save(this.data);
    return this.data.trunkConfig;
  }

  // Globals
  getGlobals() { return this.data.globals; }
  updateGlobals(globals) {
    this.data.globals = { ...this.data.globals, ...globals };
    save(this.data);
    return this.data.globals;
  }

  getBalanceConfig() {
    if (!this.data.balance) {
      this.data.balance = structuredClone(DEFAULT_DATA.balance);
      save(this.data);
    } else if (!this.data.balance.monthlySnapshots || typeof this.data.balance.monthlySnapshots !== 'object') {
      this.data.balance.monthlySnapshots = {};
      save(this.data);
    }
    return this.data.balance;
  }

  /** Partial update. Snapshot objects replace whole maps when provided. */
  updateBalanceConfig(updates) {
    const b = this.getBalanceConfig();
    if (updates.eurPerUsd !== undefined) b.eurPerUsd = parseFloat(updates.eurPerUsd) || 0;
    if (updates.sarPerUsd !== undefined) b.sarPerUsd = parseFloat(updates.sarPerUsd) || 0;
    if (updates.weeklySnapshots !== undefined) b.weeklySnapshots = updates.weeklySnapshots;
    if (updates.monthlySnapshots !== undefined) b.monthlySnapshots = updates.monthlySnapshots;
    save(this.data);
    return {
      eurPerUsd: b.eurPerUsd,
      sarPerUsd: b.sarPerUsd,
      weeklySnapshots: { ...b.weeklySnapshots },
      monthlySnapshots: { ...b.monthlySnapshots },
    };
  }

  applyStandardDefaults() {
    this.data.trunkConfig = {
      publicIp: this.data.trunkConfig?.publicIp || '127.0.0.1',
      userAgent: 'Asterisk-IPAuth-IVR',
      bindPort: 5060,
      codecs: ['g729', 'alaw', 'ulaw', 'gsm'],
      qualifyFrequency: 60,
      rtpStart: 10000,
      rtpEnd: 20000
    };
    const keepOdbc = this.data.globals?.iprnOdbcRouting;
    this.data.globals = {
      ...this.data.globals,
      ivrResponseTimeout: 7,
      ivrDigitTimeout: 5,
      dialplanMode: 'iprn',
      defaultContext: 'from-supplier-ip',
      fallbackIvrId: '1',
      localExtension: '7001',
      localSecret: 'ChangeMe7001',
      iprnOdbcRouting: keepOdbc === true,
    };
    save(this.data);
    return {
      trunkConfig: this.data.trunkConfig,
      globals: this.data.globals
    };
  }

  getAdminUsers() {
    if (!Array.isArray(this.data.adminUsers)) this.data.adminUsers = [];
    return this.data.adminUsers.filter((x) => x && x.username && x.passwordHash);
  }

  /** API: no password hashes */
  listAdminUsernames() {
    return this.getAdminUsers().map((x) => ({ username: x.username }));
  }

  addAdminUser(username, password) {
    const envUser = (process.env.DASH_USER || 'admin').trim();
    const u = String(username || '').trim();
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(u)) {
      return { ok: false, error: 'Username: 3–64 chars, letters, numbers, _ . -' };
    }
    if (u === envUser) {
      return { ok: false, error: `Username "${u}" is reserved for the server env account (DASH_USER)` };
    }
    if (!password || String(password).length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters' };
    }
    if (!Array.isArray(this.data.adminUsers)) this.data.adminUsers = [];
    if (this.data.adminUsers.some((x) => x && String(x.username) === u)) {
      return { ok: false, error: 'Username already exists' };
    }
    this.data.adminUsers.push({ username: u, passwordHash: hashPassword(password) });
    save(this.data);
    return { ok: true };
  }

  removeAdminUser(username) {
    const u = String(username || '').trim();
    if (!Array.isArray(this.data.adminUsers)) return { ok: false, error: 'No users' };
    const idx = this.data.adminUsers.findIndex((x) => x && String(x.username) === u);
    if (idx === -1) return { ok: false, error: 'User not found' };
    this.data.adminUsers.splice(idx, 1);
    save(this.data);
    return { ok: true };
  }

  updateAdminPassword(username, newPassword) {
    const u = String(username || '').trim();
    if (!newPassword || String(newPassword).length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters' };
    }
    const row = this.getAdminUsers().find((x) => String(x.username) === u);
    if (!row) return { ok: false, error: 'User not found' };
    row.passwordHash = hashPassword(newPassword);
    save(this.data);
    return { ok: true };
  }

  getAll() { return this.data; }
}
