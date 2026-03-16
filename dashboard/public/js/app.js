import API from './api.js';

const COUNTRIES = [
  { code: 'US', name: 'United States', dial: '1' },
  { code: 'UK', name: 'United Kingdom', dial: '44' },
  { code: 'DE', name: 'Germany', dial: '49' },
  { code: 'FR', name: 'France', dial: '33' },
  { code: 'ES', name: 'Spain', dial: '34' },
  { code: 'IT', name: 'Italy', dial: '39' },
  { code: 'NL', name: 'Netherlands', dial: '31' },
  { code: 'BE', name: 'Belgium', dial: '32' },
  { code: 'AT', name: 'Austria', dial: '43' },
  { code: 'CH', name: 'Switzerland', dial: '41' },
  { code: 'PL', name: 'Poland', dial: '48' },
  { code: 'SE', name: 'Sweden', dial: '46' },
  { code: 'NO', name: 'Norway', dial: '47' },
  { code: 'DK', name: 'Denmark', dial: '45' },
  { code: 'FI', name: 'Finland', dial: '358' },
  { code: 'PT', name: 'Portugal', dial: '351' },
  { code: 'IE', name: 'Ireland', dial: '353' },
  { code: 'AU', name: 'Australia', dial: '61' },
  { code: 'NZ', name: 'New Zealand', dial: '64' },
  { code: 'CA', name: 'Canada', dial: '1' },
  { code: 'BR', name: 'Brazil', dial: '55' },
  { code: 'IN', name: 'India', dial: '91' },
  { code: 'JP', name: 'Japan', dial: '81' },
  { code: 'CN', name: 'China', dial: '86' },
  { code: 'RU', name: 'Russia', dial: '7' },
  { code: 'ZA', name: 'South Africa', dial: '27' },
  { code: 'MX', name: 'Mexico', dial: '52' },
  { code: 'AR', name: 'Argentina', dial: '54' },
  { code: 'CL', name: 'Chile', dial: '56' },
  { code: 'CO', name: 'Colombia', dial: '57' },
  { code: 'BD', name: 'Bangladesh', dial: '880' },
  { code: 'PK', name: 'Pakistan', dial: '92' },
  { code: 'AE', name: 'UAE', dial: '971' },
  { code: 'SA', name: 'Saudi Arabia', dial: '966' },
  { code: 'EG', name: 'Egypt', dial: '20' },
  { code: 'NG', name: 'Nigeria', dial: '234' },
  { code: 'KE', name: 'Kenya', dial: '254' },
  { code: 'GH', name: 'Ghana', dial: '233' },
  { code: 'IL', name: 'Israel', dial: '972' },
  { code: 'TR', name: 'Turkey', dial: '90' },
  { code: 'SG', name: 'Singapore', dial: '65' },
  { code: 'MY', name: 'Malaysia', dial: '60' },
  { code: 'TH', name: 'Thailand', dial: '66' },
  { code: 'PH', name: 'Philippines', dial: '63' },
  { code: 'ID', name: 'Indonesia', dial: '62' },
  { code: 'VN', name: 'Vietnam', dial: '84' },
  { code: 'KR', name: 'South Korea', dial: '82' },
  { code: 'TW', name: 'Taiwan', dial: '886' },
  { code: 'HK', name: 'Hong Kong', dial: '852' },
];

let currentPage = 'dashboard';
let hasUnsavedChanges = false;
let statusInterval = null;

// Toast notifications
function toast(msg, type = 'success') {
  const c = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function markChanged() {
  hasUnsavedChanges = true;
  document.getElementById('apply-banner').classList.add('visible');
}

function markSaved() {
  hasUnsavedChanges = false;
  document.getElementById('apply-banner').classList.remove('visible');
}

// Navigation
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    if (page) navigateTo(page);
  });
});

function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  renderPage(page);
}

const pageTitles = {
  dashboard: 'Dashboard',
  'call-stats': 'Call Statistics',
  suppliers: 'Suppliers',
  numbers: 'Numbers',
  'did-routes': 'DID Routes',
  'ivr-menus': 'IVR Menus',
  'ring-groups': 'Ring Groups',
  trunk: 'Trunk Configuration',
  config: 'Config Preview'
};

async function renderPage(page) {
  const content = document.getElementById('content');
  if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }

  switch (page) {
    case 'dashboard': return renderDashboard(content);
    case 'call-stats': return renderCallStats(content);
    case 'suppliers': return renderSuppliers(content);
    case 'numbers': return renderNumbers(content);
    case 'did-routes': return renderDidRoutes(content);
    case 'ivr-menus': return renderIvrMenus(content);
    case 'ring-groups': return renderRingGroups(content);
    case 'trunk': return renderTrunk(content);
    case 'config': return renderConfig(content);
  }
}

// ---- DASHBOARD ----
async function renderDashboard(el) {
  el.innerHTML = '<div class="stats-grid" id="stats-grid"></div><div class="card"><div class="card-header"><h3>Live Channels</h3></div><div class="card-body padded" id="channels-box"><p class="empty-state">Loading...</p></div></div>';
  await refreshDashboard();
  statusInterval = setInterval(refreshDashboard, 5000);
}

