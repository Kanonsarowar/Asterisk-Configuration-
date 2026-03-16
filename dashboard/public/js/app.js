import API from './api.js';

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

// ---- DID ROUTES ----
async function renderDidRoutes(el) {
  const routes = await API.getDidRoutes();
  const ivrMenus = await API.getIvrMenus();
  const ringGroups = await API.getRingGroups();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>DID Routes (${routes.length})</h3>
        <button class="btn btn-primary" id="btn-add-did">+ Add DID Route</button>
      </div>
      <div class="card-body">
        ${routes.length ? `
        <table>
          <thead><tr><th>DID Number</th><th>Description</th><th>Destination</th><th>Target</th><th></th></tr></thead>
          <tbody>${routes.map(r => {
            let targetName = r.destinationId;
            if (r.destinationType === 'ivr') { const m = ivrMenus.find(i => i.id === r.destinationId); targetName = m ? m.name : r.destinationId; }
            if (r.destinationType === 'ring_group') { const g = ringGroups.find(i => i.id === r.destinationId); targetName = g ? g.name : r.destinationId; }
            const badge = r.destinationType === 'ivr' ? 'badge-ivr' : r.destinationType === 'ring_group' ? 'badge-ring' : 'badge-direct';
            return `<tr>
              <td><strong>${r.didNumber}</strong></td>
              <td>${r.description || '-'}</td>
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

  document.getElementById('btn-add-did').onclick = () => showDidModal(null, ivrMenus, ringGroups);
  el.querySelectorAll('.edit-did').forEach(b => b.onclick = () => {
    const route = routes.find(r => r.id === b.dataset.id);
    showDidModal(route, ivrMenus, ringGroups);
  });
  el.querySelectorAll('.del-did').forEach(b => b.onclick = async () => {
    if (!confirm('Delete this DID route?')) return;
    await API.deleteDidRoute(b.dataset.id);
    markChanged();
    toast('DID route deleted');
    renderDidRoutes(el);
  });
}

function showDidModal(route, ivrMenus, ringGroups) {
  const isEdit = !!route;
  const destType = route?.destinationType || 'ivr';

  function optionsFor(type) {
    if (type === 'ivr') return ivrMenus.map(m => `<option value="${m.id}" ${route?.destinationId === m.id ? 'selected' : ''}>${m.name}</option>`).join('');
    if (type === 'ring_group') return ringGroups.map(g => `<option value="${g.id}" ${route?.destinationId === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
    return '';
  }

  showModal(isEdit ? 'Edit DID Route' : 'Add DID Route', `
    <div class="form-group">
      <label>DID Number</label>
      <input class="form-control" id="did-number" value="${route?.didNumber || ''}" placeholder="e.g. 12025550100">
    </div>
    <div class="form-group">
      <label>Description</label>
      <input class="form-control" id="did-desc" value="${route?.description || ''}" placeholder="e.g. Main Office Line">
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
    const destinationType = document.getElementById('did-dest-type').value;
    let destinationId;
    if (destinationType === 'direct') {
      destinationId = document.getElementById('did-direct-ext-val').value.trim();
    } else {
      destinationId = document.getElementById('did-dest-id').value;
    }
    if (!didNumber) { toast('DID number required', 'error'); return; }

    if (isEdit) {
      await API.updateDidRoute(route.id, { didNumber, description, destinationType, destinationId });
      toast('DID route updated');
    } else {
      await API.addDidRoute({ didNumber, description, destinationType, destinationId });
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

  const ips = trunk.supplierIps || (trunk.supplierIp ? [trunk.supplierIp] : []);

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>SIP Trunk Configuration</h3></div>
      <div class="card-body padded">
        <div class="form-group">
          <label>Supplier IPs (one per line — all IPs will be matched for inbound authentication)</label>
          <textarea class="form-control" id="trunk-sips" rows="6" style="font-family:monospace;font-size:13px">${ips.join('\n')}</textarea>
        </div>
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
    const supplierIps = document.getElementById('trunk-sips').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    await API.updateTrunkConfig({
      supplierIps,
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

// Init
navigateTo('dashboard');
