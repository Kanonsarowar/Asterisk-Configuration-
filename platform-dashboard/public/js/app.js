const LS_TOKEN = 'iprn_jwt';
const LS_USER = 'iprn_user';

let token = localStorage.getItem(LS_TOKEN);
let user = null;
try {
  user = JSON.parse(localStorage.getItem(LS_USER) || 'null');
} catch {
  user = null;
}

const $ = (id) => document.getElementById(id);

/** JWT APIs live under /api; /login stays on root for Asterisk compatibility. */
function apiUrl(path) {
  if (path.startsWith('/login')) return path;
  if (path.startsWith('/api/')) return path;
  return `/api${path.startsWith('/') ? path : `/${path}`}`;
}

async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(opts.body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(apiUrl(path), { ...opts, headers });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${r.status}`);
  return data;
}

const NAV = [
  { id: 'dashboard', label: 'Dashboard', roles: ['admin', 'reseller', 'client'] },
  { id: 'numbers', label: 'Numbers', roles: ['admin', 'reseller', 'client'] },
  { id: 'customers', label: 'Customers', roles: ['admin', 'reseller', 'client'] },
  { id: 'suppliers', label: 'Suppliers', roles: ['admin', 'reseller'] },
  { id: 'ivr', label: 'IVR Audio', roles: ['admin', 'reseller', 'client'] },
  { id: 'routing', label: 'Routing', roles: ['admin', 'reseller'] },
  { id: 'cdr', label: 'Call Logs', roles: ['admin', 'reseller', 'client'] },
  { id: 'reports', label: 'Reports', roles: ['admin', 'reseller', 'client'] },
];

function showApp() {
  $('login-screen').classList.add('hidden');
  $('app-shell').classList.remove('hidden');
  $('user-label').textContent = `${user?.username} (${user?.role})`;
  const nav = $('nav');
  nav.innerHTML = '';
  const role = user?.role || 'client';
  for (const item of NAV) {
    if (!item.roles.includes(role)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = item.label;
    b.onclick = () => navigate(item.id);
    nav.appendChild(b);
  }
  navigate('dashboard');
}

function navigate(page) {
  $('page-title').textContent = NAV.find((n) => n.id === page)?.label || page;
  const map = {
    dashboard: renderDashboard,
    numbers: renderNumbers,
    customers: renderCustomers,
    suppliers: renderSuppliers,
    ivr: renderIvr,
    routing: renderRouting,
    cdr: renderCdr,
    reports: renderReports,
  };
  (map[page] || renderDashboard)().catch((e) => {
    $('content').innerHTML = `<p class="err">${escapeHtml(e.message)}</p>`;
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function renderDashboard() {
  const s = await api('/dashboard/summary');
  $('content').innerHTML = `
    <div class="grid">
      <div class="card"><div class="lbl">Revenue today (UTC)</div><div class="val">$${Number(s.revenue_today).toFixed(2)}</div></div>
      <div class="card"><div class="lbl">Profit today</div><div class="val">$${Number(s.profit_today).toFixed(2)}</div></div>
      <div class="card"><div class="lbl">ASR %</div><div class="val">${escapeHtml(String(s.asr_percent))}</div></div>
      <div class="card"><div class="lbl">ACD (sec answered)</div><div class="val">${escapeHtml(String(Math.round(s.acd_seconds || 0)))}</div></div>
      <div class="card"><div class="lbl">Total numbers</div><div class="val">${s.total_numbers}</div></div>
      <div class="card"><div class="lbl">Calls 24h</div><div class="val">${s.calls_24h}</div></div>
      <div class="card"><div class="lbl">Active calls</div><div class="val">${s.active_calls ?? '—'}</div><p class="muted">${escapeHtml(s.active_calls_note || '')}</p></div>
    </div>`;
}

async function renderNumbers() {
  const { numbers } = await api('/numbers');
  const { customers } = await api('/customers').catch(() => ({ customers: [] }));
  const custOpts = customers.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const rows = numbers
    .map(
      (n) => `<tr>
      <td><input type="checkbox" class="num-chk" value="${n.id}" /></td>
      <td style="font-family:monospace">${escapeHtml(n.did)}</td>
      <td>${escapeHtml(n.country || '')}</td>
      <td><span class="badge">${escapeHtml(n.status)}</span></td>
      <td>${escapeHtml(n.customer_name || '—')}</td>
      <td>${escapeHtml(n.ivr_name || '—')}</td>
    </tr>`
    )
    .join('');
  $('content').innerHTML = `
    <div class="form-row">
      <label>Bulk CSV (did,country,prefix,supplier_id,sell_rate)</label>
      <textarea id="num-csv"></textarea>
      <button type="button" class="btn primary" id="num-import">Import</button>
    </div>
    <div class="form-row">
      <label>Assign selected to customer</label>
      <select id="num-assign-cust">${custOpts}</select>
      <button type="button" class="btn" id="num-assign">Assign</button>
    </div>
    <div class="form-row">
      <label>Status for selected</label>
      <select id="num-st">
        <option value="available">available</option>
        <option value="assigned">assigned</option>
        <option value="testing">testing</option>
        <option value="blocked">blocked</option>
      </select>
      <button type="button" class="btn" id="num-status">Update status</button>
    </div>
    <table class="data"><thead><tr><th></th><th>DID</th><th>Country</th><th>Status</th><th>Customer</th><th>IVR</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No numbers</td></tr>'}</tbody></table>`;

  $('num-import').onclick = async () => {
    const csv = $('num-csv').value.trim();
    if (!csv) return;
    await api('/numbers/import', { method: 'POST', body: { csv } });
    navigate('numbers');
  };
  $('num-assign').onclick = async () => {
    const ids = [...document.querySelectorAll('.num-chk:checked')].map((x) => +x.value);
    const customer_id = +$('num-assign-cust').value;
    if (!ids.length) return;
    await api('/numbers/assign', { method: 'POST', body: { number_ids: ids, customer_id } });
    navigate('numbers');
  };
  $('num-status').onclick = async () => {
    const ids = [...document.querySelectorAll('.num-chk:checked')].map((x) => +x.value);
    const status = $('num-st').value;
    if (!ids.length) return;
    await api('/numbers/update-status', { method: 'POST', body: { ids, status } });
    navigate('numbers');
  };
}