async function refreshDashboard() {
  try {
    const [status, modules, didRoutes, ivrMenus, ringGroups] = await Promise.all([
      API.getStatus(), API.getModules(), API.getDidRoutes(), API.getIvrMenus(), API.getRingGroups()
    ]);

    document.getElementById('stats-grid').innerHTML = `
      <div class="stat-card">
        <div class="label">Status</div>
        <div class="value ${status.running ? 'green' : ''}">${status.running ? '<span class="status-dot green"></span>Running' : '<span class="status-dot red"></span>Stopped'}</div>
        <div class="sub">${status.uptime}</div>
      </div>
      <div class="stat-card">
        <div class="label">Active Calls</div>
        <div class="value blue">${status.activeCalls}</div>
        <div class="sub">${status.activeChannels} channels</div>
      </div>
      <div class="stat-card">
        <div class="label">DID Routes</div>
        <div class="value">${didRoutes.length}</div>
        <div class="sub">${ivrMenus.length} IVR menus</div>
      </div>
      <div class="stat-card">
        <div class="label">Ring Groups</div>
        <div class="value">${ringGroups.length}</div>
        <div class="sub">${ringGroups.reduce((s, g) => s + g.extensions.length, 0)} extensions</div>
      </div>
      <div class="stat-card">
        <div class="label">Modules</div>
        <div class="value">${modules.count}</div>
        <div class="sub">loaded</div>
      </div>
      <div class="stat-card">
        <div class="label">Memory</div>
        <div class="value amber">${status.freeRamMB}MB</div>
        <div class="sub">free of ${status.totalRamMB}MB</div>
      </div>
    `;

    const ch = await API.getChannels();
    document.getElementById('channels-box').innerHTML = ch.output
      ? `<pre style="font-size:12px;color:var(--text-muted);white-space:pre-wrap">${escHtml(ch.output)}</pre>`
      : '<p class="empty-state">No active channels</p>';
  } catch (err) {
    console.error('Dashboard refresh error:', err);
  }
}

