import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  didRoutes: [
    { id: '1', didNumber: '12025550100', description: 'Main Office', destinationType: 'ivr', destinationId: '1' },
    { id: '2', didNumber: '12025550101', description: 'Sales Line', destinationType: 'ivr', destinationId: '2' },
    { id: '3', didNumber: '12025550102', description: 'Support Direct', destinationType: 'ring_group', destinationId: '2' }
  ],
  ivrMenus: [
    {
      id: '1', name: 'Main IVR', audioFile: 'custom/main-menu',
      options: [
        { digit: '1', actionType: 'ring_group', actionTarget: '1', label: 'Sales' },
        { digit: '2', actionType: 'ring_group', actionTarget: '2', label: 'Support' },
        { digit: '0', actionType: 'ring_group', actionTarget: '3', label: 'Operator' }
      ],
      timeoutAction: 'hangup', invalidAction: 'replay'
    },
    {
      id: '2', name: 'Sales IVR', audioFile: 'custom/sales-menu',
      options: [
        { digit: '1', actionType: 'ring_group', actionTarget: '1', label: 'Sales' },
        { digit: '2', actionType: 'ring_group', actionTarget: '3', label: 'Operator' }
      ],
      timeoutAction: 'hangup', invalidAction: 'replay'
    }
  ],
  ringGroups: [
    { id: '1', name: 'Sales', extensions: ['2001'], ringTimeout: 25, voicemailExt: '2001' },
    { id: '2', name: 'Support', extensions: ['2002'], ringTimeout: 25, voicemailExt: '2002' },
    { id: '3', name: 'Operator', extensions: ['2000'], ringTimeout: 25, voicemailExt: '2000' }
  ],
  trunkConfig: {
    supplierIp: '127.0.0.1',
    publicIp: '127.0.0.1',
    userAgent: 'Asterisk-IPAuth-IVR',
    bindPort: 5060,
    codecs: ['alaw', 'ulaw'],
    qualifyFrequency: 60
  },
  globals: {
    ivrResponseTimeout: 7,
    ivrDigitTimeout: 5
  }
};

function load() {
  if (!existsSync(DB_FILE)) {
    save(DEFAULT_DATA);
    return structuredClone(DEFAULT_DATA);
  }
  try {
    return JSON.parse(readFileSync(DB_FILE, 'utf8'));
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

export class Store {
  constructor() {
    this.data = load();
  }

  // DID Routes
  getDidRoutes() { return this.data.didRoutes; }
  getDidRoute(id) { return this.data.didRoutes.find(r => r.id === id); }
  addDidRoute(route) {
    route.id = nextId(this.data.didRoutes);
    this.data.didRoutes.push(route);
    save(this.data);
    return route;
  }
  updateDidRoute(id, updates) {
    const idx = this.data.didRoutes.findIndex(r => r.id === id);
    if (idx === -1) return null;
    this.data.didRoutes[idx] = { ...this.data.didRoutes[idx], ...updates, id };
    save(this.data);
    return this.data.didRoutes[idx];
  }
  deleteDidRoute(id) {
    const idx = this.data.didRoutes.findIndex(r => r.id === id);
    if (idx === -1) return false;
    this.data.didRoutes.splice(idx, 1);
    save(this.data);
    return true;
  }

  // IVR Menus
  getIvrMenus() { return this.data.ivrMenus; }
  getIvrMenu(id) { return this.data.ivrMenus.find(m => m.id === id); }
  addIvrMenu(menu) {
    menu.id = nextId(this.data.ivrMenus);
    this.data.ivrMenus.push(menu);
    save(this.data);
    return menu;
  }
  updateIvrMenu(id, updates) {
    const idx = this.data.ivrMenus.findIndex(m => m.id === id);
    if (idx === -1) return null;
    this.data.ivrMenus[idx] = { ...this.data.ivrMenus[idx], ...updates, id };
    save(this.data);
    return this.data.ivrMenus[idx];
  }
  deleteIvrMenu(id) {
    const idx = this.data.ivrMenus.findIndex(m => m.id === id);
    if (idx === -1) return false;
    this.data.ivrMenus.splice(idx, 1);
    save(this.data);
    return true;
  }

  // Ring Groups
  getRingGroups() { return this.data.ringGroups; }
  getRingGroup(id) { return this.data.ringGroups.find(g => g.id === id); }
  addRingGroup(group) {
    group.id = nextId(this.data.ringGroups);
    this.data.ringGroups.push(group);
    save(this.data);
    return group;
  }
  updateRingGroup(id, updates) {
    const idx = this.data.ringGroups.findIndex(g => g.id === id);
    if (idx === -1) return null;
    this.data.ringGroups[idx] = { ...this.data.ringGroups[idx], ...updates, id };
    save(this.data);
    return this.data.ringGroups[idx];
  }
  deleteRingGroup(id) {
    const idx = this.data.ringGroups.findIndex(g => g.id === id);
    if (idx === -1) return false;
    this.data.ringGroups.splice(idx, 1);
    save(this.data);
    return true;
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

  getAll() { return this.data; }
}
