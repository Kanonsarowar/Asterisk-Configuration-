import API from './api.js';

const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan', dial: '93' },
  { code: 'AL', name: 'Albania', dial: '355' },
  { code: 'DZ', name: 'Algeria', dial: '213' },
  { code: 'AD', name: 'Andorra', dial: '376' },
  { code: 'AO', name: 'Angola', dial: '244' },
  { code: 'AG', name: 'Antigua & Barbuda', dial: '1268' },
  { code: 'AR', name: 'Argentina', dial: '54' },
  { code: 'AM', name: 'Armenia', dial: '374' },
  { code: 'AU', name: 'Australia', dial: '61' },
  { code: 'AT', name: 'Austria', dial: '43' },
  { code: 'AZ', name: 'Azerbaijan', dial: '994' },
  { code: 'BS', name: 'Bahamas', dial: '1242' },
  { code: 'BH', name: 'Bahrain', dial: '973' },
  { code: 'BD', name: 'Bangladesh', dial: '880' },
  { code: 'BB', name: 'Barbados', dial: '1246' },
  { code: 'BY', name: 'Belarus', dial: '375' },
  { code: 'BE', name: 'Belgium', dial: '32' },
  { code: 'BZ', name: 'Belize', dial: '501' },
  { code: 'BJ', name: 'Benin', dial: '229' },
  { code: 'BT', name: 'Bhutan', dial: '975' },
  { code: 'BO', name: 'Bolivia', dial: '591' },
  { code: 'BA', name: 'Bosnia & Herzegovina', dial: '387' },
  { code: 'BW', name: 'Botswana', dial: '267' },
  { code: 'BR', name: 'Brazil', dial: '55' },
  { code: 'BN', name: 'Brunei', dial: '673' },
  { code: 'BG', name: 'Bulgaria', dial: '359' },
  { code: 'BF', name: 'Burkina Faso', dial: '226' },
  { code: 'BI', name: 'Burundi', dial: '257' },
  { code: 'KH', name: 'Cambodia', dial: '855' },
  { code: 'CM', name: 'Cameroon', dial: '237' },
  { code: 'CA', name: 'Canada', dial: '1' },
  { code: 'CV', name: 'Cape Verde', dial: '238' },
  { code: 'CF', name: 'Central African Republic', dial: '236' },
  { code: 'TD', name: 'Chad', dial: '235' },
  { code: 'CL', name: 'Chile', dial: '56' },
  { code: 'CN', name: 'China', dial: '86' },
  { code: 'CO', name: 'Colombia', dial: '57' },
  { code: 'KM', name: 'Comoros', dial: '269' },
  { code: 'CG', name: 'Congo', dial: '242' },
  { code: 'CD', name: 'Congo (DRC)', dial: '243' },
  { code: 'CR', name: 'Costa Rica', dial: '506' },
  { code: 'CI', name: 'Cote d\'Ivoire', dial: '225' },
  { code: 'HR', name: 'Croatia', dial: '385' },
  { code: 'CU', name: 'Cuba', dial: '53' },
  { code: 'CY', name: 'Cyprus', dial: '357' },
  { code: 'CZ', name: 'Czech Republic', dial: '420' },
  { code: 'DK', name: 'Denmark', dial: '45' },
  { code: 'DJ', name: 'Djibouti', dial: '253' },
  { code: 'DM', name: 'Dominica', dial: '1767' },
  { code: 'DO', name: 'Dominican Republic', dial: '1809' },
  { code: 'EC', name: 'Ecuador', dial: '593' },
  { code: 'EG', name: 'Egypt', dial: '20' },
  { code: 'SV', name: 'El Salvador', dial: '503' },
  { code: 'GQ', name: 'Equatorial Guinea', dial: '240' },
  { code: 'ER', name: 'Eritrea', dial: '291' },
  { code: 'EE', name: 'Estonia', dial: '372' },
  { code: 'SZ', name: 'Eswatini', dial: '268' },
  { code: 'ET', name: 'Ethiopia', dial: '251' },
  { code: 'FJ', name: 'Fiji', dial: '679' },
  { code: 'FI', name: 'Finland', dial: '358' },
  { code: 'FR', name: 'France', dial: '33' },
  { code: 'GA', name: 'Gabon', dial: '241' },
  { code: 'GM', name: 'Gambia', dial: '220' },
  { code: 'GE', name: 'Georgia', dial: '995' },
  { code: 'DE', name: 'Germany', dial: '49' },
  { code: 'GH', name: 'Ghana', dial: '233' },
  { code: 'GR', name: 'Greece', dial: '30' },
  { code: 'GD', name: 'Grenada', dial: '1473' },
  { code: 'GT', name: 'Guatemala', dial: '502' },
  { code: 'GN', name: 'Guinea', dial: '224' },
  { code: 'GW', name: 'Guinea-Bissau', dial: '245' },
  { code: 'GY', name: 'Guyana', dial: '592' },
  { code: 'HT', name: 'Haiti', dial: '509' },
  { code: 'HN', name: 'Honduras', dial: '504' },
  { code: 'HK', name: 'Hong Kong', dial: '852' },
  { code: 'HU', name: 'Hungary', dial: '36' },
  { code: 'IS', name: 'Iceland', dial: '354' },
  { code: 'IN', name: 'India', dial: '91' },
  { code: 'ID', name: 'Indonesia', dial: '62' },
  { code: 'IR', name: 'Iran', dial: '98' },
  { code: 'IQ', name: 'Iraq', dial: '964' },
  { code: 'IE', name: 'Ireland', dial: '353' },
  { code: 'IL', name: 'Israel', dial: '972' },
  { code: 'IT', name: 'Italy', dial: '39' },
  { code: 'JM', name: 'Jamaica', dial: '1876' },
  { code: 'JP', name: 'Japan', dial: '81' },
  { code: 'JO', name: 'Jordan', dial: '962' },
  { code: 'KZ', name: 'Kazakhstan', dial: '7' },
  { code: 'KE', name: 'Kenya', dial: '254' },
  { code: 'KI', name: 'Kiribati', dial: '686' },
  { code: 'KW', name: 'Kuwait', dial: '965' },
  { code: 'KG', name: 'Kyrgyzstan', dial: '996' },
  { code: 'LA', name: 'Laos', dial: '856' },
  { code: 'LV', name: 'Latvia', dial: '371' },
  { code: 'LB', name: 'Lebanon', dial: '961' },
  { code: 'LS', name: 'Lesotho', dial: '266' },
  { code: 'LR', name: 'Liberia', dial: '231' },
  { code: 'LY', name: 'Libya', dial: '218' },
  { code: 'LI', name: 'Liechtenstein', dial: '423' },
  { code: 'LT', name: 'Lithuania', dial: '370' },
  { code: 'LU', name: 'Luxembourg', dial: '352' },
  { code: 'MO', name: 'Macau', dial: '853' },
  { code: 'MG', name: 'Madagascar', dial: '261' },
  { code: 'MW', name: 'Malawi', dial: '265' },
  { code: 'MY', name: 'Malaysia', dial: '60' },
  { code: 'MV', name: 'Maldives', dial: '960' },
  { code: 'ML', name: 'Mali', dial: '223' },
  { code: 'MT', name: 'Malta', dial: '356' },
  { code: 'MR', name: 'Mauritania', dial: '222' },
  { code: 'MU', name: 'Mauritius', dial: '230' },
  { code: 'MX', name: 'Mexico', dial: '52' },
  { code: 'MD', name: 'Moldova', dial: '373' },
  { code: 'MC', name: 'Monaco', dial: '377' },
  { code: 'MN', name: 'Mongolia', dial: '976' },
  { code: 'ME', name: 'Montenegro', dial: '382' },
  { code: 'MA', name: 'Morocco', dial: '212' },
  { code: 'MZ', name: 'Mozambique', dial: '258' },
  { code: 'MM', name: 'Myanmar', dial: '95' },
  { code: 'NA', name: 'Namibia', dial: '264' },
  { code: 'NP', name: 'Nepal', dial: '977' },
  { code: 'NL', name: 'Netherlands', dial: '31' },
  { code: 'NZ', name: 'New Zealand', dial: '64' },
  { code: 'NI', name: 'Nicaragua', dial: '505' },
  { code: 'NE', name: 'Niger', dial: '227' },
  { code: 'NG', name: 'Nigeria', dial: '234' },
  { code: 'KP', name: 'North Korea', dial: '850' },
  { code: 'MK', name: 'North Macedonia', dial: '389' },
  { code: 'NO', name: 'Norway', dial: '47' },
  { code: 'OM', name: 'Oman', dial: '968' },
  { code: 'PK', name: 'Pakistan', dial: '92' },
  { code: 'PA', name: 'Panama', dial: '507' },
  { code: 'PG', name: 'Papua New Guinea', dial: '675' },
  { code: 'PY', name: 'Paraguay', dial: '595' },
  { code: 'PE', name: 'Peru', dial: '51' },
  { code: 'PH', name: 'Philippines', dial: '63' },
  { code: 'PL', name: 'Poland', dial: '48' },
  { code: 'PT', name: 'Portugal', dial: '351' },
  { code: 'QA', name: 'Qatar', dial: '974' },
  { code: 'RO', name: 'Romania', dial: '40' },
  { code: 'RU', name: 'Russia', dial: '7' },
  { code: 'RW', name: 'Rwanda', dial: '250' },
  { code: 'KN', name: 'Saint Kitts & Nevis', dial: '1869' },
  { code: 'LC', name: 'Saint Lucia', dial: '1758' },
  { code: 'VC', name: 'Saint Vincent', dial: '1784' },
  { code: 'WS', name: 'Samoa', dial: '685' },
  { code: 'SM', name: 'San Marino', dial: '378' },
  { code: 'ST', name: 'Sao Tome & Principe', dial: '239' },
  { code: 'SA', name: 'Saudi Arabia', dial: '966' },
  { code: 'SN', name: 'Senegal', dial: '221' },
  { code: 'RS', name: 'Serbia', dial: '381' },
  { code: 'SC', name: 'Seychelles', dial: '248' },
  { code: 'SL', name: 'Sierra Leone', dial: '232' },
  { code: 'SG', name: 'Singapore', dial: '65' },
  { code: 'SK', name: 'Slovakia', dial: '421' },
  { code: 'SI', name: 'Slovenia', dial: '386' },
  { code: 'SB', name: 'Solomon Islands', dial: '677' },
  { code: 'SO', name: 'Somalia', dial: '252' },
  { code: 'ZA', name: 'South Africa', dial: '27' },
  { code: 'KR', name: 'South Korea', dial: '82' },
  { code: 'SS', name: 'South Sudan', dial: '211' },
  { code: 'ES', name: 'Spain', dial: '34' },
  { code: 'LK', name: 'Sri Lanka', dial: '94' },
  { code: 'SD', name: 'Sudan', dial: '249' },
  { code: 'SR', name: 'Suriname', dial: '597' },
  { code: 'SE', name: 'Sweden', dial: '46' },
  { code: 'CH', name: 'Switzerland', dial: '41' },
  { code: 'SY', name: 'Syria', dial: '963' },
  { code: 'TW', name: 'Taiwan', dial: '886' },
  { code: 'TJ', name: 'Tajikistan', dial: '992' },
  { code: 'TZ', name: 'Tanzania', dial: '255' },
  { code: 'TH', name: 'Thailand', dial: '66' },
  { code: 'TL', name: 'Timor-Leste', dial: '670' },
  { code: 'TG', name: 'Togo', dial: '228' },
  { code: 'TO', name: 'Tonga', dial: '676' },
  { code: 'TT', name: 'Trinidad & Tobago', dial: '1868' },
  { code: 'TN', name: 'Tunisia', dial: '216' },
  { code: 'TR', name: 'Turkey', dial: '90' },
  { code: 'TM', name: 'Turkmenistan', dial: '993' },
  { code: 'UG', name: 'Uganda', dial: '256' },
  { code: 'UA', name: 'Ukraine', dial: '380' },
  { code: 'AE', name: 'UAE', dial: '971' },
  { code: 'UK', name: 'United Kingdom', dial: '44' },
  { code: 'US', name: 'United States', dial: '1' },
  { code: 'UY', name: 'Uruguay', dial: '598' },
  { code: 'UZ', name: 'Uzbekistan', dial: '998' },
  { code: 'VU', name: 'Vanuatu', dial: '678' },
  { code: 'VE', name: 'Venezuela', dial: '58' },
  { code: 'VN', name: 'Vietnam', dial: '84' },
  { code: 'YE', name: 'Yemen', dial: '967' },
  { code: 'ZM', name: 'Zambia', dial: '260' },
  { code: 'ZW', name: 'Zimbabwe', dial: '263' },
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
  'sip-log': 'SIP Invite Log',
  suppliers: 'Suppliers',
  numbers: 'Numbers',
  'ivr-menus': 'IVR Audio',
  trunk: 'Trunk Configuration',
  config: 'Config Preview'
};

