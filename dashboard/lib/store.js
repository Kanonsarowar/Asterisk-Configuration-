import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const DB_FILE = join(DATA_DIR, 'db.json');

const DEFAULT_DATA = {
  numbers: [
    { id: '1', country: 'US', countryCode: '1', prefix: '202', extension: '5550100', rate: '0.01', supplierId: '1', destinationType: 'ivr', destinationId: '1' },
    { id: '2', country: 'US', countryCode: '1', prefix: '202', extension: '5550101', rate: '0.01', supplierId: '1', destinationType: 'ivr', destinationId: '1' },
    { id: '3', country: 'US', countryCode: '1', prefix: '202', extension: '5550102', rate: '0.01', supplierId: '1', destinationType: 'ivr', destinationId: '1' },
    { id: '4', country: 'US', countryCode: '1', prefix: '800', extension: '5551234', rate: '0.005', supplierId: '2', destinationType: 'ivr', destinationId: '1' },
    { id: '5', country: 'UK', countryCode: '44', prefix: '20', extension: '71234567', rate: '0.02', supplierId: '3', destinationType: 'ivr', destinationId: '1' },
    { id: '6', country: 'UK', countryCode: '44', prefix: '20', extension: '71234568', rate: '0.02', supplierId: '3', destinationType: 'ivr', destinationId: '1' },
    { id: '7', country: 'DE', countryCode: '49', prefix: '30', extension: '12345678', rate: '0.015', supplierId: '4', destinationType: 'ivr', destinationId: '1' }
  ],
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
    const data = JSON.parse(readFileSync(DB_FILE, 'utf8'));
    if (!data.suppliers) data.suppliers = DEFAULT_DATA.suppliers;
    if (!data.numbers) data.numbers = DEFAULT_DATA.numbers;
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

export class Store {
  constructor() {
    this.data = load();
  }

  // Numbers
  getNumbers() { return this.data.numbers; }
  getNumber(id) { return this.data.numbers.find(n => n.id === id); }
  addNumber(num) {
    num.id = nextId(this.data.numbers);
    this.data.numbers.push(num);
    save(this.data);
    return num;
  }
  updateNumber(id, updates) {
    const idx = this.data.numbers.findIndex(n => n.id === id);
    if (idx === -1) return null;
    this.data.numbers[idx] = { ...this.data.numbers[idx], ...updates, id };
    save(this.data);
    return this.data.numbers[idx];
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
    for (const num of nums) {
      num.id = nextId(this.data.numbers);
      this.data.numbers.push(num);
    }
    save(this.data);
    return nums;
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

  getAll() { return this.data; }
}
