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

  // Status
  getStatus() { return this.get('/api/status'); },
  getChannels() { return this.get('/api/channels'); },
  getModules() { return this.get('/api/modules'); },

  // Suppliers
  getSuppliers() { return this.get('/api/suppliers'); },
  addSupplier(sup) { return this.post('/api/suppliers', sup); },
  updateSupplier(id, sup) { return this.put(`/api/suppliers/${id}`, sup); },
  deleteSupplier(id) { return this.del(`/api/suppliers/${id}`); },

  // Numbers
  getNumbers() { return this.get('/api/numbers'); },
  addNumber(num) { return this.post('/api/numbers', num); },
  addBulkNumbers(nums) { return this.post('/api/numbers/bulk', { numbers: nums }); },
  updateNumber(id, num) { return this.put(`/api/numbers/${id}`, num); },
  deleteNumber(id) { return this.del(`/api/numbers/${id}`); },
  deletePrefix(country, countryCode, prefix) { return this.post('/api/numbers/delete-prefix', { country, countryCode, prefix }); },

  // DID Routes
  getDidRoutes() { return this.get('/api/did-routes'); },
  addDidRoute(route) { return this.post('/api/did-routes', route); },
  updateDidRoute(id, route) { return this.put(`/api/did-routes/${id}`, route); },
  deleteDidRoute(id) { return this.del(`/api/did-routes/${id}`); },

  // IVR
  getIvrMenus() { return this.get('/api/ivr-menus'); },
  addIvrMenu(menu) { return this.post('/api/ivr-menus', menu); },
  updateIvrMenu(id, menu) { return this.put(`/api/ivr-menus/${id}`, menu); },
  deleteIvrMenu(id) { return this.del(`/api/ivr-menus/${id}`); },

  // Ring Groups
  getRingGroups() { return this.get('/api/ring-groups'); },
  addRingGroup(group) { return this.post('/api/ring-groups', group); },
  updateRingGroup(id, group) { return this.put(`/api/ring-groups/${id}`, group); },
  deleteRingGroup(id) { return this.del(`/api/ring-groups/${id}`); },

  // Trunk
  getTrunkConfig() { return this.get('/api/trunk-config'); },
  updateTrunkConfig(config) { return this.put('/api/trunk-config', config); },

  // Globals
  getGlobals() { return this.get('/api/globals'); },
  updateGlobals(globals) { return this.put('/api/globals', globals); },

  // Apply
  apply() { return this.post('/api/apply', {}); },
  previewConfig() { return this.get('/api/preview-config'); },
};

export default API;