async function renderCustomers() {
  const { customers } = await api('/customers');
  const rows = customers
    .map(
      (c) => `<tr><td>${c.id}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.status)}</td>
      <td>${c.assigned_numbers ?? 0}</td></tr>`
    )
    .join('');
  const showForm = user?.role !== 'client';
  $('content').innerHTML = `
    ${showForm ? `<div class="form-row"><label>Name</label><input id="c-name" /><label style="margin-top:8px">Link user id (optional)</label><input id="c-user" type="number" />
    <button type="button" class="btn primary" id="c-add">Add customer</button></div>` : ''}
    <table class="data"><thead><tr><th>ID</th><th>Name</th><th>Status</th><th># Numbers</th></tr></thead>
    <tbody>${rows || ''}</tbody></table>`;
  const btn = $('c-add');
  if (btn) {
    btn.onclick = async () => {
      const name = $('c-name').value.trim();
      const user_id = $('c-user').value ? +$('c-user').value : null;
      if (!name) return;
      await api('/customers', { method: 'POST', body: { name, user_id } });
      navigate('customers');
    };
  }
}

async function renderSuppliers() {
  const { suppliers } = await api('/suppliers');
  const rows = suppliers
    .map(
      (s) => `<tr><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.sip_host)}</td><td>${s.cost_per_minute}</td><td>${s.routing_priority}</td></tr>`
    )
    .join('');
  $('content').innerHTML = `
    <div class="form-row">
      <label>Name</label><input id="s-name" />
      <label>SIP host</label><input id="s-host" />
      <label>User / pass</label><input id="s-user" /><input id="s-pass" type="password" />
      <label>Cost / min</label><input id="s-cost" type="number" step="0.000001" value="0" />
      <label>Priority</label><input id="s-pri" type="number" value="100" />
      <button type="button" class="btn primary" id="s-add">Add supplier</button>
    </div>
    <table class="data"><thead><tr><th>Name</th><th>Host</th><th>Cost/min</th><th>Priority</th></tr></thead><tbody>${rows}</tbody></table>`;
  $('s-add').onclick = async () => {
    await api('/suppliers', {
      method: 'POST',
      body: {
        name: $('s-name').value,
        sip_host: $('s-host').value,
        sip_username: $('s-user').value,
        sip_password: $('s-pass').value,
        cost_per_minute: +$('s-cost').value,
        routing_priority: +$('s-pri').value,
      },
    });
    navigate('suppliers');
  };
}

async function renderIvr() {
  const { ivr } = await api('/ivr');
  const rows = ivr.map((i) => `<tr><td>${escapeHtml(i.name)}</td><td>${escapeHtml(i.language)}</td><td style="font-size:11px">${escapeHtml(i.audio_file)}</td></tr>`).join('');
  const up = user?.role !== 'client';
  $('content').innerHTML = `
    ${up ? `<form id="ivr-f"><div class="form-row"><label>Audio file</label><input type="file" name="file" required />
    <label>Name</label><input name="name" /><label>Language (en, es, …)</label><input name="language" value="en" />
    <button type="submit" class="btn primary">Upload</button></div></form>` : ''}
    <table class="data"><thead><tr><th>Name</th><th>Lang</th><th>File</th></tr></thead><tbody>${rows}</tbody></table>`;
  const f = $('ivr-f');
  if (f) {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      const name = fd.get('name') || 'IVR';
      const language = fd.get('language') || 'en';
      const q = `?name=${encodeURIComponent(name)}&language=${encodeURIComponent(language)}`;
      const headers = { Authorization: `Bearer ${token}` };
      const r = await fetch(apiUrl(`/ivr/upload${q}`), { method: 'POST', body: fd, headers });
      const data = await r.json();
      if (!r.ok) return alert(data.error || 'Upload failed');
      navigate('ivr');
    };
  }
}

