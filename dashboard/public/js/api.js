async function fetchJsonWithTimeout(url, ms = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      try {
        return await res.json();
      } catch {
        return { error: `HTTP ${res.status}` };
      }
    }
    return res.json();
  } catch (e) {
    if (e.name === 'AbortError') return { error: 'timeout' };
    throw e;
  } finally {
    clearTimeout(t);
  }
}

const API = {
  async get(url) {
    const res = await fetch(url);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    return res.json();
  },
  async del(url) {
    const res = await fetch(url, { method: 'DELETE' });
    return res.json();
  },

  // Call Stats
  getCallStats(hours = 24) { return this.get(`/api/call-stats?hours=${hours}`); },
  getCdrHistory(opts = {}) {
    const hours = opts.hours != null ? opts.hours : 168;
    const limit = opts.limit != null ? opts.limit : 2000;
    let q = `hours=${encodeURIComponent(hours)}&limit=${encodeURIComponent(limit)}`;
    if (opts.dateFrom) q += `&dateFrom=${encodeURIComponent(opts.dateFrom)}`;
    if (opts.dateTo) q += `&dateTo=${encodeURIComponent(opts.dateTo)}`;
    return fetchJsonWithTimeout(`/api/cdr-history?${q}`, 25000);
  },

  // SIP Invites
  getSipInvites(limit = 100) { return this.get(`/api/sip-invites?limit=${limit}`); },

  // Status (Asterisk CLI — can block; always use timeout on dashboard)
  getStatus() { return fetchJsonWithTimeout('/api/status', 18000); },
  /** Avoid hanging dashboard if Asterisk CLI is slow (sudo / lock). */
  /** Enriches each row with __INBOUND_DID (extra core show channel per call). */
  getChannels() { return fetchJsonWithTimeout('/api/channels', 45000); },
  getModules() { return fetchJsonWithTimeout('/api/modules', 12000); },
  getPjsipContacts() { return fetchJsonWithTimeout('/api/pjsip/contacts', 15000); },
  getIprnBillingSummary(limit = 500) {
    return fetchJsonWithTimeout(`/api/iprn/billing-summary?limit=${encodeURIComponent(limit)}`, 12000);
  },
  getIprnPanelStatus() {
    return fetchJsonWithTimeout('/api/iprn/panel-status', 8000);
  },
  getAppConfig() {
    return fetchJsonWithTimeout('/api/app-config', 5000);
  },

  // Suppliers
  getSuppliers() { return fetchJsonWithTimeout('/api/suppliers', 12000); },
  addSupplier(sup) { return this.post('/api/suppliers', sup); },
  updateSupplier(id, sup) { return this.put(`/api/suppliers/${id}`, sup); },
  deleteSupplier(id) { return this.del(`/api/suppliers/${id}`); },

  async postRaw(url, text) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text });
    return res.json();
  },
  uploadNumbersCsv(text, supplierId) { return this.postRaw(`/api/numbers/upload-csv?supplier=${encodeURIComponent(supplierId)}`, text); },

  // Numbers
  getNumbers() { return fetchJsonWithTimeout('/api/numbers', 12000); },
  addNumber(num) { return this.post('/api/numbers', num); },
  addBulkNumbers(nums) { return this.post('/api/numbers/bulk', { numbers: nums }); },
  updateNumber(id, num) { return this.put(`/api/numbers/${id}`, num); },
  assignNumber(id, body) { return this.post(`/api/numbers/${encodeURIComponent(id)}/assign`, body); },
  releaseNumber(id) { return this.post(`/api/numbers/${encodeURIComponent(id)}/release`, {}); },
  deleteNumber(id) { return this.del(`/api/numbers/${id}`); },
  deletePrefix(country, countryCode, prefix) { return this.post('/api/numbers/delete-prefix', { country, countryCode, prefix }); },
  testDidRoute(did, sourceIp = '') {
    const qs = `did=${encodeURIComponent(did)}&sourceIp=${encodeURIComponent(sourceIp)}`;
    return this.get(`/api/numbers/test-route?${qs}`);
  },

  // IVR (fixed 10 slots - only update)
  getIvrMenus() { return fetchJsonWithTimeout('/api/ivr-menus', 12000); },
  updateIvrMenu(id, menu) { return this.put(`/api/ivr-menus/${id}`, menu); },

  // Trunk
  getTrunkConfig() { return this.get('/api/trunk-config'); },
  updateTrunkConfig(config) { return this.put('/api/trunk-config', config); },

  // Globals
  getGlobals() { return this.get('/api/globals'); },
  updateGlobals(globals) { return this.put('/api/globals', globals); },

  getBalance() { return fetchJsonWithTimeout('/api/balance', 60000); },
  updateBalance(body) { return this.put('/api/balance', body); },
  getStandardConfig() { return this.get('/api/standard-config'); },
  applyStandardConfig() { return this.post('/api/standard-config/apply', {}); },

  // Audio
  getAudioFiles() { return this.get('/api/audio-files'); },
  async uploadAudio(file) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/audio-upload', { method: 'POST', body: form });
    return res.json();
  },

  // Apply
  apply() { return this.post('/api/apply', {}); },
  previewConfig() { return this.get('/api/preview-config'); },

  // Panel admins (extra logins besides DASH_USER)
  getAdminUsers() { return this.get('/api/admin/users'); },
  addAdminUser(body) { return this.post('/api/admin/users', body); },
  deleteAdminUser(username) {
    return this.del(`/api/admin/users/${encodeURIComponent(username)}`);
  },
  updateAdminPassword(username, password) {
    return this.put(`/api/admin/users/${encodeURIComponent(username)}/password`, { password });
  },

  getAuthMe() {
    return fetch('/api/auth/me', { credentials: 'same-origin' }).then((r) => r.json());
  },

  getTenantDashboard() {
    return fetchJsonWithTimeout('/api/tenant/dashboard', 35000);
  },
  getTenantLiveCalls() {
    return fetchJsonWithTimeout('/api/tenant/live-calls', 50000);
  },
  getTenantCdr(opts = {}) {
    const h = opts.hours != null ? opts.hours : 168;
    let q = `hours=${encodeURIComponent(h)}&limit=${encodeURIComponent(opts.limit || 500)}`;
    if (opts.dateFrom) q += `&dateFrom=${encodeURIComponent(opts.dateFrom)}`;
    if (opts.dateTo) q += `&dateTo=${encodeURIComponent(opts.dateTo)}`;
    return fetchJsonWithTimeout(`/api/tenant/cdr?${q}`, 25000);
  },
  getTenantNumbers() {
    return this.get('/api/tenant/numbers');
  },
  getTenantSubusers() {
    return this.get('/api/tenant/subusers');
  },
  createTenantSubuser(body) {
    return this.post('/api/tenant/subusers', body);
  },
  deleteTenantSubuser(id) {
    return this.del(`/api/tenant/subusers/${encodeURIComponent(id)}`);
  },
  tenantAllocate(body) {
    return this.post('/api/tenant/allocate', body);
  },
  tenantUnallocate(userId, number) {
    const q = `userId=${encodeURIComponent(userId)}&number=${encodeURIComponent(number)}`;
    return fetch(`/api/tenant/allocate?${q}`, { method: 'DELETE', credentials: 'same-origin' }).then((r) => r.json());
  },
  getTenantInvoices() {
    return this.get('/api/tenant/invoices');
  },
  generateTenantInvoice(body) {
    return this.post('/api/tenant/invoices/generate', body);
  },
  tenantCallGenerator(body) {
    return this.post('/api/tenant/call-generator', body);
  },

  getIprnClientUsers() {
    return this.get('/api/panel/iprn-users');
  },
  createIprnClientUser(body) {
    return this.post('/api/panel/iprn-users', body);
  },
  updateIprnClientUser(id, body) {
    return this.put(`/api/panel/iprn-users/${encodeURIComponent(id)}`, body);
  },
  deleteIprnClientUser(id) {
    return this.del(`/api/panel/iprn-users/${encodeURIComponent(id)}`);
  },
  assignIprnClientNumber(userId, number) {
    return this.post(`/api/panel/iprn-users/${encodeURIComponent(userId)}/assign`, { number });
  },
  unassignIprnClientNumber(userId, number) {
    return fetch(
      `/api/panel/iprn-users/${encodeURIComponent(userId)}/assign?number=${encodeURIComponent(number)}`,
      { method: 'DELETE', credentials: 'same-origin' }
    ).then((r) => r.json());
  },
  setIprnClientBalance(userId, balance) {
    return this.post(`/api/panel/iprn-users/${encodeURIComponent(userId)}/balance`, { balance });
  },
};

export default API;