async function renderPage(page) {
  const content = document.getElementById('content');
  if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }

  switch (page) {
    case 'dashboard': return renderDashboard(content);
    case 'call-stats': return renderCallStats(content);
    case 'sip-log': return renderSipLog(content);
    case 'suppliers': return renderSuppliers(content);
    case 'numbers': return renderNumbers(content);
    case 'ivr-menus': return renderIvrMenus(content);
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
    const [status, modules, numbers, ivrMenus] = await Promise.all([
      API.getStatus(), API.getModules(), API.getNumbers(), API.getIvrMenus()
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
        <div class="label">Numbers</div>
        <div class="value">${numbers.length}</div>
        <div class="sub">${ivrMenus.length} IVR slots</div>
      </div>
      <div class="stat-card">
        <div class="label">IVR Slots</div>
        <div class="value">${ivrMenus.filter(m => m.audioFile).length}/10</div>
        <div class="sub">with audio</div>
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
  const [stats, suppliers] = await Promise.all([API.getCallStats(24), API.getSuppliers()]);

  // Map supplier IPs to names
  const ipToSupplier = {};
  for (const s of suppliers) {
    for (const ip of s.ips) ipToSupplier[ip] = s.name;
  }

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
          <thead><tr><th>SL</th><th>Prefix</th><th>Caller Number</th><th>Calling Number</th><th>Duration</th><th>Supplier</th><th>Status</th></tr></thead>
          <tbody>${stats.recentCalls.map((c, i) => {
            const statusClass = c.disposition === 'ANSWERED' ? 'badge-ring' : 'badge-direct';
            const prefix = c.dst.length > 4 ? c.dst.substring(0, c.dst.length - 4) : c.dst;
            const supplierName = c.sourceIp && ipToSupplier[c.sourceIp] ? ipToSupplier[c.sourceIp] : c.sourceIp || '-';
            return `<tr>
              <td>${i + 1}</td>
              <td style="font-family:monospace;font-size:12px"><span class="badge badge-ivr">${escHtml(prefix)}</span></td>
              <td style="font-family:monospace;font-size:12px">${escHtml(c.src)}</td>
              <td style="font-family:monospace;font-size:12px"><strong>${escHtml(c.dst)}</strong></td>
              <td>${c.billsec}s</td>
              <td><span class="badge badge-direct" style="font-size:11px">${escHtml(supplierName)}</span></td>
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

// ---- SIP LOG ----
async function renderSipLog(el) {
  const invites = await API.getSipInvites(200);
  const suppliers = await API.getSuppliers();
  const knownIps = new Set();
  suppliers.forEach(s => s.ips.forEach(ip => knownIps.add(ip)));

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card">
        <div class="label">Total Events</div>
        <div class="value blue">${invites.length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Accepted</div>
        <div class="value green">${invites.filter(i => i.type === 'INVITE').length}</div>
      </div>
      <div class="stat-card">
        <div class="label">Blocked</div>
        <div class="value" style="color:var(--danger)">${invites.filter(i => i.type === 'BLOCKED').length}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Recent SIP Events</h3>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('sip-log')">Refresh</button>
      </div>
      <div class="card-body">
        ${invites.length ? `
        <table>
          <thead><tr><th>Time</th><th>Source IP</th><th>DID</th><th>Status</th><th>Known</th></tr></thead>
          <tbody>${invites.map(inv => {
            const isKnown = knownIps.has(inv.ip);
            const statusBadge = inv.type === 'BLOCKED' ? 'badge-direct' : 'badge-ring';
            return `<tr style="${inv.type === 'BLOCKED' ? 'background:rgba(239,68,68,.05)' : ''}">
              <td style="font-size:11px;white-space:nowrap">${escHtml(inv.time)}</td>
              <td style="font-family:monospace;font-size:12px"><strong>${escHtml(inv.ip)}</strong></td>
              <td style="font-family:monospace;font-size:12px">${escHtml(inv.did)}</td>
              <td><span class="badge ${statusBadge}">${inv.type}</span></td>
              <td>${isKnown ? '<span class="badge badge-ring">Known</span>' : '<span class="badge badge-direct">Unknown</span>'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<div class="empty-state">No SIP events found in Asterisk logs.<br>Make sure logging is enabled: <code>/var/log/asterisk/messages</code></div>'}
      </div>
    </div>`;
}

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
  const [numbers, suppliers, ivrMenus] = await Promise.all([
    API.getNumbers(), API.getSuppliers(), API.getIvrMenus()
  ]);

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
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" id="btn-upload-file">Upload File</button>
          <button class="btn btn-primary" id="btn-add-number">+ Add Numbers</button>
        </div>
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
              <h4><span class="arrow">&#9660;</span> ${escHtml(countryName)} (${prefixes[prefixKeys[0]].countryCode})</h4>
              <span class="count">${countryTotal} number${countryTotal !== 1 ? 's' : ''} / ${prefixKeys.length} prefix${prefixKeys.length !== 1 ? 'es' : ''}</span>
            </div>
            <div class="country-body" data-country-body="${country}">
              ${prefixKeys.map(pk => {
                const pg = prefixes[pk];
                return `
                <div class="prefix-group">
                  <div class="prefix-header">
                    <div class="prefix-info">
                      <span class="prefix-code">${pg.countryCode}${pg.prefix}</span>
                      <span class="prefix-rate">$${pg.rate}/min</span>
                      <span class="prefix-count">${pg.numbers.length} number${pg.numbers.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center">
                      <select class="form-control prefix-ivr-sel" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" style="width:auto;padding:4px 8px;font-size:12px">
                        ${ivrMenus.map(ivr => `<option value="${ivr.id}" ${pg.numbers[0]?.destinationId === ivr.id ? 'selected' : ''}>${ivr.name}</option>`).join('')}
                      </select>
                      <button class="btn btn-outline btn-sm edit-prefix-rate" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" data-rate="${pg.rate}">Rate</button>
                      <button class="btn btn-danger btn-sm del-prefix" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}">Delete</button>
                    </div>
                  </div>
                  <div class="prefix-numbers">
                    <table>
                      <thead><tr><th>Full Number</th><th>Extension</th><th>Supplier</th></tr></thead>
                      <tbody>${pg.numbers.map(n => {
                        const sup = suppliers.find(s => s.id === n.supplierId);
                        return `<tr>
                          <td><strong style="font-family:monospace">${n.countryCode}${n.prefix}${n.extension}</strong></td>
                          <td style="font-family:monospace">${n.extension}</td>
                          <td>${sup ? `<span class="badge badge-direct">${escHtml(sup.name)}</span>` : '-'}</td>
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

  document.getElementById('btn-add-number').onclick = () => showAddNumberModal(suppliers, ivrMenus);

  el.querySelectorAll('.del-prefix').forEach(b => b.onclick = async () => {
    const prefix = b.dataset.prefix;
    const cc = b.dataset.cc;
    const country = b.dataset.country;
    if (!confirm(`Delete ALL numbers with prefix ${cc} ${prefix}?`)) return;
    const result = await API.deletePrefix(country, cc, prefix);
    toast(`Deleted ${result.deleted} numbers`);
    renderNumbers(el);
  });

  document.getElementById('btn-upload-file').onclick = () => {
    showModal('Upload DID File', `
      <div class="form-group">
        <label>Supplier</label>
        <select class="form-control" id="upload-supplier">
          ${suppliers.map(s => `<option value="${s.id}">${escHtml(s.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>DID File (.txt or .csv — one number per line)</label>
        <input type="file" class="form-control" id="upload-did-file" accept=".csv,.txt,.text" style="padding:6px">
      </div>
      <div class="form-group">
        <label>Or paste numbers (one per line)</label>
        <textarea class="form-control" id="upload-did-text" rows="6" style="font-family:monospace" placeholder="393199030220\n393199030221\n393199030222"></textarea>
      </div>
    `, async () => {
      const supplierId = document.getElementById('upload-supplier').value;
      const file = document.getElementById('upload-did-file').files[0];
      const textArea = document.getElementById('upload-did-text').value.trim();

      let text = textArea;
      if (file) {
        text = await file.text();
      }
      if (!text) { toast('Select a file or paste numbers', 'error'); return; }

      try {
        const result = await API.uploadNumbersCsv(text, supplierId);
        if (result.ok) {
          const summary = result.detected.map(d => d.country + ': ' + d.count).join(', ');
          toast('Imported ' + result.count + ' numbers (' + summary + ')');
          closeModal();
          renderNumbers(el);
        } else {
          toast(result.error || 'Upload failed', 'error');
        }
      } catch (err) {
        toast('Upload error: ' + err.message, 'error');
      }
    });
  };

  el.querySelectorAll('.prefix-ivr-sel').forEach(sel => {
    sel.onchange = async () => {
      const country = sel.dataset.country;
      const cc = sel.dataset.cc;
      const prefix = sel.dataset.prefix;
      const newIvrId = sel.value;
      const prefixNums = numbers.filter(n => n.country === country && n.countryCode === cc && n.prefix === prefix);
      for (const n of prefixNums) {
        await API.updateNumber(n.id, { destinationType: 'ivr', destinationId: newIvrId });
      }
      markChanged();
      toast(`Prefix ${cc}${prefix} → IVR ${newIvrId}`);
    };
  });

  el.querySelectorAll('.edit-prefix-rate').forEach(b => b.onclick = () => {
    const currentRate = b.dataset.rate;
    const cc = b.dataset.cc;
    const prefix = b.dataset.prefix;
    const country = b.dataset.country;
    showModal('Edit Rate', `
      <div class="form-group">
        <label>Rate for ${cc} ${prefix} ($/min)</label>
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

function showAddNumberModal(suppliers, ivrMenus) {
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
    <div class="form-row">
      <div class="form-group">
        <label>IVR Destination</label>
        <select class="form-control" id="num-dest-id">
          ${(ivrMenus || []).map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
      </div>
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

    const destinationId = document.getElementById('num-dest-id').value;
    const nums = extensions.map(ext => ({ country, countryCode, prefix, extension: ext, rate, supplierId, destinationType: 'ivr', destinationId }));
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
      preview.innerHTML = `${cc}${prefix}${from} to ${cc}${prefix}${to}`;
    } else {
      const exts = document.getElementById('num-extensions').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!exts.length) {
        preview.textContent = `${cc}${prefix} + [extensions]`;
      } else {
        preview.innerHTML = exts.slice(0, 10).map(e => `${cc}${prefix}${e}`).join('<br>') + (exts.length > 10 ? `<br>... and ${exts.length - 10} more` : '');
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

// ---- IVR AUDIO ----
async function renderIvrMenus(el) {
  const ivrMenus = await API.getIvrMenus();
  const audioFiles = await API.getAudioFiles();

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>IVR Audio Slots (1-10)</h3></div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Upload audio files for each IVR slot. Assign IVR slots to number prefixes in the Numbers page.</p>
        <div id="ivr-slots">
          ${ivrMenus.map(ivr => `
            <div class="ivr-slot" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
              <strong style="width:60px;flex-shrink:0">${escHtml(ivr.name)}</strong>
              <select class="form-control ivr-audio-sel" data-id="${ivr.id}" style="flex:1">
                <option value="">— No audio —</option>
                ${audioFiles.map(f => `<option value="${f.path}" ${ivr.audioFile === f.path ? 'selected' : ''}>${f.name}</option>`).join('')}
              </select>
              <label class="btn btn-outline btn-sm" style="cursor:pointer;margin:0;flex-shrink:0">
                Upload
                <input type="file" class="ivr-upload-input" data-id="${ivr.id}" accept=".wav,.gsm,.mp3,.sln,.ulaw,.alaw" style="display:none">
              </label>
              <span class="ivr-slot-status" data-id="${ivr.id}" style="font-size:12px;min-width:80px;color:${ivr.audioFile ? 'var(--success)' : 'var(--text-muted)'}">${ivr.audioFile ? ivr.audioFile : 'No file'}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>`;

  el.querySelectorAll('.ivr-audio-sel').forEach(sel => {
    sel.onchange = async () => {
      const id = sel.dataset.id;
      await API.updateIvrMenu(id, { audioFile: sel.value });
      const status = el.querySelector(`.ivr-slot-status[data-id="${id}"]`);
      status.textContent = sel.value || 'No file';
      status.style.color = sel.value ? 'var(--success)' : 'var(--text-muted)';
      markChanged();
      toast(`IVR ${id} updated`);
    };
  });

  el.querySelectorAll('.ivr-upload-input').forEach(input => {
    input.onchange = async () => {
      const id = input.dataset.id;
      const file = input.files[0];
      if (!file) return;
      const status = el.querySelector(`.ivr-slot-status[data-id="${id}"]`);
      status.textContent = 'Uploading...';
      status.style.color = 'var(--text-muted)';
      try {
        const result = await API.uploadAudio(file);
        if (result.ok && result.files.length) {
          const path = 'custom/' + result.files[0].replace(/\.[^.]+$/, '');
          await API.updateIvrMenu(id, { audioFile: path });
          const sel = el.querySelector(`.ivr-audio-sel[data-id="${id}"]`);
          const opt = document.createElement('option');
          opt.value = path;
          opt.textContent = result.files[0];
          opt.selected = true;
          sel.appendChild(opt);
          status.textContent = path;
          status.style.color = 'var(--success)';
          markChanged();
          toast(`IVR ${id}: uploaded ${result.files[0]}`);
        } else {
          status.textContent = 'Upload failed';
          status.style.color = 'var(--danger)';
        }
      } catch (err) {
        status.textContent = 'Error';
        status.style.color = 'var(--danger)';
      }
    };
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
    </div>
    ${config.aclConf ? `<div class="card">
      <div class="card-header"><h3>acl.conf</h3></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(config.aclConf)}</div></div>
    </div>` : ''}`;
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