async function renderRouting() {
  const { numbers } = await api('/numbers');
  const { suppliers } = await api('/suppliers');
  const { routes } = await api('/routes');
  const numOpts = numbers.map((n) => `<option value="${n.id}">${escapeHtml(n.did)}</option>`).join('');
  const supList = suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  $('content').innerHTML = `
    <p class="muted">Set failover order (top = first). Drag handle simulation: use ↑↓.</p>
    <div class="form-row"><label>Number</label><select id="rt-num">${numOpts}</select>
    <button type="button" class="btn" id="rt-load">Load routes</button></div>
    <ul class="route-list" id="rt-list"></ul>
    <div class="form-row"><select id="rt-add-s">${supList}</select><button type="button" class="btn" id="rt-add">Add supplier leg</button>
    <button type="button" class="btn primary" id="rt-save">Save priority order</button></div>`;

  let working = [];

  function renderList() {
    const ul = $('rt-list');
    ul.innerHTML = working
      .map(
        (r, i) => `<li data-i="${i}"><span>${escapeHtml(r.label)} (pri ${i})</span>
        <button type="button" class="btn small rt-up">↑</button>
        <button type="button" class="btn small rt-down">↓</button>
        <button type="button" class="btn small rt-rm">×</button></li>`
      )
      .join('');
    ul.querySelectorAll('.rt-up').forEach((b) => {
      b.onclick = () => {
        const i = +b.closest('li').dataset.i;
        if (i > 0) {
          [working[i - 1], working[i]] = [working[i], working[i - 1]];
          renderList();
        }
      };
    });
    ul.querySelectorAll('.rt-down').forEach((b) => {
      b.onclick = () => {
        const i = +b.closest('li').dataset.i;
        if (i < working.length - 1) {
          [working[i + 1], working[i]] = [working[i], working[i + 1]];
          renderList();
        }
      };
    });
    ul.querySelectorAll('.rt-rm').forEach((b) => {
      b.onclick = () => {
        const i = +b.closest('li').dataset.i;
        working.splice(i, 1);
        renderList();
      };
    });
  }

  $('rt-load').onclick = () => {
    const nid = +$('rt-num').value;
    working = routes
      .filter((x) => x.number_id === nid)
      .sort((a, b) => a.priority - b.priority)
      .map((x) => ({ supplier_id: x.supplier_id, label: x.supplier_name || String(x.supplier_id) }));
    renderList();
  };
  $('rt-add').onclick = () => {
    const sid = +$('rt-add-s').value;
    const s = suppliers.find((x) => x.id === sid);
    working.push({ supplier_id: sid, label: s?.name || String(sid) });
    renderList();
  };
  $('rt-save').onclick = async () => {
    const number_id = +$('rt-num').value;
    const body = {
      number_id,
      routes: working.map((r, priority) => ({ supplier_id: r.supplier_id, priority })),
    };
    await api('/routes', { method: 'POST', body });
    alert('Saved');
  };
}

async function renderCdr() {
  const { cdr } = await api('/cdr?limit=100');
  const rows = cdr
    .map(
      (c) => `<tr><td>${escapeHtml(c.caller || '')}</td><td>${escapeHtml(c.destination || '')}</td>
      <td>${c.duration_seconds}</td><td>${c.revenue}</td><td>${c.profit}</td><td>${escapeHtml(String(c.created_at))}</td></tr>`
    )
    .join('');
  $('content').innerHTML = `<table class="data"><thead><tr><th>Caller</th><th>Dest</th><th>Dur</th><th>Revenue</th><th>Profit</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>`;
}

async function renderReports() {
  const s = await api('/cdr/stats');
  $('content').innerHTML = `<div class="grid">
    <div class="card"><div class="lbl">Total calls</div><div class="val">${s.total_calls}</div></div>
    <div class="card"><div class="lbl">Answered</div><div class="val">${s.answered_calls}</div></div>
    <div class="card"><div class="lbl">ASR %</div><div class="val">${s.asr_percent}</div></div>
    <div class="card"><div class="lbl">ACD sec</div><div class="val">${Math.round(s.acd_seconds || 0)}</div></div>
    <div class="card"><div class="lbl">Revenue</div><div class="val">${Number(s.revenue).toFixed(4)}</div></div>
    <div class="card"><div class="lbl">Cost</div><div class="val">${Number(s.cost).toFixed(4)}</div></div>
    <div class="card"><div class="lbl">Profit</div><div class="val">${Number(s.profit).toFixed(4)}</div></div>
  </div>`;
}

$('login-btn').onclick = async () => {
  $('login-err').textContent = '';
  try {
    const body = { username: $('login-user').value.trim(), password: $('login-pass').value };
    const data = await api('/login', { method: 'POST', body });
    token = data.token;
    user = data.user;
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
    showApp();
  } catch (e) {
    $('login-err').textContent = e.message;
  }
};

$('logout-btn').onclick = () => {
  token = null;
  user = null;
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
  $('app-shell').classList.add('hidden');
  $('login-screen').classList.remove('hidden');
};

if (token && user) showApp();
