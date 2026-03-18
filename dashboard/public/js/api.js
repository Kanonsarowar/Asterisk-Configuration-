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

  // SIP Invites
  getSipInvites(limit = 100) { return this.get(`/api/sip-invites?limit=${limit}`); },

  // Status
  getStatus() { return this.get('/api/status'); },
  getChannels() { return this.get('/api/channels'); },
  getModules() { return this.get('/api/modules'); },

  // Suppliers
  getSuppliers() { return this.get('/api/suppliers'); },
  addSupplier(sup) { return this.post('/api/suppliers', sup); },
  updateSupplier(id, sup) { return this.put(`/api/suppliers/${id}`, sup); },
  deleteSupplier(id) { return this.del(`/api/suppliers/${id}`); },

  async postRaw(url, text) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text });
    return res.json();
  },
  uploadNumbersCsv(text, supplierId) { return this.postRaw(`/api/numbers/upload-csv?supplier=${encodeURIComponent(supplierId)}`, text); },

  // Numbers
  getNumbers() { return this.get('/api/numbers'); },
  addNumber(num) { return this.post('/api/numbers', num); },
  addBulkNumbers(nums) { return this.post('/api/numbers/bulk', { numbers: nums }); },
  updateNumber(id, num) { return this.put(`/api/numbers/${id}`, num); },
  deleteNumber(id) { return this.del(`/api/numbers/${id}`); },
  deletePrefix(country, countryCode, prefix) { return this.post('/api/numbers/delete-prefix', { country, countryCode, prefix }); },

  // IVR (fixed 10 slots - only update)
  getIvrMenus() { return this.get('/api/ivr-menus'); },
  updateIvrMenu(id, menu) { return this.put(`/api/ivr-menus/${id}`, menu); },

  // Trunk
  getTrunkConfig() { return this.get('/api/trunk-config'); },
  updateTrunkConfig(config) { return this.put('/api/trunk-config', config); },

  // Globals
  getGlobals() { return this.get('/api/globals'); },
  updateGlobals(globals) { return this.put('/api/globals', globals); },

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

  // Access Analyzer
  getAnalyzerTestNumbers() { return this.get('/api/access-analyzer/test-numbers'); },
  addAnalyzerTestNumber(payload) { return this.post('/api/access-analyzer/test-numbers', payload); },
  updateAnalyzerTestNumber(id, payload) { return this.put(`/api/access-analyzer/test-numbers/${id}`, payload); },
  deleteAnalyzerTestNumber(id) { return this.del(`/api/access-analyzer/test-numbers/${id}`); },
  getAnalyzerSettings() { return this.get('/api/access-analyzer/settings'); },
  updateAnalyzerSettings(payload) { return this.put('/api/access-analyzer/settings', payload); },
  startAnalyzerRun(payload = {}) { return this.post('/api/access-analyzer/run', payload); },
  getAnalyzerCurrentRun() { return this.get('/api/access-analyzer/runs/current'); },
  getAnalyzerRuns(limit = 10) { return this.get(`/api/access-analyzer/runs?limit=${limit}`); },
  getAnalyzerRun(id) { return this.get(`/api/access-analyzer/runs/${id}`); },
  updateAnalyzerRunResult(runId, resultId, payload) {
    return this.put(`/api/access-analyzer/runs/${runId}/results/${resultId}`, payload);
  },
};

export default API;