// ---- CALL STATS ----
async function renderCallStats(el) {
  const stats = await API.getCallStats(24);

  el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Calls (24h)</div>
        <div class="value blue">${stats.totalCalls}</div>
        <div class="sub">${stats.callsPerMinute} calls/min avg</div>
      </div>
      <div class="stat-card">
        <div class="label">Answered</div>
        <div class="value green">${stats.answeredCalls}</div>
        <div class="sub">ASR: ${stats.asr}%</div>
      </div>
      <div class="stat-card">
        <div class="label">Failed</div>
        <div class="value" style="color:var(--danger)">${stats.failedCalls}</div>
        <div class="sub">${stats.totalCalls ? ((stats.failedCalls / stats.totalCalls) * 100).toFixed(1) : 0}% fail rate</div>
      </div>
      <div class="stat-card">
        <div class="label">ACD</div>
        <div class="value amber">${stats.acd}s</div>
        <div class="sub">avg call duration</div>
      </div>
      <div class="stat-card">
        <div class="label">Total Duration</div>
        <div class="value">${Math.round(stats.totalDuration / 60)}m</div>
        <div class="sub">${stats.totalDuration}s total</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Recent Calls</h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="renderCallStatsForHours(1)">1h</button>
          <button class="btn btn-outline btn-sm" onclick="renderCallStatsForHours(6)">6h</button>
          <button class="btn btn-primary btn-sm" onclick="renderCallStatsForHours(24)">24h</button>
        </div>
      </div>
      <div class="card-body">
        ${stats.recentCalls.length ? `
        <table>
          <thead><tr><th>Time</th><th>Source</th><th>Destination</th><th>Duration</th><th>Status</th></tr></thead>
          <tbody>${stats.recentCalls.map(c => {
            const statusClass = c.disposition === 'ANSWERED' ? 'badge-ring' : 'badge-direct';
            return `<tr>
              <td style="font-size:12px">${escHtml(c.start)}</td>
              <td style="font-family:monospace;font-size:12px">${escHtml(c.src)}</td>
              <td style="font-family:monospace;font-size:12px"><strong>${escHtml(c.dst)}</strong></td>
              <td>${c.billsec}s</td>
              <td><span class="badge ${statusClass}">${c.disposition}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<div class="empty-state">No calls recorded in this period.<br>CDR data is read from /var/log/asterisk/cdr-csv/Master.csv</div>'}
      </div>
    </div>`;
}
// expose for inline onclick handlers
window.renderCallStatsForHours = async (h) => {
  const stats = await API.getCallStats(h);
  const el = document.getElementById('content');
  renderCallStats(el);
};

// ---- SUPPLIERS ----
async function renderSuppliers(el) {
  const suppliers = await API.getSuppliers();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Suppliers (${suppliers.length})</h3>
        <button class="btn btn-primary" id="btn-add-sup">+ Add Supplier</button>
      </div>
      <div class="card-body">
        ${suppliers.length ? `
        <table>
          <thead><tr><th>Name</th><th>IP Addresses</th><th>DIDs</th><th></th></tr></thead>
          <tbody>${suppliers.map(s => `<tr>
            <td><strong>${escHtml(s.name)}</strong></td>
            <td>${s.ips.map(ip => `<span class="badge badge-ring" style="margin-right:4px;font-family:monospace">${ip}</span>`).join('')}</td>
            <td><span class="badge badge-ivr">${s.ips.length} IP${s.ips.length > 1 ? 's' : ''}</span></td>
            <td>
              <button class="btn-icon edit-sup" data-id="${s.id}">&#9998;</button>
              <button class="btn-icon del-sup" data-id="${s.id}">&#128465;</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>` : '<div class="empty-state">No suppliers configured</div>'}
      </div>
    </div>`;

  document.getElementById('btn-add-sup').onclick = () => showSupplierModal(null);
  el.querySelectorAll('.edit-sup').forEach(b => b.onclick = () => {
    const sup = suppliers.find(s => s.id === b.dataset.id);
    showSupplierModal(sup);
  });
  el.querySelectorAll('.del-sup').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this supplier? DID routes using this supplier will lose their supplier assignment.')) return;
    await API.deleteSupplier(b.dataset.id);
    markChanged();
    toast('Supplier deleted');
    renderSuppliers(el);
  });
}

function showSupplierModal(supplier) {
  const isEdit = !!supplier;
  showModal(isEdit ? 'Edit Supplier' : 'Add Supplier', `
    <div class="form-group">
      <label>Supplier Name</label>
      <input class="form-control" id="sup-name" value="${supplier?.name || ''}" placeholder="e.g. VoIP Provider ABC">
    </div>
    <div class="form-group">
      <label>IP Addresses (one per line)</label>
      <textarea class="form-control" id="sup-ips" rows="4" style="font-family:monospace;font-size:13px" placeholder="e.g.\n108.61.70.46\n108.61.70.47">${(supplier?.ips || []).join('\n')}</textarea>
    </div>
  `, async () => {
    const name = document.getElementById('sup-name').value.trim();
    const ips = document.getElementById('sup-ips').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!name) { toast('Supplier name is required', 'error'); return; }
    if (!ips.length) { toast('At least one IP address is required', 'error'); return; }

    if (isEdit) {
      await API.updateSupplier(supplier.id, { name, ips });
      toast('Supplier updated');
    } else {
      await API.addSupplier({ name, ips });
      toast('Supplier added');
    }
    markChanged();
    closeModal();
    renderPage('suppliers');
  });
}

// ---- NUMBERS ----
async function renderNumbers(el) {
  const numbers = await API.getNumbers();
  const suppliers = await API.getSuppliers();

  const byCountry = {};
  for (const n of numbers) {
    if (!byCountry[n.country]) byCountry[n.country] = {};
    const key = n.countryCode + '-' + n.prefix;
    if (!byCountry[n.country][key]) byCountry[n.country][key] = { countryCode: n.countryCode, prefix: n.prefix, rate: n.rate, numbers: [] };
    byCountry[n.country][key].numbers.push(n);
  }

  const countries = Object.keys(byCountry).sort();
  const totalNumbers = numbers.length;
  const totalPrefixes = Object.values(byCountry).reduce((s, c) => s + Object.keys(c).length, 0);

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="label">Total Numbers</div><div class="value blue">${totalNumbers}</div></div>
      <div class="stat-card"><div class="label">Countries</div><div class="value">${countries.length}</div></div>
      <div class="stat-card"><div class="label">Prefixes</div><div class="value">${totalPrefixes}</div></div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Number Inventory</h3>
        <button class="btn btn-primary" id="btn-add-number">+ Add Numbers</button>
      </div>
      <div class="card-body padded" id="numbers-list">
        ${countries.length ? countries.map(country => {
          const prefixes = byCountry[country];
          const prefixKeys = Object.keys(prefixes).sort();
          const countryTotal = prefixKeys.reduce((s, k) => s + prefixes[k].numbers.length, 0);
          const c = COUNTRIES.find(cc => cc.code === country);
          const countryName = c ? c.name : country;

          return `
          <div class="country-group">
            <div class="country-header" data-country="${country}">
              <h4><span class="arrow">&#9660;</span> ${escHtml(countryName)} (+${prefixes[prefixKeys[0]].countryCode})</h4>
              <span class="count">${countryTotal} number${countryTotal !== 1 ? 's' : ''} / ${prefixKeys.length} prefix${prefixKeys.length !== 1 ? 'es' : ''}</span>
            </div>
            <div class="country-body" data-country-body="${country}">
              ${prefixKeys.map(pk => {
                const pg = prefixes[pk];
                return `
                <div class="prefix-group">
                  <div class="prefix-header">
                    <div class="prefix-info">
                      <span class="prefix-code">+${pg.countryCode} ${pg.prefix}</span>
                      <span class="prefix-rate">$${pg.rate}/min</span>
                      <span class="prefix-count">${pg.numbers.length} number${pg.numbers.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                      <button class="btn btn-outline btn-sm edit-prefix-rate" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" data-rate="${pg.rate}">Edit Rate</button>
                      <button class="btn btn-danger btn-sm del-prefix" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}">Delete Prefix</button>
                    </div>
                  </div>
                  <div class="prefix-numbers">
                    <table>
                      <thead><tr><th>Full Number</th><th>Extension</th><th>Supplier</th><th></th></tr></thead>
                      <tbody>${pg.numbers.map(n => {
                        const sup = suppliers.find(s => s.id === n.supplierId);
                        return `<tr>
                          <td><strong style="font-family:monospace">+${n.countryCode}${n.prefix}${n.extension}</strong></td>
                          <td style="font-family:monospace">${n.extension}</td>
                          <td>${sup ? `<span class="badge badge-direct">${escHtml(sup.name)}</span>` : '-'}</td>
                          <td><button class="btn-icon del-num" data-id="${n.id}">&#128465;</button></td>
                        </tr>`;
                      }).join('')}</tbody>
                    </table>
                  </div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('') : '<div class="empty-state">No numbers in inventory. Click "+ Add Numbers" to get started.</div>'}
      </div>
    </div>`;

  el.querySelectorAll('.country-header').forEach(h => h.onclick = () => {
    h.classList.toggle('collapsed');
    const body = el.querySelector(`[data-country-body="${h.dataset.country}"]`);
    body.style.display = h.classList.contains('collapsed') ? 'none' : '';
  });

  document.getElementById('btn-add-number').onclick = () => showAddNumberModal(suppliers);

  el.querySelectorAll('.del-num').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this number?')) return;
    await API.deleteNumber(b.dataset.id);
    toast('Number deleted');
    renderNumbers(el);
  });

  el.querySelectorAll('.del-prefix').forEach(b => b.onclick = async () => {
    const prefix = b.dataset.prefix;
    const cc = b.dataset.cc;
    const country = b.dataset.country;
    if (!confirm(`Delete ALL numbers with prefix +${cc} ${prefix}?`)) return;
    const result = await API.deletePrefix(country, cc, prefix);
    toast(`Deleted ${result.deleted} numbers`);
    renderNumbers(el);
  });

  el.querySelectorAll('.edit-prefix-rate').forEach(b => b.onclick = () => {
    const currentRate = b.dataset.rate;
    const cc = b.dataset.cc;
    const prefix = b.dataset.prefix;
    const country = b.dataset.country;
    showModal('Edit Rate', `
      <div class="form-group">
        <label>Rate for +${cc} ${prefix} ($/min)</label>
        <input class="form-control" id="edit-rate-val" type="number" step="0.001" value="${currentRate}">
      </div>
    `, async () => {
      const newRate = document.getElementById('edit-rate-val').value;
      const nums = numbers.filter(n => n.country === country && n.countryCode === cc && n.prefix === prefix);
      for (const n of nums) {
        await API.updateNumber(n.id, { rate: newRate });
      }
      toast('Rate updated');
      closeModal();
      renderNumbers(el);
    });
  });
}

function showAddNumberModal(suppliers) {
  showModal('Add Numbers', `
    <div class="form-row-3">
      <div class="form-group">
        <label>Country</label>
        <select class="form-control" id="num-country">
          <option value="">Select country</option>
          ${COUNTRIES.map(c => `<option value="${c.code}" data-dial="${c.dial}">${c.name} (+${c.dial})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Prefix (area code)</label>
        <input class="form-control" id="num-prefix" placeholder="e.g. 202">
      </div>
      <div class="form-group">
        <label>Rate ($/min)</label>
        <input class="form-control" id="num-rate" type="number" step="0.001" value="0.01" placeholder="0.01">
      </div>
    </div>
    <div class="form-group">
      <label>Supplier</label>
      <select class="form-control" id="num-supplier">
        <option value="">— No Supplier —</option>
        ${suppliers.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:12px">
        Extensions
        <label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--primary)">
          <input type="checkbox" id="num-range-mode"> Range mode (from-to)
        </label>
      </label>
      <div id="num-ext-manual">
        <textarea class="form-control" id="num-extensions" rows="5" style="font-family:monospace" placeholder="5550100\n5550101\n5550102"></textarea>
      </div>
      <div id="num-ext-range" style="display:none">
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <input class="form-control" id="num-range-from" placeholder="From: 0000" style="font-family:monospace">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <input class="form-control" id="num-range-to" placeholder="To: 9999" style="font-family:monospace">
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px" id="num-range-count"></div>
      </div>
    </div>
    <div class="form-group">
      <label>Preview</label>
      <div id="num-preview" style="font-size:12px;color:var(--text-muted);font-family:monospace;padding:8px;background:var(--bg-input);border-radius:var(--radius);min-height:30px">Select country and enter extensions to preview</div>
    </div>
  `, async () => {
    const countrySelect = document.getElementById('num-country');
    const country = countrySelect.value;
    const countryCode = countrySelect.selectedOptions[0]?.dataset?.dial || '';
    const prefix = document.getElementById('num-prefix').value.trim();
    const rate = document.getElementById('num-rate').value || '0.01';
    const supplierId = document.getElementById('num-supplier').value;
    let extensions;
    const isRange = document.getElementById('num-range-mode').checked;
    if (isRange) {
      const from = parseInt(document.getElementById('num-range-from').value);
      const to = parseInt(document.getElementById('num-range-to').value);
      if (isNaN(from) || isNaN(to)) { toast('Enter valid from/to range', 'error'); return; }
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      if (end - start > 10000) { toast('Range too large (max 10000 numbers)', 'error'); return; }
      const padLen = String(end).length;
      extensions = [];
      for (let i = start; i <= end; i++) {
        extensions.push(String(i).padStart(padLen, '0'));
      }
    } else {
      extensions = document.getElementById('num-extensions').value.split('\n').map(s => s.trim()).filter(Boolean);
    }

    if (!country || !countryCode) { toast('Please select a country', 'error'); return; }
    if (!prefix) { toast('Prefix is required', 'error'); return; }
    if (!extensions.length) { toast('Enter at least one extension', 'error'); return; }

    const nums = extensions.map(ext => ({ country, countryCode, prefix, extension: ext, rate, supplierId }));
    await API.addBulkNumbers(nums);
    toast(`Added ${nums.length} numbers`);
    closeModal();
    renderPage('numbers');
  });

  function updatePreview() {
    const sel = document.getElementById('num-country');
    const cc = sel.selectedOptions[0]?.dataset?.dial || '?';
    const prefix = document.getElementById('num-prefix').value.trim() || '???';
    const preview = document.getElementById('num-preview');
    const isRange = document.getElementById('num-range-mode')?.checked;

    if (isRange) {
      const from = document.getElementById('num-range-from').value || '0000';
      const to = document.getElementById('num-range-to').value || '9999';
      preview.innerHTML = `+${cc}${prefix}${from} to +${cc}${prefix}${to}`;
    } else {
      const exts = document.getElementById('num-extensions').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!exts.length) {
        preview.textContent = `+${cc} ${prefix} + [extensions]`;
      } else {
        preview.innerHTML = exts.slice(0, 10).map(e => `+${cc}${prefix}${e}`).join('<br>') + (exts.length > 10 ? `<br>... and ${exts.length - 10} more` : '');
      }
    }
  }
  document.getElementById('num-country').onchange = updatePreview;
  document.getElementById('num-prefix').oninput = updatePreview;
  document.getElementById('num-extensions').oninput = updatePreview;
  document.getElementById('num-range-mode').onchange = (e) => {
    document.getElementById('num-ext-manual').style.display = e.target.checked ? 'none' : '';
    document.getElementById('num-ext-range').style.display = e.target.checked ? '' : 'none';
    updatePreview();
  };
  document.getElementById('num-range-from').oninput = () => {
    const from = parseInt(document.getElementById('num-range-from').value);
    const to = parseInt(document.getElementById('num-range-to').value);
    if (!isNaN(from) && !isNaN(to)) {
      const count = Math.abs(to - from) + 1;
      document.getElementById('num-range-count').textContent = `${count} numbers will be generated`;
    }
    updatePreview();
  };
  document.getElementById('num-range-to').oninput = document.getElementById('num-range-from').oninput;
}

// ---- DID ROUTES ----
async function renderDidRoutes(el) {
  const routes = await API.getDidRoutes();
  const ivrMenus = await API.getIvrMenus();
  const ringGroups = await API.getRingGroups();
  const suppliers = await API.getSuppliers();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>DID Routes (${routes.length})</h3>
        <button class="btn btn-primary" id="btn-add-did">+ Add DID Route</button>
      </div>
      <div class="card-body">
        ${routes.length ? `
        <table>
          <thead><tr><th>DID Number</th><th>Description</th><th>Supplier</th><th>Destination</th><th>Target</th><th></th></tr></thead>
          <tbody>${routes.map(r => {
            let targetName = r.destinationId;
            if (r.destinationType === 'ivr') { const m = ivrMenus.find(i => i.id === r.destinationId); targetName = m ? m.name : r.destinationId; }
            if (r.destinationType === 'ring_group') { const g = ringGroups.find(i => i.id === r.destinationId); targetName = g ? g.name : r.destinationId; }
            const badge = r.destinationType === 'ivr' ? 'badge-ivr' : r.destinationType === 'ring_group' ? 'badge-ring' : 'badge-direct';
            const sup = suppliers.find(s => s.id === r.supplierId);
            const supName = sup ? sup.name : '<span style="color:var(--text-muted)">—</span>';
            return `<tr>
              <td><strong>${r.didNumber}</strong></td>
              <td>${r.description || '-'}</td>
              <td><span class="badge badge-direct">${sup ? escHtml(sup.name) : 'None'}</span></td>
              <td><span class="badge ${badge}">${r.destinationType.replace('_', ' ')}</span></td>
              <td>${targetName}</td>
              <td>
                <button class="btn-icon edit-did" data-id="${r.id}" title="Edit">&#9998;</button>
                <button class="btn-icon del-did" data-id="${r.id}" title="Delete">&#128465;</button>
              </td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<div class="empty-state">No DID routes configured</div>'}
      </div>
    </div>`;

  document.getElementById('btn-add-did').onclick = () => showDidModal(null, ivrMenus, ringGroups, suppliers);
  el.querySelectorAll('.edit-did').forEach(b => b.onclick = () => {
    const route = routes.find(r => r.id === b.dataset.id);
    showDidModal(route, ivrMenus, ringGroups, suppliers);
  });
  el.querySelectorAll('.del-did').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this DID route?')) return;
    await API.deleteDidRoute(b.dataset.id);
    markChanged();
    toast('DID route deleted');
    renderDidRoutes(el);
  });
}

async function showDidModal(route, ivrMenus, ringGroups, suppliers) {
  const isEdit = !!route;
  const destType = route?.destinationType || 'ivr';
  const numbers = await API.getNumbers();

  function optionsFor(type) {
    if (type === 'ivr') return ivrMenus.map(m => `<option value="${m.id}" ${route?.destinationId === m.id ? 'selected' : ''}>${m.name}</option>`).join('');
    if (type === 'ring_group') return ringGroups.map(g => `<option value="${g.id}" ${route?.destinationId === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
    return '';
  }

  showModal(isEdit ? 'Edit DID Route' : 'Add DID Route', `
    <div class="form-group">
      <label>DID Number (from inventory or manual)</label>
      <div style="display:flex;gap:8px;">
        <select class="form-control" id="did-from-inventory" style="flex:1">
          <option value="">— Pick from Numbers —</option>
        </select>
        <span style="padding:8px;color:var(--text-muted)">or</span>
        <input class="form-control" id="did-number" value="${route?.didNumber || ''}" placeholder="Manual: 12025550100" style="flex:1">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Supplier</label>
        <select class="form-control" id="did-supplier">
          <option value="">— No Supplier —</option>
          ${(suppliers || []).map(s => `<option value="${s.id}" ${route?.supplierId === s.id ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Description</label>
        <input class="form-control" id="did-desc" value="${route?.description || ''}" placeholder="e.g. Main Office Line">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Destination Type</label>
        <select class="form-control" id="did-dest-type">
          <option value="ivr" ${destType === 'ivr' ? 'selected' : ''}>IVR Menu</option>
          <option value="ring_group" ${destType === 'ring_group' ? 'selected' : ''}>Ring Group</option>
          <option value="direct" ${destType === 'direct' ? 'selected' : ''}>Direct Extension</option>
        </select>
      </div>
      <div class="form-group">
        <label>Target</label>
        <select class="form-control" id="did-dest-id">${optionsFor(destType)}</select>
      </div>
    </div>
    <div class="form-group" id="did-direct-ext" style="display:${destType === 'direct' ? 'block' : 'none'}">
      <label>Extension Number</label>
      <input class="form-control" id="did-direct-ext-val" value="${destType === 'direct' ? (route?.destinationId || '') : ''}" placeholder="e.g. 2001">
    </div>
  `, async () => {
    const didNumber = document.getElementById('did-number').value.trim();
    const description = document.getElementById('did-desc').value.trim();
    const supplierId = document.getElementById('did-supplier').value || '';
    const destinationType = document.getElementById('did-dest-type').value;
    let destinationId;
    if (destinationType === 'direct') {
      destinationId = document.getElementById('did-direct-ext-val').value.trim();
    } else {
      destinationId = document.getElementById('did-dest-id').value;
    }
    if (!didNumber) { toast('DID number required', 'error'); return; }

    if (isEdit) {
      await API.updateDidRoute(route.id, { didNumber, description, supplierId, destinationType, destinationId });
      toast('DID route updated');
    } else {
      await API.addDidRoute({ didNumber, description, supplierId, destinationType, destinationId });
      toast('DID route added');
    }
    markChanged();
    closeModal();
    renderPage('did-routes');
  });

  document.getElementById('did-dest-type').onchange = (e) => {
    const type = e.target.value;
    const sel = document.getElementById('did-dest-id');
    const directBox = document.getElementById('did-direct-ext');
    if (type === 'direct') {
      sel.parentElement.style.display = 'none';
      directBox.style.display = 'block';
    } else {
      sel.parentElement.style.display = '';
      directBox.style.display = 'none';
      sel.innerHTML = optionsFor(type);
    }
  };

  const invSelect = document.getElementById('did-from-inventory');
  const grouped = {};
  for (const n of numbers) {
    const fullNum = n.countryCode + n.prefix + n.extension;
    const label = `+${n.countryCode} ${n.prefix} ${n.extension}`;
    if (!grouped[n.country]) grouped[n.country] = [];
    grouped[n.country].push({ fullNum, label, n });
  }
  for (const [country, nums] of Object.entries(grouped).sort()) {
    const c = COUNTRIES.find(cc => cc.code === country);
    const optgroup = document.createElement('optgroup');
    optgroup.label = c ? c.name : country;
    for (const { fullNum, label, n } of nums) {
      const opt = document.createElement('option');
      opt.value = fullNum;
      opt.textContent = label;
      opt.dataset.supplierId = n.supplierId || '';
      optgroup.appendChild(opt);
    }
    invSelect.appendChild(optgroup);
  }
  invSelect.onchange = () => {
    const val = invSelect.value;
    if (val) {
      document.getElementById('did-number').value = val;
      const opt = invSelect.selectedOptions[0];
      if (opt.dataset.supplierId) {
        document.getElementById('did-supplier').value = opt.dataset.supplierId;
      }
    }
  };
}

// ---- IVR MENUS ----
async function renderIvrMenus(el) {
  const menus = await API.getIvrMenus();
  const ringGroups = await API.getRingGroups();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>IVR Menus (${menus.length})</h3>
        <button class="btn btn-primary" id="btn-add-ivr">+ Add IVR Menu</button>
      </div>
      <div class="card-body">
        ${menus.length ? `
        <table>
          <thead><tr><th>Name</th><th>Audio File</th><th>Options</th><th>Timeout</th><th></th></tr></thead>
          <tbody>${menus.map(m => `<tr>
            <td><strong>${escHtml(m.name)}</strong></td>
            <td><code>${escHtml(m.audioFile)}</code></td>
            <td>${(m.options||[]).map(o => `<span class="badge badge-ivr" style="margin-right:4px">${o.digit}: ${o.label || o.actionTarget}</span>`).join('')}</td>
            <td>${m.timeoutAction}</td>
            <td>
              <button class="btn-icon edit-ivr" data-id="${m.id}">&#9998;</button>
              <button class="btn-icon del-ivr" data-id="${m.id}">&#128465;</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>` : '<div class="empty-state">No IVR menus configured</div>'}
      </div>
    </div>`;

  document.getElementById('btn-add-ivr').onclick = () => showIvrModal(null, ringGroups, menus);
  el.querySelectorAll('.edit-ivr').forEach(b => b.onclick = () => {
    const menu = menus.find(m => m.id === b.dataset.id);
    showIvrModal(menu, ringGroups, menus);
  });
  el.querySelectorAll('.del-ivr').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this IVR menu?')) return;
    await API.deleteIvrMenu(b.dataset.id);
    markChanged();
    toast('IVR menu deleted');
    renderIvrMenus(el);
  });
}

function showIvrModal(menu, ringGroups, allMenus) {
  const isEdit = !!menu;
  const options = menu?.options || [{ digit: '1', actionType: 'ring_group', actionTarget: '', label: '' }];

  function renderOptions(opts) {
    return opts.map((o, i) => `
      <div class="ivr-option-row">
        <input class="form-control ivr-digit" value="${o.digit}" placeholder="#">
        <select class="form-control ivr-action-type">
          <option value="ring_group" ${o.actionType === 'ring_group' ? 'selected' : ''}>Ring Group</option>
          <option value="ivr" ${o.actionType === 'ivr' ? 'selected' : ''}>IVR Menu</option>
          <option value="direct" ${o.actionType === 'direct' ? 'selected' : ''}>Extension</option>
        </select>
        <select class="form-control ivr-action-target">
          ${o.actionType === 'ring_group' ? ringGroups.map(g => `<option value="${g.id}" ${o.actionTarget === g.id ? 'selected' : ''}>${g.name}</option>`).join('') : ''}
          ${o.actionType === 'ivr' ? allMenus.map(m => `<option value="${m.id}" ${o.actionTarget === m.id ? 'selected' : ''}>${m.name}</option>`).join('') : ''}
        </select>
        <input class="form-control ivr-label" value="${o.label || ''}" placeholder="Label">
        <button class="btn-icon ivr-del-opt" data-idx="${i}">&#10005;</button>
      </div>
    `).join('');
  }

  showModal(isEdit ? 'Edit IVR Menu' : 'Add IVR Menu', `
    <div class="form-row">
      <div class="form-group">
        <label>Menu Name</label>
        <input class="form-control" id="ivr-name" value="${menu?.name || ''}" placeholder="e.g. Main IVR">
      </div>
      <div class="form-group">
        <label>Audio File</label>
        <input class="form-control" id="ivr-audio" value="${menu?.audioFile || ''}" placeholder="e.g. custom/main-menu">
      </div>
    </div>
    <div class="form-group">
      <label>DTMF Options</label>
      <div id="ivr-options">${renderOptions(options)}</div>
      <button class="btn btn-outline btn-sm" id="ivr-add-opt" style="margin-top:8px">+ Add Option</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Timeout Action</label>
        <select class="form-control" id="ivr-timeout">
          <option value="hangup" ${menu?.timeoutAction === 'hangup' ? 'selected' : ''}>Hangup</option>
          <option value="replay" ${menu?.timeoutAction === 'replay' ? 'selected' : ''}>Replay</option>
        </select>
      </div>
      <div class="form-group">
        <label>Invalid Input Action</label>
        <select class="form-control" id="ivr-invalid">
          <option value="replay" ${menu?.invalidAction === 'replay' ? 'selected' : ''}>Replay Menu</option>
          <option value="hangup" ${menu?.invalidAction === 'hangup' ? 'selected' : ''}>Hangup</option>
        </select>
      </div>
    </div>
  `, async () => {
    const name = document.getElementById('ivr-name').value.trim();
    const audioFile = document.getElementById('ivr-audio').value.trim();
    const timeoutAction = document.getElementById('ivr-timeout').value;
    const invalidAction = document.getElementById('ivr-invalid').value;
    if (!name) { toast('Name is required', 'error'); return; }

    const optRows = document.querySelectorAll('.ivr-option-row');
    const opts = Array.from(optRows).map(row => ({
      digit: row.querySelector('.ivr-digit').value.trim(),
      actionType: row.querySelector('.ivr-action-type').value,
      actionTarget: row.querySelector('.ivr-action-target')?.value || row.querySelector('.ivr-label')?.value || '',
      label: row.querySelector('.ivr-label').value.trim()
    })).filter(o => o.digit);

    const data = { name, audioFile, options: opts, timeoutAction, invalidAction };
    if (isEdit) {
      await API.updateIvrMenu(menu.id, data);
      toast('IVR menu updated');
    } else {
      await API.addIvrMenu(data);
      toast('IVR menu added');
    }
    markChanged();
    closeModal();
    renderPage('ivr-menus');
  });

  document.getElementById('ivr-add-opt').onclick = () => {
    const container = document.getElementById('ivr-options');
    const div = document.createElement('div');
    div.innerHTML = renderOptions([{ digit: '', actionType: 'ring_group', actionTarget: '', label: '' }]);
    container.appendChild(div.firstElementChild);
  };
}

// ---- RING GROUPS ----
async function renderRingGroups(el) {
  const groups = await API.getRingGroups();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Ring Groups (${groups.length})</h3>
        <button class="btn btn-primary" id="btn-add-rg">+ Add Ring Group</button>
      </div>
      <div class="card-body">
        ${groups.length ? `
        <table>
          <thead><tr><th>Name</th><th>Extensions</th><th>Ring Timeout</th><th>Voicemail</th><th></th></tr></thead>
          <tbody>${groups.map(g => `<tr>
            <td><strong>${escHtml(g.name)}</strong></td>
            <td>${g.extensions.map(e => `<span class="badge badge-ring">${e}</span>`).join(' ')}</td>
            <td>${g.ringTimeout}s</td>
            <td>${g.voicemailExt || '-'}</td>
            <td>
              <button class="btn-icon edit-rg" data-id="${g.id}">&#9998;</button>
              <button class="btn-icon del-rg" data-id="${g.id}">&#128465;</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>` : '<div class="empty-state">No ring groups configured</div>'}
      </div>
    </div>`;

  document.getElementById('btn-add-rg').onclick = () => showRgModal(null);
  el.querySelectorAll('.edit-rg').forEach(b => b.onclick = () => showRgModal(groups.find(g => g.id === b.dataset.id)));
  el.querySelectorAll('.del-rg').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this ring group?')) return;
    await API.deleteRingGroup(b.dataset.id);
    markChanged();
    toast('Ring group deleted');
    renderRingGroups(el);
  });
}

function showRgModal(group) {
  const isEdit = !!group;
  showModal(isEdit ? 'Edit Ring Group' : 'Add Ring Group', `
    <div class="form-group">
      <label>Group Name</label>
      <input class="form-control" id="rg-name" value="${group?.name || ''}" placeholder="e.g. Sales Team">
    </div>
    <div class="form-group">
      <label>Extensions (comma-separated)</label>
      <input class="form-control" id="rg-ext" value="${group?.extensions?.join(', ') || ''}" placeholder="e.g. 2001, 2002, 2003">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Ring Timeout (seconds)</label>
        <input class="form-control" type="number" id="rg-timeout" value="${group?.ringTimeout || 25}" min="5" max="120">
      </div>
      <div class="form-group">
        <label>Voicemail Extension</label>
        <input class="form-control" id="rg-vm" value="${group?.voicemailExt || ''}" placeholder="e.g. 2001">
      </div>
    </div>
  `, async () => {
    const name = document.getElementById('rg-name').value.trim();
    const extensions = document.getElementById('rg-ext').value.split(',').map(s => s.trim()).filter(Boolean);
    const ringTimeout = parseInt(document.getElementById('rg-timeout').value) || 25;
    const voicemailExt = document.getElementById('rg-vm').value.trim();
    if (!name || !extensions.length) { toast('Name and at least one extension required', 'error'); return; }

    const data = { name, extensions, ringTimeout, voicemailExt };
    if (isEdit) {
      await API.updateRingGroup(group.id, data);
      toast('Ring group updated');
    } else {
      await API.addRingGroup(data);
      toast('Ring group added');
    }
    markChanged();
    closeModal();
    renderPage('ring-groups');
  });
}

// ---- TRUNK ----
async function renderTrunk(el) {
  const trunk = await API.getTrunkConfig();
  const globals = await API.getGlobals();

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>SIP Trunk Configuration</h3></div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Supplier IPs are now managed per-supplier in the <a href="#" onclick="event.preventDefault();navigateTo('suppliers')" style="color:var(--primary)">Suppliers</a> page.</p>
        <div class="form-row">
          <div class="form-group">
            <label>Your Public IP (this VPS)</label>
            <input class="form-control" id="trunk-pip" value="${trunk.publicIp}">
          </div>
          <div class="form-group">
            <label>Bind Port</label>
            <input class="form-control" type="number" id="trunk-port" value="${trunk.bindPort}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Codecs (comma-separated, priority order)</label>
            <input class="form-control" id="trunk-codecs" value="${trunk.codecs.join(', ')}">
          </div>
          <div class="form-group">
            <label>Qualify Frequency (seconds)</label>
            <input class="form-control" type="number" id="trunk-qf" value="${trunk.qualifyFrequency}">
          </div>
        </div>
        <div class="form-group">
          <label>User Agent</label>
          <input class="form-control" id="trunk-ua" value="${trunk.userAgent}">
        </div>
        <button class="btn btn-primary" id="btn-save-trunk" style="margin-top:12px">Save Trunk Config</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Global Settings</h3></div>
      <div class="card-body padded">
        <div class="form-row">
          <div class="form-group">
            <label>IVR Response Timeout (seconds)</label>
            <input class="form-control" type="number" id="glob-resp" value="${globals.ivrResponseTimeout}">
          </div>
          <div class="form-group">
            <label>IVR Digit Timeout (seconds)</label>
            <input class="form-control" type="number" id="glob-digit" value="${globals.ivrDigitTimeout}">
          </div>
        </div>
        <button class="btn btn-primary" id="btn-save-globals" style="margin-top:12px">Save Global Settings</button>
      </div>
    </div>`;

  document.getElementById('btn-save-trunk').onclick = async () => {
    await API.updateTrunkConfig({
      publicIp: document.getElementById('trunk-pip').value.trim(),
      userAgent: document.getElementById('trunk-ua').value.trim(),
      bindPort: parseInt(document.getElementById('trunk-port').value) || 5060,
      codecs: document.getElementById('trunk-codecs').value.split(',').map(s => s.trim()).filter(Boolean),
      qualifyFrequency: parseInt(document.getElementById('trunk-qf').value) || 60
    });
    markChanged();
    toast('Trunk config saved');
  };

  document.getElementById('btn-save-globals').onclick = async () => {
    await API.updateGlobals({
      ivrResponseTimeout: parseInt(document.getElementById('glob-resp').value) || 7,
      ivrDigitTimeout: parseInt(document.getElementById('glob-digit').value) || 5
    });
    markChanged();
    toast('Global settings saved');
  };
}

// ---- CONFIG PREVIEW ----
async function renderConfig(el) {
  const config = await API.previewConfig();
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>extensions.conf</h3></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(config.extensionsConf)}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>pjsip.conf</h3></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(config.pjsipConf)}</div></div>
    </div>`;
}

// ---- MODAL ----
function showModal(title, body, onSave) {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="btn-icon modal-close">&#10005;</button>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-footer">
        <button class="btn btn-outline modal-cancel">Cancel</button>
        <button class="btn btn-primary modal-save">Save</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);
  backdrop.querySelector('.modal-close').onclick = closeModal;
  backdrop.querySelector('.modal-cancel').onclick = closeModal;
  backdrop.querySelector('.modal-save').onclick = onSave;
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
}

function closeModal() {
  const m = document.querySelector('.modal-backdrop');
  if (m) m.remove();
}

// Apply button
document.getElementById('btn-apply').onclick = async () => {
  document.getElementById('btn-apply').textContent = 'Applying...';
  try {
    const result = await API.apply();
    if (result.ok) {
      toast('Configuration applied and Asterisk reloaded!');
      markSaved();
    } else {
      toast('Apply failed: ' + result.message, 'error');
    }
  } catch (err) {
    toast('Apply error: ' + err.message, 'error');
  }
  document.getElementById('btn-apply').textContent = 'Apply Changes';
};

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

document.getElementById('btn-logout').onclick = async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
};

// Mobile menu toggle
const sidebar = document.querySelector('.sidebar');
const overlay = document.getElementById('sidebar-overlay');
document.getElementById('btn-menu').onclick = () => {
  sidebar.classList.add('open');
  overlay.classList.add('visible');
};
function closeMobileMenu() {
  sidebar.classList.remove('open');
  overlay.classList.remove('visible');
}
overlay.onclick = closeMobileMenu;
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', closeMobileMenu);
});

// Init
navigateTo('dashboard');
