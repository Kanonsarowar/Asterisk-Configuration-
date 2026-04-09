import API from './api.js';
import { buildPanelNavHtml } from './nav-config.js';

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
let tenantLiveInterval = null;
let callStatsInterval = null;
let liveCallsInterval = null;

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

/** Panel pages removed from sidebar — old bookmarks redirect to Dashboard. */
const REMOVED_PANEL_PAGES = new Set(['balance', 'sip-log', 'did-test', 'admin-users']);

function wireNavClicks(root) {
  if (!root) return;
  root.querySelectorAll('.nav-item[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) navigateTo(page);
    });
  });
}

function initPanelNavigation() {
  const nav = document.getElementById('nav-panel');
  if (!nav || nav.querySelector('.nav-group')) return;
  nav.innerHTML = buildPanelNavHtml();
  wireNavClicks(nav);
  nav.querySelectorAll('[data-nav-toggle]').forEach((hdr) => {
    hdr.addEventListener('click', () => {
      const id = hdr.getAttribute('data-nav-toggle');
      const group = nav.querySelector(`.nav-group[data-group-id="${id}"]`);
      const body = group?.querySelector('.nav-group-body');
      const expanded = hdr.getAttribute('aria-expanded') === 'true';
      hdr.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (group) group.classList.toggle('nav-group--collapsed', expanded);
      if (body) body.style.display = expanded ? 'none' : '';
    });
  });
  nav.querySelectorAll('[data-subgroup-toggle]').forEach((subHdr) => {
    subHdr.addEventListener('click', () => {
      const sid = subHdr.getAttribute('data-subgroup-toggle');
      const sub = nav.querySelector(`.nav-subgroup[data-subgroup-id="${sid}"]`);
      const expanded = subHdr.getAttribute('aria-expanded') === 'true';
      subHdr.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      if (sub) sub.classList.toggle('nav-subgroup--collapsed', expanded);
    });
  });
}

initPanelNavigation();
wireNavClicks(document.getElementById('nav-tenant'));

function expandNavGroupForPage(page) {
  const nav = document.getElementById('nav-panel');
  if (!nav) return;
  const escSel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(page) : String(page).replace(/"/g, '\\"');
  const btn = nav.querySelector(`.nav-item[data-page="${escSel}"]`);
  const group = btn?.closest?.('.nav-group');
  if (!group) return;
  const hdr = group.querySelector('.nav-group-header');
  const body = group.querySelector('.nav-group-body');
  group.classList.remove('nav-group--collapsed');
  if (hdr) hdr.setAttribute('aria-expanded', 'true');
  if (body) body.style.display = '';
  const sub = btn?.closest?.('.nav-subgroup');
  if (sub) {
    sub.classList.remove('nav-subgroup--collapsed');
    const sh = sub.querySelector('.nav-subgroup-header');
    if (sh) sh.setAttribute('aria-expanded', 'true');
  }
}

function navigateTo(page) {
  if (REMOVED_PANEL_PAGES.has(page)) page = 'dashboard';
  currentPage = page;
  const navTenant = document.getElementById('nav-tenant');
  const navPanel = document.getElementById('nav-panel');
  const tenantVisible = navTenant && navTenant.style.display !== 'none';
  const root = tenantVisible ? navTenant : navPanel;
  if (root) {
    root.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  } else {
    document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  }
  if (!tenantVisible) expandNavGroupForPage(page);
  document.getElementById('page-title').textContent = pageTitles[page] || page;
  renderPage(page);
}

function hashCallerColorClass(callerId) {
  const k = String(callerId || '').replace(/\D/g, '') || 'x';
  let h = 0;
  for (let i = 0; i < k.length; i++) h = Math.imul(31, h) + k.charCodeAt(i) | 0;
  return `live-c${Math.abs(h) % 8}`;
}

function digitsOnly(s) {
  return String(s || '').replace(/\D/g, '');
}

function fullNumberDigits(n) {
  return digitsOnly(n.countryCode) + digitsOnly(n.prefix) + digitsOnly(n.extension);
}

function matchNumberForDst(dst, numbers) {
  const d = digitsOnly(dst);
  if (!d || !Array.isArray(numbers)) return null;
  let best = null;
  let bestLen = 0;
  for (const n of numbers) {
    const fn = fullNumberDigits(n);
    if (!fn) continue;
    if (d === fn) return n;
    if (d.length >= fn.length && d.endsWith(fn) && fn.length > bestLen) {
      best = n;
      bestLen = fn.length;
    }
  }
  return best;
}

function normalizeCallSourceIp(ip) {
  const s = String(ip || '').trim();
  const m = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  return m ? m[1] : s;
}

function supplierIdForCall(sourceIp, matchedNumber, suppliers) {
  if (matchedNumber && matchedNumber.supplierId) return String(matchedNumber.supplierId);
  const want = normalizeCallSourceIp(sourceIp);
  if (!want) return '';
  for (const s of suppliers || []) {
    const ips = s.ips || [];
    for (const ip of ips) {
      if (normalizeCallSourceIp(ip) === want) return String(s.id);
    }
  }
  return '';
}

function formatCdrDateDisplay(isoOrStr) {
  const d = new Date(isoOrStr);
  if (isNaN(d.getTime())) return String(isoOrStr || '');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yy} - ${hh}:${mi}`;
}

function formatCdrStatusLabel(disposition) {
  const u = String(disposition || '').toUpperCase();
  if (u === 'ANSWERED') return 'ANSWER';
  return u.replace(/_/g, ' ') || '-';
}

function formatUsdRate(rate) {
  const n = parseFloat(rate);
  if (!isFinite(n) || n <= 0) return '$0';
  return '$' + n.toFixed(3);
}

function formatUsdAmount(amount) {
  const n = parseFloat(amount);
  if (!isFinite(n) || n < 0) return '$0';
  return '$' + n.toFixed(4);
}

function formatCdrNativeRate(rate, currency) {
  const n = parseFloat(rate);
  const cur = currency === 'eur' ? 'eur' : 'usd';
  if (!isFinite(n) || n <= 0) return cur === 'eur' ? '€0' : '$0';
  return (cur === 'eur' ? '€' : '$') + n.toFixed(3) + '/min';
}

function formatCdrNativeAmount(amount, currency) {
  const n = parseFloat(amount);
  const cur = currency === 'eur' ? 'eur' : 'usd';
  if (!isFinite(n) || n < 0) return cur === 'eur' ? '€0' : '$0';
  return (cur === 'eur' ? '€' : '$') + n.toFixed(4);
}

function formatPrefixTariff(pg) {
  const nums = pg.numbers || [];
  if (!nums.length) return '-';
  const rcSet = new Set(nums.map((n) => (String(n.rateCurrency).toLowerCase() === 'eur' ? 'eur' : 'usd')));
  const tSet = new Set(nums.map((n) => String(n.paymentTerm || 'weekly').toLowerCase()));
  const sym = rcSet.size > 1 ? '…' : (rcSet.has('eur') ? '€' : '$');
  const sameRate = nums.every((n) => String(n.rate) === String(nums[0].rate));
  const rateStr = sameRate ? escHtml(String(nums[0].rate)) : 'mixed';
  const termStr = tSet.size > 1 ? 'mixed' : escHtml(String(nums[0].paymentTerm || 'weekly'));
  return `${sym}${rateStr}/min <span style="color:var(--text-muted);font-size:10px;text-transform:capitalize">${termStr}</span>`;
}

/** Single DID — IVR tariff for table column (matches Purple-style display). */
function formatDidIvrTariff(n) {
  if (!n) return '—';
  const cur = String(n.rateCurrency || 'usd').toLowerCase() === 'eur' ? 'eur' : 'usd';
  const sym = cur === 'eur' ? '€' : '$';
  return `${sym}${escHtml(String(n.rate ?? ''))}/min`;
}

/** Payment terms shorthand for inventory table. */
function formatDidPaymentTerms(n) {
  const t = String(n?.paymentTerm || 'weekly').toLowerCase();
  if (t === 'weekly') return '7/1';
  if (t === 'monthly') return '30/1';
  if (t === 'daily') return '1/1';
  return escHtml(t);
}

function formatBillMinutes(billsec) {
  const m = (Number(billsec) || 0) / 60;
  return m.toFixed(2) + ' min';
}

/** Live dashboard strip: MySQL + IPRN / ODBC mode from /api/iprn/panel-status */
function buildIprnLiveBanner(iprn) {
  if (!iprn || typeof iprn !== 'object') {
    return '<p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">IPRN: panel status unavailable</p>';
  }
  if (iprn.skipped) {
    return '<p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">IPRN DB: not configured — set <code>MYSQL_ENABLED=1</code> and <code>MYSQL_HOST</code> / <code>MYSQL_DATABASE</code> / <code>MYSQL_USER</code> (see <code>dashboard/.env.example</code>), then restart the dashboard service.</p>';
  }
  if (iprn.error) {
    return `<p style="font-size:12px;color:var(--danger);margin-bottom:10px">IPRN DB: ${escHtml(iprn.error)}</p>`;
  }
  const bits = [];
  bits.push(iprn.poolOk ? 'MySQL OK' : 'MySQL down');
  bits.push(iprn.numbersFromDb ? 'DIDs from DB' : 'DIDs from db.json');
  if (iprn.numbersCount != null) bits.push(`numbers ${iprn.numbersCount}`);
  if (iprn.inventoryCount != null) bits.push(`inventory ${iprn.inventoryCount}`);
  if (iprn.billing24hCount != null) bits.push(`billed 24h ${iprn.billing24hCount}`);
  if (iprn.lastBillingAt) bits.push(`last bill ${escHtml(String(iprn.lastBillingAt).slice(0, 19))}`);
  bits.push(iprn.odbcRoutingEnabled ? 'ODBC routing ON' : 'ODBC off (IVR only)');
  let html = `<p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">IPRN · ${bits.join(' · ')}</p>`;
  if (iprn.tableErrors && iprn.tableErrors.length) {
    html += `<p style="font-size:11px;color:var(--danger);margin-bottom:10px">${escHtml(iprn.tableErrors.join('; '))}</p>`;
  }
  return html;
}

const pageTitles = {
  dashboard: 'Dashboard',
  'live-calls': 'Live Calls',
  'call-stats': 'Call Statistics',
  'cdr-history': 'CDR',
  suppliers: 'Termination Providers',
  numbers: 'DID Inventory',
  'iprn-inventory': 'Prefix Routing Map',
  'ivr-menus': 'IVR Audio',
  trunk: 'Trunk Configuration',
  config: 'Config Preview',
  'iprn-clients': 'IPRN clients',
  'tenant-dashboard': 'Overview',
  'tenant-live-calls': 'Live calls',
  'tenant-cdr': 'CDR',
  'tenant-billing': 'Balance',
  'tenant-invoices': 'Invoices',
  'tenant-subusers': 'Subusers',
  'tenant-numbers': 'Number allocation',
  'tenant-call-generator': 'Call generator',
  'routing-rules': 'Traffic Policy Engine',
  'routing-fraud': 'Fraud-aware routing',
  'routing-lcr': 'Least-cost routing (LCR)',
  'routing-geo': 'Geo-routing',
  'routing-quality': 'Quality-based routing',
  billing: 'Billing',
  'profit-reports': 'Profit reports',
};

async function renderPage(page) {
  const content = document.getElementById('content');
  if (statusInterval) { clearInterval(statusInterval); statusInterval = null; }
  if (tenantLiveInterval) { clearInterval(tenantLiveInterval); tenantLiveInterval = null; }
  if (callStatsInterval) { clearInterval(callStatsInterval); callStatsInterval = null; }
  if (liveCallsInterval) { clearInterval(liveCallsInterval); liveCallsInterval = null; }

  if (REMOVED_PANEL_PAGES.has(page)) return renderDashboard(content);

  switch (page) {
    case 'dashboard': return renderDashboard(content);
    case 'live-calls': return renderLiveCalls(content);
    case 'call-stats': return renderCallStats(content);
    case 'cdr-history': return renderCdrHistory(content);
    case 'suppliers': return renderSuppliers(content);
    case 'numbers': return renderNumbers(content);
    case 'iprn-inventory': return renderIprnInventory(content);
    case 'ivr-menus': return renderIvrMenus(content);
    case 'trunk': return renderTrunk(content);
    case 'config': return renderConfig(content);
    case 'routing-rules': return renderRoutingRules(content);
    case 'routing-fraud':
      return renderPlaceholderPage(
        content,
        'Fraud-aware routing',
        'Policy-driven screening before termination (velocity, CLI anomalies, geo mismatch). Configuration UI will attach to the same control plane as Traffic Policy Engine — no dial-plan logic changes until enabled.'
      );
    case 'routing-lcr':
      return renderPlaceholderPage(
        content,
        'Least-cost routing (LCR)',
        'Rank termination providers by rate, quality, and capacity. Will integrate with Termination Providers and live stats — backend selection engine to follow.'
      );
    case 'routing-geo':
      return renderPlaceholderPage(
        content,
        'Geo-routing',
        'Route by caller or trunk geography, regulatory zones, and number class. Pairs with Prefix Routing Map and policy rules.'
      );
    case 'routing-quality':
      return renderPlaceholderPage(
        content,
        'Quality-based routing',
        'ASR/ACD/post-dial delay driven provider preference and automatic deprioritization. Uses the same metrics surface as Operations analytics.'
      );
    case 'billing': return renderPlaceholderPage(content, 'Billing', 'Invoicing, balances, and payment tracking will appear here.');
    case 'profit-reports': return renderPlaceholderPage(content, 'Profit reports', 'Margin and profitability analytics will appear here.');
    case 'iprn-clients': return renderIprnClients(content);
    case 'tenant-dashboard': return renderTenantDashboard(content);
    case 'tenant-live-calls': return renderTenantLiveCalls(content);
    case 'tenant-cdr': return renderTenantCdr(content);
    case 'tenant-billing': return renderTenantBilling(content);
    case 'tenant-invoices': return renderTenantInvoices(content);
    case 'tenant-subusers': return renderTenantSubusers(content);
    case 'tenant-numbers': return renderTenantNumbers(content);
    case 'tenant-call-generator': return renderTenantCallGenerator(content);
  }
}

// ---- DASHBOARD ----
async function renderDashboard(el) {
  el.innerHTML = `<div class="stats-grid" id="stats-grid"></div>
    <p class="empty-state" style="padding:16px 0 0;font-size:13px">Use <strong>Operations → Live Calls</strong> for the live channel table.</p>`;
  await refreshDashboard();
  statusInterval = setInterval(refreshDashboard, 10000);
}

async function renderLiveCalls(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Live Channels</h3>
        <div class="live-channels-toolbar">
          <span class="live-refresh-hint">Auto-refresh every 10s</span>
          <button type="button" class="btn btn-outline btn-sm" id="btn-live-refresh" title="Refresh live data now">Refresh</button>
        </div>
      </div>
      <div class="card-body padded" id="channels-box"><p class="empty-state">Loading...</p></div>
    </div>`;
  const liveBtn = document.getElementById('btn-live-refresh');
  if (liveBtn) liveBtn.addEventListener('click', () => refreshLiveChannels());
  await refreshLiveChannels();
  if (liveCallsInterval) clearInterval(liveCallsInterval);
  liveCallsInterval = setInterval(refreshLiveChannels, 10000);
}

function renderPlaceholderPage(el, title, body) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>${escHtml(title)}</h3></div>
      <div class="card-body padded">
        <p class="empty-state" style="padding:24px;text-align:left;max-width:520px">${escHtml(body)}</p>
        <p style="font-size:12px;color:var(--text-muted);margin-top:8px">Placeholder — no backend changes in this release.</p>
      </div>
    </div>`;
}

async function renderRoutingRules(el) {
  el.innerHTML = '<div class="card"><div class="card-body padded"><p class="empty-state">Loading routing defaults…</p></div></div>';
  let globals = {};
  let ivrMenus = [];
  try {
    [globals, ivrMenus] = await Promise.all([API.getGlobals(), API.getIvrMenus()]);
  } catch (e) {
    el.innerHTML = `<div class="card"><div class="card-body padded"><p class="empty-state">Could not load settings.</p></div></div>`;
    return;
  }
  if (!Array.isArray(ivrMenus)) ivrMenus = [];
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Traffic Policy Engine</h3></div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
          Switch-level defaults for inbound DID handling: fallback IVR and optional ODBC-based termination selection (<code>number_inventory</code> + DSN <code>iprn_db</code>). Same settings as DID Inventory → IPRN routing defaults.
        </p>
        <div class="form-group">
          <label>Fallback IVR (unmatched / ODBC empty)</label>
          <select class="form-control" id="routing-fallback-ivr">
            ${ivrMenus.map((ivr) => `<option value="${escHtml(ivr.id)}" ${String(globals.fallbackIvrId || '1') === ivr.id ? 'selected' : ''}>${escHtml(ivr.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="display:flex;align-items:center;gap:10px">
          <input type="checkbox" id="routing-odbc" ${globals.iprnOdbcRouting ? 'checked' : ''} />
          <label for="routing-odbc" style="margin:0;cursor:pointer">Enable ODBC / PJSIP supplier routing for matched DIDs (<code>number_inventory</code> + DSN <code>iprn_db</code>)</label>
        </div>
        <button type="button" class="btn btn-primary" id="btn-save-routing-rules">Save routing defaults</button>
      </div>
    </div>`;
  document.getElementById('btn-save-routing-rules').onclick = async () => {
    const fallbackIvrId = document.getElementById('routing-fallback-ivr').value;
    const iprnOdbcRouting = !!document.getElementById('routing-odbc')?.checked;
    await API.updateGlobals({ fallbackIvrId, iprnOdbcRouting });
    markChanged();
    toast(`Routing defaults saved (fallback IVR ${fallbackIvrId}${iprnOdbcRouting ? ', ODBC on' : ''})`);
  };
}

async function refreshDashboard() {
  try {
    const [statusRes, modulesRes, numbersRes, ivrRes, suppliersRes, iprnPanelRes, metricsRes] = await Promise.allSettled([
      API.getStatus(),
      API.getModules(),
      API.getNumbers(),
      API.getIvrMenus(),
      API.getSuppliers(),
      API.getIprnPanelStatus(),
      API.getDashboardMetrics(),
    ]);
    const rawStatus = statusRes.status === 'fulfilled' ? statusRes.value : {
      running: false, uptime: 'Unavailable', activeCalls: 0, activeChannels: 0, freeRamMB: 0, totalRamMB: 0
    };
    const status = (rawStatus && !rawStatus.error) ? rawStatus : {
      running: false, uptime: 'Unavailable', activeCalls: 0, activeChannels: 0, freeRamMB: 0, totalRamMB: 0
    };
    const rawModules = modulesRes.status === 'fulfilled' ? modulesRes.value : { count: 0 };
    const modules = (rawModules && !rawModules.error) ? rawModules : { count: 0 };
    const rawNumbers = numbersRes.status === 'fulfilled' ? numbersRes.value : [];
    const numbers = Array.isArray(rawNumbers) ? rawNumbers : [];
    const rawIvrMenus = ivrRes.status === 'fulfilled' ? ivrRes.value : [];
    const ivrMenus = Array.isArray(rawIvrMenus) ? rawIvrMenus : [];
    const rawSuppliers = suppliersRes.status === 'fulfilled' ? suppliersRes.value : [];
    const suppliers = Array.isArray(rawSuppliers) ? rawSuppliers : [];
    let iprn = {};
    if (iprnPanelRes.status === 'fulfilled' && iprnPanelRes.value && typeof iprnPanelRes.value === 'object') {
      iprn = iprnPanelRes.value;
    } else {
      iprn = { skipped: true };
    }
    const iprnBanner = buildIprnLiveBanner(iprn);

    let m = null;
    if (metricsRes.status === 'fulfilled' && metricsRes.value && typeof metricsRes.value === 'object' && !metricsRes.value.error) {
      m = metricsRes.value;
    }
    const worst = m && m.worstRoute ? m.worstRoute : { context: '—', asr: 0, calls: 0 };
    const top = m && m.topCountry ? m.topCountry : { code: '—', revenue: 0 };

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
      <div class="stat-card">
        <div class="label">MySQL / IPRN</div>
        <div class="value ${iprn.poolOk ? 'green' : ''}">${iprn.skipped ? 'Off' : (iprn.poolOk ? 'Live' : (iprn.error ? 'Err' : '—'))}</div>
        <div class="sub">${iprn.numbersFromDb ? 'DIDs in DB' : 'JSON store'}</div>
      </div>
      <div class="stat-card">
        <div class="label">ODBC routing</div>
        <div class="value">${iprn.odbcRoutingEnabled ? 'ON' : 'off'}</div>
        <div class="sub">DSN iprn_db + Apply</div>
      </div>
      <div class="stat-card">
        <div class="label">Revenue (today / month)</div>
        <div class="value green">${m ? escHtml(String(m.revenueToday)) : '—'}</div>
        <div class="sub">Month: ${m ? escHtml(String(m.revenueMonth)) : '—'} <span style="opacity:0.75">(est. from CDR × DID rate)</span></div>
      </div>
      <div class="stat-card">
        <div class="label">ASR (global)</div>
        <div class="value blue">${m ? escHtml(String(m.asrGlobal)) : '—'}%</div>
        <div class="sub">Month-to-date, all CDR</div>
      </div>
      <div class="stat-card">
        <div class="label">ACD (global)</div>
        <div class="value amber">${m ? escHtml(String(m.acdGlobal)) : '—'}s</div>
        <div class="sub">Avg billsec (answered), MTD</div>
      </div>
      <div class="stat-card">
        <div class="label">Top country (revenue)</div>
        <div class="value">${escHtml(String(top.code))}</div>
        <div class="sub">${escHtml(String(top.revenue))} today (matched DIDs)</div>
      </div>
      <div class="stat-card">
        <div class="label">Worst route</div>
        <div class="value" style="color:var(--danger)">${escHtml(String(worst.context))}</div>
        <div class="sub">ASR ${escHtml(String(worst.asr))}% · ${escHtml(String(worst.calls))} calls <span style="opacity:0.75">(dialplan context)</span></div>
      </div>
      <div class="stat-card">
        <div class="label">Live CPS</div>
        <div class="value">${m ? escHtml(String(m.liveCps)) : '—'}</div>
        <div class="sub">Calls in last 60s ÷ 60</div>
      </div>
    `;
  } catch (err) {
    console.error('Dashboard refresh error:', err);
    const grid = document.getElementById('stats-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="stat-card">
          <div class="label">STATUS</div>
          <div class="value">ERROR</div>
          <div class="sub">Could not load dashboard data</div>
        </div>`;
    }
  }
}

async function refreshLiveChannels() {
  const box = document.getElementById('channels-box');
  if (!box) return;
  try {
    const [statusRes, suppliersRes, iprnPanelRes, chRes] = await Promise.allSettled([
      API.getStatus(),
      API.getSuppliers(),
      API.getIprnPanelStatus(),
      API.getChannels(),
    ]);
    const rawStatus = statusRes.status === 'fulfilled' ? statusRes.value : {};
    const status = (rawStatus && !rawStatus.error) ? rawStatus : {
      running: false, activeCalls: 0, activeChannels: 0,
    };
    const suppliers = suppliersRes.status === 'fulfilled' && Array.isArray(suppliersRes.value) ? suppliersRes.value : [];
    let iprn = {};
    if (iprnPanelRes.status === 'fulfilled' && iprnPanelRes.value && typeof iprnPanelRes.value === 'object') {
      iprn = iprnPanelRes.value;
    } else {
      iprn = { skipped: true };
    }
    const iprnBanner = buildIprnLiveBanner(iprn);

    let ch = chRes.status === 'fulfilled' ? chRes.value : { output: '', calls: [], _timeout: true };
    if (!ch || typeof ch !== 'object') ch = { output: '', calls: [] };
    const normalize = (v) => String(v || '').trim();
    const slugify = (s) => normalize(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const resolveSupplier = (endpoint) => {
      const ep = normalize(endpoint);
      if (!ep) return '-';
      for (const s of suppliers || []) {
        const slug = slugify(s.name);
        if (!slug) continue;
        if (ep === `supplier-${slug}` || ep.includes(slug)) return s.name.toUpperCase();
      }
      return ep.toUpperCase();
    };

    const calls = Array.isArray(ch.calls) ? ch.calls : [];
    const hasActive = (Number(status.activeCalls) > 0) || (Number(status.activeChannels) > 0);
    if (ch._timeout) {
      box.innerHTML = `${iprnBanner}<p class="empty-state">CHANNEL LIST TIMED OUT — ASTERISK CLI SLOW OR BLOCKED. RETRY OR CHECK SUDO.</p>`;
      return;
    }
    if (!calls.length) {
      if (hasActive && ch.output) {
        box.innerHTML = `${iprnBanner}
          <p class="empty-state" style="margin-bottom:8px">ACTIVE CALL (RAW — PARSER COULD NOT BUILD TABLE)</p>
          <pre style="font-size:12px;color:var(--text-muted);white-space:pre-wrap">${escHtml(ch.output)}</pre>
        `;
        return;
      }
      if (hasActive && !ch.output) {
        box.innerHTML = `${iprnBanner}<p class="empty-state">ACTIVE CALL DETECTED BUT CHANNEL LIST EMPTY — CHECK SUDO ASTERISK FOR DASHBOARD USER</p>`;
        return;
      }
      box.innerHTML = `${iprnBanner}<p class="empty-state">NO ACTIVE CALLS</p>`;
      return;
    }

    const sortedCalls = [...calls].sort((a, b) => {
      const ca = normalize(a.callerid) || '\uffff';
      const cb = normalize(b.callerid) || '\uffff';
      if (ca !== cb) return ca.localeCompare(cb);
      return normalize(a.channel).localeCompare(normalize(b.channel));
    });

    box.innerHTML = `${iprnBanner}
      <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Rows are sorted by caller (NUMBER A). Same caller uses the same row color.</p>
      <table class="live-channels-table">
        <thead>
          <tr>
            <th>SL NO</th>
            <th>NUMBER A</th>
            <th>NUMBER B</th>
            <th>CALL DURATION</th>
            <th>SUPPLIER</th>
            <th>STATE</th>
          </tr>
        </thead>
        <tbody>
          ${sortedCalls.map((c, idx) => {
            const dur = normalize(c.duration) || '-';
            const rowClass = hashCallerColorClass(normalize(c.callerid));
            return `<tr class="${rowClass}">
            <td>${idx + 1}</td>
            <td style="font-family:monospace">${escHtml(normalize(c.callerid) || '-')}</td>
            <td style="font-family:monospace">${escHtml(normalize(c.destinationNumber || c.exten) || '-')}</td>
            <td style="font-family:monospace;white-space:nowrap">${escHtml(dur)}</td>
            <td>${escHtml(resolveSupplier(c.endpoint))}</td>
            <td>${escHtml(normalize(c.state || '').toUpperCase() || '-')}</td>
          </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  } catch (err) {
    console.error('Live channels refresh error:', err);
    box.innerHTML = '<p class="empty-state">LIVE CHANNEL DATA FAILED</p>';
  }
}

// ---- CALL STATS ----
function buildCallStatsProAlerts(summary) {
  if (!summary || typeof summary !== 'object') return '';
  const tc = Number(summary.total_calls) || 0;
  const asr = parseFloat(summary.asr);
  const acd = parseFloat(summary.acd);
  const drop = summary.asr_drop != null ? parseFloat(summary.asr_drop) : null;
  const flags = [];
  if (tc > 0 && tc < 20) {
    flags.push({ level: 'warn', text: 'LOW SAMPLE SIZE — MySQL call_logs stats may not be reliable' });
  }
  if (tc > 0 && !isNaN(asr) && asr < 30) {
    flags.push({ level: 'bad', text: 'BAD ROUTE — ASR below 30%' });
  }
  if (tc > 0 && !isNaN(acd) && acd < 10) {
    flags.push({ level: 'bad', text: 'SUSPICIOUS TRAFFIC — ACD below 10s (answered)' });
  }
  if (tc > 100 && drop != null && !isNaN(drop) && drop >= 10) {
    flags.push({ level: 'bad', text: 'SUPPLIER ISSUE — ASR dropped vs prior window (compare previous period)' });
  }
  if (!flags.length) return '';
  const color = (level) => (level === 'warn' ? 'var(--warning)' : 'var(--danger)');
  return `<div class="card" style="margin-bottom:16px;border-color:${color('bad')}">
    <div class="card-body padded" style="padding:12px 16px">
      <strong style="font-size:12px;text-transform:uppercase;letter-spacing:0.06em">Alerts</strong>
      <ul style="margin:8px 0 0 18px;padding:0;font-size:13px;line-height:1.5">
        ${flags.map((f) => `<li style="color:${color(f.level)}">${escHtml(f.text)}</li>`).join('')}
      </ul>
    </div>
  </div>`;
}

async function renderCallStats(el, hours = 24) {
  const h = Math.min(168, Math.max(1, parseInt(String(hours), 10) || 24));
  const [statsRes, suppliersRes, proRes] = await Promise.allSettled([
    API.getCallStats(h),
    API.getSuppliers(),
    API.getCallStatsPro(h),
  ]);
  const stats = statsRes.status === 'fulfilled' && statsRes.value && !statsRes.value.error
    ? statsRes.value
    : { totalCalls: 0, answeredCalls: 0, failedCalls: 0, totalDuration: 0, callsPerMinute: 0, asr: 0, acd: 0, recentCalls: [] };
  const suppliers = suppliersRes.status === 'fulfilled' && Array.isArray(suppliersRes.value) ? suppliersRes.value : [];

  const ipToSupplier = {};
  for (const s of suppliers) {
    for (const ip of s.ips) ipToSupplier[ip] = s.name;
  }

  let pro = null;
  let proErr = null;
  if (proRes.status === 'fulfilled' && proRes.value && typeof proRes.value === 'object') {
    if (proRes.value.ok === false) proErr = proRes.value.error || proRes.value.code || 'Unavailable';
    else if (proRes.value.summary) pro = proRes.value;
  } else if (proRes.status === 'rejected') {
    proErr = 'Request failed';
  }

  const proBanner = proErr
    ? `<div class="card" style="margin-bottom:16px;opacity:0.95"><div class="card-body padded"><p style="margin:0;font-size:13px;color:var(--text-muted)">
      <strong>Call logs analytics</strong> requires MySQL, <code>MYSQL_ENABLED=1</code>, and rows in <code>call_logs</code> (POST <code>/api/call-logs</code> or your ingest). Error: ${escHtml(String(proErr))}
    </p></div></div>`
    : '';

  const sum = pro?.summary;
  const recentDb = Array.isArray(pro?.recentSample) ? pro.recentSample : [];
  const useDbPrimary = sum && Number(sum.total_calls) > 0;
  const proGrid = pro && sum
    ? `${buildCallStatsProAlerts(sum)}
    ${!useDbPrimary ? `<div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="label">MySQL window</div><div class="value">${escHtml(String(sum.hours || h))}h</div><div class="sub">call_logs + DID match</div></div>
      <div class="stat-card"><div class="label">Est. revenue (${sum.hours || h}h)</div><div class="value green">${escHtml(String(sum.revenue))}</div><div class="sub">duration × DID rate</div></div>
      <div class="stat-card"><div class="label">ASR (logs)</div><div class="value blue">${escHtml(String(sum.asr))}%</div><div class="sub">vs prior: ${sum.previous_asr != null ? escHtml(String(sum.previous_asr)) + '%' : '—'}</div></div>
      <div class="stat-card"><div class="label">ACD (logs)</div><div class="value amber">${escHtml(String(sum.acd))}s</div><div class="sub">answered only</div></div>
    </div>` : `<p style="font-size:12px;color:var(--text-muted);margin:0 0 12px 0">ASR trend vs prior window: ${sum.previous_asr != null ? escHtml(String(sum.previous_asr)) + '%' : '—'} · Est. revenue (matched DIDs): <strong>${escHtml(String(sum.revenue))}</strong></p>`}
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>Prefix performance</h3></div>
      <div class="card-body" style="overflow:auto">
        ${pro.prefix && pro.prefix.length ? `<table><thead><tr><th>CC + prefix</th><th>Calls</th><th>ASR</th><th>ACD</th><th>Revenue</th></tr></thead><tbody>
          ${pro.prefix.map((p) => `<tr>
            <td style="font-family:monospace">${escHtml(String(p.prefix))}</td>
            <td>${p.calls}</td>
            <td>${escHtml(String(p.asr))}%</td>
            <td>${escHtml(String(p.acd))}s</td>
            <td>${escHtml(String(p.revenue))}</td>
          </tr>`).join('')}
        </tbody></table>` : '<p class="empty-state" style="padding:12px">No prefix match (check destinations vs DIDs)</p>'}
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>Supplier performance</h3></div>
      <div class="card-body" style="overflow:auto">
        ${pro.supplier && pro.supplier.length ? `<table><thead><tr><th>Supplier</th><th>Calls</th><th>ASR</th><th>ACD</th></tr></thead><tbody>
          ${pro.supplier.map((s) => `<tr>
            <td>${escHtml(String(s.name))}</td>
            <td>${s.calls}</td>
            <td>${escHtml(String(s.asr))}%</td>
            <td>${escHtml(String(s.acd))}s</td>
          </tr>`).join('')}
        </tbody></table>` : '<p class="empty-state" style="padding:12px">No supplier link (assign supplier on DIDs)</p>'}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px" class="call-stats-pro-split">
      <div class="card"><div class="card-header"><h3>Failure reasons</h3></div><div class="card-body padded">
        ${pro.failures && pro.failures.length
          ? `<ul style="margin:0;padding-left:18px;font-size:13px">${pro.failures.map((f) => `<li><strong>${escHtml(String(f.status))}</strong>: ${f.count}</li>`).join('')}</ul>`
          : '<p class="empty-state" style="margin:0">No data</p>'}
      </div></div>
      <div class="card"><div class="card-header"><h3>CLI analysis</h3></div><div class="card-body padded">
        ${pro.cli && pro.cli.length
          ? `<ul style="margin:0;padding-left:18px;font-size:13px">${pro.cli.map((c) => `<li>${escHtml(String(c.cli_type))}: ${c.calls} calls, ASR ${escHtml(String(c.asr))}%</li>`).join('')}</ul>`
          : '<p class="empty-state" style="margin:0">No data</p>'}
      </div></div>
    </div>`
    : '';

  const updatedAt = new Date().toLocaleString();

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <span style="font-size:12px;color:var(--text-muted)">Last updated: <strong style="color:var(--text)">${escHtml(updatedAt)}</strong> · ${h}h window</span>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:11px;color:var(--text-muted)">Auto-refresh 60s</span>
        <button type="button" class="btn btn-outline btn-sm" id="btn-call-stats-refresh">Refresh now</button>
      </div>
    </div>
    ${proBanner}
    ${proGrid}
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px 0">
      <strong>Summary (${h}h)</strong> — ${useDbPrimary
        ? `from <strong>MySQL call_logs</strong> (synced from CDR). Est. revenue: <strong>${escHtml(String(sum.revenue))}</strong>.`
        : `from <strong>CDR Master.csv</strong> until call_logs has rows; enable sync and deploy the collation fix.`}
    </p>
    <div class="stats-grid">
      ${useDbPrimary ? `
      <div class="stat-card">
        <div class="label">Total calls (${h}h) · DB</div>
        <div class="value blue">${sum.total_calls}</div>
        <div class="sub">${sum.calls_per_minute != null ? escHtml(String(sum.calls_per_minute)) : stats.callsPerMinute} / min</div>
      </div>
      <div class="stat-card">
        <div class="label">Answered · DB</div>
        <div class="value green">${sum.answered}</div>
        <div class="sub">ASR: ${escHtml(String(sum.asr))}%</div>
      </div>
      <div class="stat-card">
        <div class="label">Failed · DB</div>
        <div class="value" style="color:var(--danger)">${sum.failed}</div>
        <div class="sub">${sum.total_calls ? ((sum.failed / sum.total_calls) * 100).toFixed(1) : 0}% fail rate</div>
      </div>
      <div class="stat-card">
        <div class="label">ACD · DB</div>
        <div class="value amber">${escHtml(String(sum.acd))}s</div>
        <div class="sub">answered calls</div>
      </div>
      <div class="stat-card">
        <div class="label">Total duration · DB</div>
        <div class="value">${Math.round(sum.total_duration / 60)}m</div>
        <div class="sub">${sum.total_duration}s total billsec</div>
      </div>
      ` : `
      <div class="stat-card">
        <div class="label">Total Calls (${h}h) · CDR file</div>
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
      `}
    </div>
    ${useDbPrimary ? `<p style="font-size:11px;color:var(--text-muted);margin:0 0 12px 0">CDR file reference — ${stats.totalCalls} calls in same window (may differ until fully synced).</p>` : ''}
    <div class="card">
      <div class="card-header">
        <h3>${recentDb.length ? 'Recent calls (MySQL)' : 'Recent calls (CDR file)'}</h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline btn-sm" onclick="renderCallStatsForHours(1)">1h</button>
          <button class="btn btn-outline btn-sm" onclick="renderCallStatsForHours(6)">6h</button>
          <button class="btn btn-primary btn-sm" onclick="renderCallStatsForHours(24)">24h</button>
        </div>
      </div>
      <div class="card-body">
        ${recentDb.length ? `
        <table>
          <thead><tr><th>SL</th><th>CC + prefix</th><th>Caller</th><th>Destination</th><th>Duration</th><th>Supplier</th><th>Status</th></tr></thead>
          <tbody>${recentDb.map((c, i) => {
            const statusClass = c.disposition === 'ANSWERED' ? 'badge-ring' : 'badge-direct';
            return `<tr>
              <td>${i + 1}</td>
              <td style="font-family:monospace;font-size:12px"><span class="badge badge-ivr">${escHtml(c.prefix)}</span></td>
              <td style="font-family:monospace;font-size:12px">${escHtml(c.src)}</td>
              <td style="font-family:monospace;font-size:12px"><strong>${escHtml(c.dst)}</strong></td>
              <td>${c.billsec}s</td>
              <td><span class="badge badge-direct" style="font-size:11px">${escHtml(c.supplierName)}</span></td>
              <td><span class="badge ${statusClass}">${escHtml(c.disposition)}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : (stats.recentCalls.length ? `
        <table>
          <thead><tr><th>SL</th><th>CC + prefix</th><th>Caller Number</th><th>Calling Number</th><th>Duration</th><th>Supplier</th><th>Status</th></tr></thead>
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
        </table>` : '<div class="empty-state">No calls in this window.<br>Ensure CDR sync populates <code>call_logs</code> or check Master.csv.</div>')}
      </div>
    </div>`;

  document.getElementById('btn-call-stats-refresh')?.addEventListener('click', () => {
    renderCallStats(el, h);
  });

  if (callStatsInterval) clearInterval(callStatsInterval);
  window._callStatsHours = h;
  callStatsInterval = setInterval(() => {
    if (currentPage !== 'call-stats') return;
    const box = document.getElementById('content');
    if (box) renderCallStats(box, window._callStatsHours || 24);
  }, 60000);
}
// expose for inline onclick handlers
window.renderCallStatsForHours = async (h) => {
  const el = document.getElementById('content');
  await renderCallStats(el, h);
};

// ---- CDR HISTORY ----
window.applyCdrFiltersFromForm = function applyCdrFiltersFromForm() {
  window._cdrFilterState = {
    supplierId: document.getElementById('cdr-filter-supplier')?.value || '',
    callerSearch: document.getElementById('cdr-filter-caller')?.value?.trim() || '',
    didSearch: document.getElementById('cdr-filter-did')?.value?.trim() || '',
    dateFrom: document.getElementById('cdr-date-from')?.value || '',
    dateTo: document.getElementById('cdr-date-to')?.value || '',
  };
  renderCdrHistory(document.getElementById('content'));
};

async function renderCdrHistory(el) {
  const st = window._cdrFilterState || {};
  const hours = typeof window._cdrHistHours === 'number' ? window._cdrHistHours : 720;

  const [data, suppliers, numbers] = await Promise.all([
    API.getCdrHistory({
      hours,
      limit: 2500,
      dateFrom: st.dateFrom || undefined,
      dateTo: st.dateTo || undefined,
    }),
    API.getSuppliers(),
    API.getNumbers(),
  ]);

  const ipToSupplier = {};
  for (const s of suppliers) {
    for (const ip of s.ips) ipToSupplier[ip] = s.name;
  }

  const numList = Array.isArray(numbers) ? numbers : [];
  const rawCalls = data.calls || [];

  const enriched = rawCalls.map((c) => {
    const matched = matchNumberForDst(c.dst, numList);
    const rateNum = matched ? parseFloat(matched.rate) : 0;
    const rate = isFinite(rateNum) && rateNum > 0 ? rateNum : 0;
    const billMin = (c.billsec || 0) / 60;
    const amount = billMin * rate;
    const rateCurrency = matched && String(matched.rateCurrency).toLowerCase() === 'eur' ? 'eur' : 'usd';
    const supplierId = supplierIdForCall(c.sourceIp, matched, suppliers);
    const destId = matched && matched.destinationId != null ? String(matched.destinationId) : '';
    return {
      ...c,
      matched,
      rate,
      amount,
      rateCurrency,
      supplierId,
      destId,
    };
  });

  let filtered = enriched;
  if (st.supplierId) {
    filtered = filtered.filter((c) => c.supplierId === String(st.supplierId));
  }
  const callerQ = digitsOnly(st.callerSearch || '');
  if (callerQ) {
    filtered = filtered.filter((c) => digitsOnly(c.src).includes(callerQ));
  }
  const didQ = digitsOnly(st.didSearch || '');
  if (didQ) {
    filtered = filtered.filter((c) => digitsOnly(c.dst).includes(didQ));
  }

  filtered.sort((a, b) => {
    const sa = digitsOnly(a.src) || String(a.src || '');
    const sb = digitsOnly(b.src) || String(b.src || '');
    if (sa !== sb) return sa.localeCompare(sb);
    return new Date(b.start) - new Date(a.start);
  });

  const totalFetched = data.total ?? rawCalls.length;
  const shown = filtered.length;

  el.innerHTML = `
    <div class="card cdr-history-card">
      <div class="card-header">
        <h3>CDR</h3>
        <div class="cdr-range-btns">
          <button type="button" class="btn btn-outline btn-sm" onclick="window.setCdrHistoryHours(24)">24h</button>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.setCdrHistoryHours(168)">7d</button>
          <button type="button" class="btn btn-primary btn-sm" onclick="window.setCdrHistoryHours(720)">30d</button>
        </div>
      </div>
      <div class="card-body padded">
        <div class="cdr-filters">
          <div class="cdr-filter-row">
            <label class="cdr-filter-field">
              <span>Agents (supplier)</span>
              <select id="cdr-filter-supplier">
                <option value="">All agents</option>
                ${suppliers.map((s) => `<option value="${escHtml(String(s.id))}" ${String(st.supplierId) === String(s.id) ? 'selected' : ''}>${escHtml(s.name)}</option>`).join('')}
              </select>
            </label>
            <label class="cdr-filter-field">
              <span>Search caller number (source)</span>
              <input type="text" id="cdr-filter-caller" placeholder="e.g. 966531834217" value="${escHtml(st.callerSearch || '')}" autocomplete="off" />
            </label>
            <label class="cdr-filter-field">
              <span>Search DID number (destination)</span>
              <input type="text" id="cdr-filter-did" placeholder="e.g. 639989957929" value="${escHtml(st.didSearch || '')}" autocomplete="off" />
            </label>
          </div>
          <div class="cdr-filter-row cdr-filter-row-dates">
            <label class="cdr-filter-field">
              <span>From</span>
              <input type="date" id="cdr-date-from" value="${escHtml(st.dateFrom || '')}" />
            </label>
            <label class="cdr-filter-field">
              <span>To</span>
              <input type="date" id="cdr-date-to" value="${escHtml(st.dateTo || '')}" />
            </label>
            <div class="cdr-filter-actions">
              <button type="button" class="btn btn-cdr-search" onclick="window.applyCdrFiltersFromForm()">Search</button>
            </div>
          </div>
        </div>
        <p class="cdr-source-line">Source: <code>/var/log/asterisk/cdr-csv/Master.csv</code> — window <strong>${hours}h</strong>, loaded <strong>${totalFetched}</strong>, shown after filters <strong>${shown}</strong>. Caller/DID search matches any substring of digits. Same caller (source) uses the same row color.</p>
        ${!data.ok && data.error ? `<p class="empty-state" style="color:var(--danger)">${escHtml(data.error)}</p>` : ''}
        <div class="cdr-history-wrap">
        ${filtered.length ? `
        <table class="cdr-history-table">
          <thead><tr>
            <th>Date</th><th>Source</th><th>Destination</th><th>Duration</th><th>Rate</th><th>Amount</th><th>Status</th>
          </tr></thead>
          <tbody>${filtered.map((c) => {
            const statusClass = c.disposition === 'ANSWERED' ? 'badge-ring' : 'badge-direct';
            const supplierName = c.sourceIp && ipToSupplier[c.sourceIp] ? ipToSupplier[c.sourceIp] : (c.sourceIp || '-');
            const rowClass = hashCallerColorClass(c.src);
            const statusLabel = formatCdrStatusLabel(c.disposition);
            return `<tr class="${rowClass}" title="Supplier: ${escHtml(supplierName)}">
              <td class="cdr-cell-date">${escHtml(formatCdrDateDisplay(c.start))}</td>
              <td class="cdr-cell-num">${escHtml(c.src)}</td>
              <td class="cdr-cell-num"><strong>${escHtml(c.dst)}</strong></td>
              <td>${escHtml(formatBillMinutes(c.billsec))}</td>
              <td>${escHtml(formatCdrNativeRate(c.rate, c.rateCurrency))}</td>
              <td>${escHtml(formatCdrNativeAmount(c.amount, c.rateCurrency))}</td>
              <td><span class="badge ${statusClass}">${escHtml(statusLabel)}</span></td>
            </tr>`;
          }).join('')}</tbody>
        </table>` : '<div class="empty-state">No CDR rows match these filters.</div>'}
        </div>
      </div>
    </div>`;
}

window.setCdrHistoryHours = (h) => {
  window._cdrHistHours = h;
  const el = document.getElementById('content');
  renderCdrHistory(el);
};

// ---- BALANCE (UTC weekly Mon 00:00 – Sun 23:59) ----
function formatBalanceInCurrency(amount, cur) {
  const n = Number(amount) || 0;
  if (cur === 'usd') return '$' + n.toFixed(2);
  if (cur === 'eur') return '€' + n.toFixed(2);
  return n.toFixed(2) + ' SAR';
}

window.setBalanceCurrency = function setBalanceCurrency(c) {
  if (c === 'usd' || c === 'eur' || c === 'sar') window._balanceCurrency = c;
  const el = document.getElementById('content');
  if (el && typeof currentPage !== 'undefined' && currentPage === 'balance') renderBalance(el);
};

window.refreshBalancePage = function refreshBalancePage() {
  return renderBalance(document.getElementById('content'));
};

window.saveBalanceRates = async function saveBalanceRates() {
  const eurEl = document.getElementById('bal-eur-per-usd');
  const sarEl = document.getElementById('bal-sar-per-usd');
  const eur = parseFloat(eurEl?.value);
  const sar = parseFloat(sarEl?.value);
  try {
    await API.updateBalance({
      eurPerUsd: Number.isFinite(eur) ? eur : 0,
      sarPerUsd: Number.isFinite(sar) ? sar : 0,
    });
    toast('Exchange multipliers saved');
    await renderBalance(document.getElementById('content'));
  } catch (e) {
    toast('Save failed: ' + (e.message || e), 'error');
  }
};

function walletCardHtml(title, sub, w) {
  if (!w) return '';
  return `
    <div class="balance-wallet-card">
      <div class="balance-wallet-title">${escHtml(title)}</div>
      <div class="balance-wallet-sub">${escHtml(sub)}</div>
      <div class="balance-wallet-lines">
        <div><span class="balance-wallet-k">USD</span> <span class="balance-wallet-v">${escHtml(formatBalanceInCurrency(w.totalUsd, 'usd'))}</span></div>
        <div><span class="balance-wallet-k">EUR</span> <span class="balance-wallet-v">${escHtml(formatBalanceInCurrency(w.totalEur, 'eur'))}</span></div>
        <div class="balance-wallet-sar"><span class="balance-wallet-k">SAR (exchange)</span> <span class="balance-wallet-v">${escHtml(formatBalanceInCurrency(w.totalSar, 'sar'))}</span></div>
      </div>
    </div>`;
}

async function renderBalance(el) {
  const cur = window._balanceCurrency === 'eur' || window._balanceCurrency === 'sar' ? window._balanceCurrency : 'usd';
  window._balanceCurrency = cur;

  let report;
  try {
    report = await API.getBalance();
  } catch (e) {
    el.innerHTML = `<div class="card"><div class="card-body padded"><p class="empty-state">Balance request failed: ${escHtml(e.message || String(e))}</p></div></div>`;
    return;
  }

  if (!report || report.error) {
    el.innerHTML = `<div class="card"><div class="card-body padded"><p class="empty-state">Could not load balance.</p></div></div>`;
    return;
  }

  const cfg = report.config || {};
  const ww = report.weeklyWallet?.current;
  const mw = report.monthlyWallet?.current;
  const weeks = report.weeklyWallet?.weeks || [];
  const months = report.monthlyWallet?.months || [];
  const colClass = (c) => (cur === c ? 'balance-col-active' : '');

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Balance</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <div class="balance-currency-toggle">
            <span style="font-size:11px;color:var(--text-muted);margin-right:4px">Highlight</span>
            <button type="button" class="btn btn-sm ${cur === 'usd' ? 'btn-primary' : 'btn-outline'}" onclick="window.setBalanceCurrency('usd')">USD</button>
            <button type="button" class="btn btn-sm ${cur === 'eur' ? 'btn-primary' : 'btn-outline'}" onclick="window.setBalanceCurrency('eur')">EUR</button>
            <button type="button" class="btn btn-sm ${cur === 'sar' ? 'btn-primary' : 'btn-outline'}" onclick="window.setBalanceCurrency('sar')">SAR</button>
          </div>
          <button type="button" class="btn btn-outline btn-sm" onclick="window.refreshBalancePage()">Refresh</button>
        </div>
      </div>
      <div class="card-body padded">
        <p class="balance-note">${escHtml(report.weekBoundsNote || '')}</p>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:16px">Each DID has a per-minute rate in <strong>USD or EUR</strong> and a <strong>payment term</strong> (weekly / monthly / daily). Weekly + daily terms accrue in the <strong>weekly wallet</strong>; monthly terms in the <strong>monthly wallet</strong>. SAR = USD×(SAR/USD) + EUR×(SAR/EUR) using your multipliers.</p>
        ${report.cdrMissing ? '<p class="empty-state" style="margin-bottom:12px">CDR file missing — totals are 0 until <code>/var/log/asterisk/cdr-csv/Master.csv</code> exists.</p>' : ''}
        ${report.readError ? '<p class="empty-state" style="margin-bottom:12px;color:var(--danger)">Could not read CDR file.</p>' : ''}
        <div class="balance-wallet-grid">
          ${walletCardHtml(
            'Weekly wallet',
            ww ? `UTC week ${ww.primaryKey} → ${ww.rangeEndUtc} · resets Mon 00:00 UTC` : '',
            ww
          )}
          ${walletCardHtml(
            'Monthly wallet',
            mw ? `UTC month ${mw.primaryKey.slice(0, 7)} → ${mw.rangeEndUtc} · resets 1st 00:00 UTC` : '',
            mw
          )}
        </div>
        <div class="card" style="margin-top:20px;background:rgba(0,0,0,.15)">
          <div class="card-header"><h3>FX (for SAR conversion)</h3></div>
          <div class="card-body padded" style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">
            <label class="cdr-filter-field" style="min-width:140px">
              <span>EUR per 1 USD</span>
              <input type="number" step="0.0001" id="bal-eur-per-usd" value="${escHtml(String(cfg.eurPerUsd ?? ''))}" />
            </label>
            <label class="cdr-filter-field" style="min-width:140px">
              <span>SAR per 1 USD</span>
              <input type="number" step="0.0001" id="bal-sar-per-usd" value="${escHtml(String(cfg.sarPerUsd ?? ''))}" />
            </label>
            <button type="button" class="btn btn-primary" onclick="window.saveBalanceRates()">Save rates</button>
          </div>
        </div>
        <div class="card" style="margin-top:20px">
          <div class="card-header"><h3>Weekly wallet history (52 UTC weeks)</h3></div>
          <div class="card-body padded" style="overflow-x:auto">
            <table class="balance-weekly-table">
              <thead>
                <tr>
                  <th>Mon (UTC)</th>
                  <th>Sun (UTC)</th>
                  <th class="${colClass('usd')}">USD</th>
                  <th class="${colClass('eur')}">EUR</th>
                  <th class="${colClass('sar')}">SAR</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${weeks.map((w) => `
                <tr class="${w.isCurrent ? 'balance-row-current' : ''}">
                  <td style="font-family:monospace;font-size:12px">${escHtml(w.primaryKey)}</td>
                  <td style="font-family:monospace;font-size:12px">${escHtml(w.rangeEndUtc)}</td>
                  <td class="${colClass('usd')}">${escHtml(formatBalanceInCurrency(w.totalUsd, 'usd'))}</td>
                  <td class="${colClass('eur')}">${escHtml(formatBalanceInCurrency(w.totalEur, 'eur'))}</td>
                  <td class="${colClass('sar')}">${escHtml(formatBalanceInCurrency(w.totalSar, 'sar'))}</td>
                  <td>${w.isCurrent ? '<span class="badge badge-ring">Current</span>' : ''}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card" style="margin-top:20px">
          <div class="card-header"><h3>Monthly wallet history (24 UTC months)</h3></div>
          <div class="card-body padded" style="overflow-x:auto">
            <table class="balance-weekly-table">
              <thead>
                <tr>
                  <th>Month start</th>
                  <th>Month end</th>
                  <th class="${colClass('usd')}">USD</th>
                  <th class="${colClass('eur')}">EUR</th>
                  <th class="${colClass('sar')}">SAR</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${months.map((w) => `
                <tr class="${w.isCurrent ? 'balance-row-current' : ''}">
                  <td style="font-family:monospace;font-size:12px">${escHtml(w.primaryKey)}</td>
                  <td style="font-family:monospace;font-size:12px">${escHtml(w.rangeEndUtc)}</td>
                  <td class="${colClass('usd')}">${escHtml(formatBalanceInCurrency(w.totalUsd, 'usd'))}</td>
                  <td class="${colClass('eur')}">${escHtml(formatBalanceInCurrency(w.totalEur, 'eur'))}</td>
                  <td class="${colClass('sar')}">${escHtml(formatBalanceInCurrency(w.totalSar, 'sar'))}</td>
                  <td>${w.isCurrent ? '<span class="badge badge-ring">Current</span>' : ''}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
        <p style="font-size:11px;color:var(--text-muted);margin-top:12px">Parsed CDR rows: ${report.parsedRows ?? 0}. Closed periods are snapshotted in <code>db.json</code> (<code>balance.weeklySnapshots</code>, <code>balance.monthlySnapshots</code>) when first seen after the period ends.</p>
      </div>
    </div>`;
}

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
        <button class="btn btn-outline btn-sm" type="button" onclick="location.reload()">Refresh</button>
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

// ---- PANEL ADMINS ----
async function renderAdminUsers(el) {
  const data = await API.getAdminUsers();
  if (data && data.error) {
    el.innerHTML = `<div class="card"><div class="card-body padded"><p class="empty-state" style="color:var(--danger)">${escHtml(data.error)}</p></div></div>`;
    return;
  }
  const users = (data && data.users) || [];
  const envU = (data && data.envUsername) || 'admin';

  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>How logins work</h3></div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px">
          Break-glass account <strong>${escHtml(envU)}</strong> uses <code>DASH_USER</code> / <code>DASH_PASS</code> on the server and is never stored in <code>db.json</code>.
        </p>
        <p style="font-size:13px;color:var(--text-muted);margin:0">
          Optional: set <code>AUTO_APPLY_ASTERISK_ON_LOGIN=1</code> in the dashboard <code>.env</code> so a successful login also copies configs to <code>/etc/asterisk/</code> and reloads Asterisk (same as &quot;Apply &amp; Reload&quot;).
        </p>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>Extra panel users (${users.length})</h3>
        <button type="button" class="btn btn-primary" id="btn-add-admin">+ Add user</button>
      </div>
      <div class="card-body">
        ${users.length ? `
        <table>
          <thead><tr><th>Username</th><th></th></tr></thead>
          <tbody>${users.map((u) => `<tr>
            <td><strong style="font-family:monospace">${escHtml(u.username)}</strong></td>
            <td style="white-space:nowrap">
              <button type="button" class="btn btn-outline btn-sm pw-admin" data-u="${escHtml(u.username)}">New password</button>
              <button type="button" class="btn btn-outline btn-sm del-admin" data-u="${escHtml(u.username)}" style="margin-left:6px;color:var(--danger);border-color:var(--danger)">Remove</button>
            </td>
          </tr>`).join('')}</tbody>
        </table>` : '<div class="empty-state">No extra users — only the env account can sign in until you add one.</div>'}
      </div>
    </div>`;

  document.getElementById('btn-add-admin').onclick = () => {
    showModal('Add panel user', `
      <div class="form-group">
        <label>Username</label>
        <input class="form-control" id="adm-user" placeholder="letters, numbers, _ . -" autocomplete="username">
      </div>
      <div class="form-group">
        <label>Password (min 8 characters)</label>
        <input class="form-control" id="adm-pass" type="password" autocomplete="new-password">
      </div>
    `, async () => {
      const username = document.getElementById('adm-user').value.trim();
      const password = document.getElementById('adm-pass').value;
      const r = await API.addAdminUser({ username, password });
      if (!r.ok) {
        toast(r.error || 'Could not add user', 'error');
        return;
      }
      closeModal();
      toast('User added');
      renderAdminUsers(el);
    });
  };

  el.querySelectorAll('.pw-admin').forEach((b) => {
    b.onclick = () => {
      const username = b.getAttribute('data-u');
      showModal(`New password: ${username}`, `
        <div class="form-group">
          <label>New password (min 8 characters)</label>
          <input class="form-control" id="adm-pw2" type="password" autocomplete="new-password">
        </div>
      `, async () => {
        const password = document.getElementById('adm-pw2').value;
        const r = await API.updateAdminPassword(username, password);
        if (!r.ok) {
          toast(r.error || 'Update failed', 'error');
          return;
        }
        closeModal();
        toast('Password updated');
        renderAdminUsers(el);
      });
    };
  });

  el.querySelectorAll('.del-admin').forEach((b) => {
    b.onclick = async () => {
      const username = b.getAttribute('data-u');
      if (!confirm(`Remove panel user "${username}"?`)) return;
      const r = await API.deleteAdminUser(username);
      if (!r.ok) {
        toast(r.error || 'Remove failed', 'error');
        return;
      }
      toast('User removed');
      renderAdminUsers(el);
    };
  });
}

// ---- IPRN TENANT + CLIENT USERS (panel) ----
async function renderTenantDashboard(el) {
  const d = await API.getTenantDashboard();
  if (d && d.error) {
    el.innerHTML = `<div class="card"><div class="card-body padded"><p class="empty-state">${escHtml(d.error)}</p></div></div>`;
    return;
  }
  const u = d.user || {};
  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="label">Balance</div><div class="value blue">${escHtml(String(u.balance ?? 0))}</div></div>
      <div class="stat-card"><div class="label">Assigned numbers</div><div class="value">${d.activeNumbers ?? 0}</div></div>
      <div class="stat-card"><div class="label">Live calls (your DIDs)</div><div class="value">${d.liveCalls ?? 0}</div></div>
      <div class="stat-card"><div class="label">CDR est. cost (30d window)</div><div class="value">${escHtml(String(d.cdrCostWindow ?? 0))}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Recent invoices</h3></div>
      <div class="card-body padded">
        ${(d.recentInvoices || []).length ? `<ul style="font-size:13px">${d.recentInvoices.map((i) => `<li>${escHtml(i.period_start)} → ${escHtml(i.period_end)} · ${escHtml(String(i.amount))} · ${escHtml(i.status)}</li>`).join('')}</ul>` : '<p class="empty-state">No invoices yet</p>'}
      </div>
    </div>
    <p style="font-size:12px;color:var(--text-muted)">Costs are estimated from CDR CSV and <code>numbers</code> rates. Balance enforcement on outbound calls requires <code>TENANT_ENFORCE_BALANCE=1</code> and <code>TENANT_ORIGINATE_CMD</code> for the generator.</p>`;
}

async function renderTenantLiveCalls(el) {
  async function refresh() {
    const live = await API.getTenantLiveCalls();
    const rows = (live.calls || []).map((c) => `<tr>
      <td style="font-family:monospace;font-size:12px">${escHtml(c.callerid || '—')}</td>
      <td style="font-family:monospace;font-size:12px">${escHtml(c.destinationNumber || c.exten || '—')}</td>
      <td>${escHtml(c.duration || '—')}</td>
      <td>${escHtml(c.state || '—')}</td>
      <td>${c.assignedUserId != null ? escHtml(String(c.assignedUserId)) : '—'}</td>
    </tr>`).join('');
    el.innerHTML = `
      <div class="card">
        <div class="card-header"><h3>Live calls</h3><span style="font-size:12px;color:var(--text-muted)">Refresh every 4s</span></div>
        <div class="card-body padded">
          ${rows ? `<table><thead><tr><th>Caller</th><th>Dialed / DID</th><th>Duration</th><th>State</th><th>Assigned user</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty-state">No active channels matching your numbers</p>'}
        </div>
      </div>`;
  }
  await refresh();
  tenantLiveInterval = setInterval(refresh, 4000);
}

async function renderTenantCdr(el) {
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-body padded">
        <div class="form-row">
          <div class="form-group"><label>From</label><input type="date" class="form-control" id="tcdr-from"></div>
          <div class="form-group"><label>To</label><input type="date" class="form-control" id="tcdr-to"></div>
          <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-primary" type="button" id="tcdr-go">Load</button></div>
        </div>
      </div>
    </div>
    <div class="card"><div class="card-body padded" id="tcdr-box"><p class="empty-state">Loading…</p></div></div>`;
  const load = async () => {
    const df = document.getElementById('tcdr-from').value;
    const dt = document.getElementById('tcdr-to').value;
    const data = await API.getTenantCdr({ hours: 24 * 90, limit: 800, dateFrom: df, dateTo: dt });
    const box = document.getElementById('tcdr-box');
    if (!data.ok) {
      box.innerHTML = `<p class="empty-state">${escHtml(data.error || 'Failed')}</p>`;
      return;
    }
    const rows = (data.calls || []).map((c) => `<tr>
      <td style="font-size:11px">${escHtml(c.start)}</td>
      <td style="font-family:monospace">${escHtml(c.dst)}</td>
      <td>${c.billsec}s</td>
      <td>${escHtml(String(c.cost ?? 0))}</td>
      <td>${escHtml(c.disposition || '')}</td>
    </tr>`).join('');
    box.innerHTML = rows
      ? `<table><thead><tr><th>Time</th><th>Number</th><th>Duration</th><th>Est. cost</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<p class="empty-state">No CDR rows for your assigned numbers in this range</p>';
  };
  document.getElementById('tcdr-go').onclick = load;
  await load();
}

async function renderTenantBilling(el) {
  const me = await API.getAuthMe();
  const dash = await API.getTenantDashboard();
  const bal = dash.user ? dash.user.balance : 0;
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Balance</h3></div>
      <div class="card-body padded">
        <p style="font-size:28px;font-weight:600">${escHtml(String(bal))}</p>
        <p style="font-size:13px;color:var(--text-muted)">Logged in as <strong>${escHtml(me.username || '')}</strong> (${escHtml(me.role || '')}). Prepaid balance is stored in MySQL; per-call deduction in Asterisk is not wired in this extension — use reporting and manual adjustments from the operator.</p>
      </div>
    </div>`;
}

async function renderTenantInvoices(el) {
  const data = await API.getTenantInvoices();
  const inv = (data.invoices || []).map((i) => {
    const m = i.meta || {};
    return `<tr>
      <td>${i.id}</td>
      <td>${escHtml(String(i.period_start))} → ${escHtml(String(i.period_end))}</td>
      <td>${escHtml(String(i.amount))}</td>
      <td>${escHtml(i.status)}</td>
      <td><a href="/api/tenant/invoices/${i.id}/csv" target="_blank" rel="noopener">CSV</a></td>
    </tr>`;
  }).join('');
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header"><h3>Generate invoice</h3></div>
      <div class="card-body padded">
        <div class="form-row">
          <div class="form-group"><label>Period start</label><input type="date" class="form-control" id="tinv-p1"></div>
          <div class="form-group"><label>Period end</label><input type="date" class="form-control" id="tinv-p2"></div>
          <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-primary" type="button" id="tinv-gen">Generate</button></div>
        </div>
        <p style="font-size:12px;color:var(--text-muted)">PDF export: use browser print on CSV or a spreadsheet. Weekly/monthly schedules are manual for now.</p>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Invoices</h3></div>
      <div class="card-body padded">
        ${inv ? `<table><thead><tr><th>ID</th><th>Period</th><th>Amount</th><th>Status</th><th>Export</th></tr></thead><tbody>${inv}</tbody></table>` : '<p class="empty-state">None</p>'}
      </div>
    </div>`;
  document.getElementById('tinv-gen').onclick = async () => {
    const periodStart = document.getElementById('tinv-p1').value;
    const periodEnd = document.getElementById('tinv-p2').value;
    const r = await API.generateTenantInvoice({ periodStart, periodEnd });
    if (!r.ok) toast(r.error || 'Failed', 'error');
    else toast('Invoice created');
    renderTenantInvoices(el);
  };
}

async function renderTenantSubusers(el) {
  const me = await API.getAuthMe();
  if (me.role === 'subuser') {
    el.innerHTML = '<div class="card"><div class="card-body padded"><p class="empty-state">Subusers cannot manage subusers.</p></div></div>';
    return;
  }
  const data = await API.getTenantSubusers();
  const rows = (data.subusers || []).map((s) => `<tr>
    <td>${escHtml(s.username)}</td>
    <td>${escHtml(String(s.balance))}</td>
    <td><button type="button" class="btn btn-outline btn-sm t-del-sub" data-id="${s.id}">Remove</button></td>
  </tr>`).join('');
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Subusers</h3><button type="button" class="btn btn-primary" id="t-add-sub">+ Add</button></div>
      <div class="card-body padded">
        ${rows ? `<table><thead><tr><th>Username</th><th>Balance</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty-state">No subusers</p>'}
      </div>
    </div>`;
  document.getElementById('t-add-sub').onclick = () => {
    showModal('Add subuser', `
      <div class="form-group"><label>Username</label><input class="form-control" id="tsu-u"></div>
      <div class="form-group"><label>Password (8+)</label><input type="password" class="form-control" id="tsu-p"></div>
      <div class="form-group"><label>Initial balance</label><input class="form-control" id="tsu-b" value="0"></div>
    `, async () => {
      const r = await API.createTenantSubuser({
        username: document.getElementById('tsu-u').value.trim(),
        password: document.getElementById('tsu-p').value,
        balance: parseFloat(document.getElementById('tsu-b').value) || 0,
      });
      if (!r.ok) { toast(r.error || 'Failed', 'error'); return; }
      closeModal();
      toast('Subuser created');
      renderTenantSubusers(el);
    });
  };
  el.querySelectorAll('.t-del-sub').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Delete subuser?')) return;
      await API.deleteTenantSubuser(b.dataset.id);
      toast('Removed');
      renderTenantSubusers(el);
    };
  });
}

async function renderTenantNumbers(el) {
  const me = await API.getAuthMe();
  const nums = await API.getTenantNumbers();
  const subs = me.role !== 'subuser' ? await API.getTenantSubusers() : { subusers: [] };
  const list = (nums.numbers || []).map((n) => `<tr><td style="font-family:monospace">${escHtml(n.number)}</td><td>user #${n.user_id}</td></tr>`).join('');
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Assigned numbers in your org</h3></div>
      <div class="card-body padded">
        ${list ? `<table><thead><tr><th>Number</th><th>User id</th></tr></thead><tbody>${list}</tbody></table>` : '<p class="empty-state">None</p>'}
      </div>
    </div>
    ${me.role === 'subuser' ? '' : `
    <div class="card" style="margin-top:16px">
      <div class="card-header"><h3>Assign to subuser</h3></div>
      <div class="card-body padded">
        <div class="form-row">
          <div class="form-group"><label>Number (digits)</label><input class="form-control" id="tna-num"></div>
          <div class="form-group"><label>Subuser</label><select class="form-control" id="tna-sub">${(subs.subusers || []).map((s) => `<option value="${s.id}">${escHtml(s.username)}</option>`).join('')}</select></div>
          <div class="form-group" style="display:flex;align-items:flex-end"><button class="btn btn-primary" type="button" id="tna-go">Assign</button></div>
        </div>
        <p style="font-size:12px;color:var(--text-muted)">You can only pass on numbers already assigned to your login. Operator assigns inventory to clients from <strong>IPRN clients</strong>.</p>
      </div>
    </div>`}`;
  const go = document.getElementById('tna-go');
  if (go) {
    go.onclick = async () => {
      const number = document.getElementById('tna-num').value.trim();
      const userId = document.getElementById('tna-sub').value;
      const r = await API.tenantAllocate({ userId, number });
      if (!r.ok) toast(r.error || 'Failed', 'error');
      else toast('Assigned');
      renderTenantNumbers(el);
    };
  }
}

async function renderTenantCallGenerator(el) {
  const nums = await API.getTenantNumbers();
  const arr = nums.numbers || [];
  const opts = arr.map((n) => `<option value="${escHtml(n.number)}">${escHtml(n.number)}</option>`).join('');
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Outbound test call</h3></div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px">Requires <code>TENANT_ORIGINATE_CMD</code> on the server (e.g. <code>channel originate Local/7001@from-internal application Dial PJSIP/{DEST}@endpoint</code>). Placeholders: <code>{DEST}</code>, <code>{FROM}</code>.</p>
        <div class="form-group"><label>Destination (digits)</label><input class="form-control" id="tcg-d" placeholder="e.g. 4930123456"></div>
        <div class="form-group"><label>From assigned DID</label><select class="form-control" id="tcg-f">${opts || '<option value="">— none —</option>'}</select></div>
        <button type="button" class="btn btn-primary" id="tcg-go">Call</button>
        <pre id="tcg-out" style="margin-top:12px;font-size:12px;color:var(--text-muted);white-space:pre-wrap"></pre>
      </div>
    </div>`;
  document.getElementById('tcg-go').onclick = async () => {
    const destination = document.getElementById('tcg-d').value.trim();
    const fromNumber = document.getElementById('tcg-f').value.trim();
    const r = await API.tenantCallGenerator({ destination, fromNumber });
    document.getElementById('tcg-out').textContent = JSON.stringify(r, null, 2);
    if (r.ok) toast('Originate sent');
    else toast(r.error || r.message || 'Failed', 'error');
  };
}

async function renderIprnClients(el) {
  const data = await API.getIprnClientUsers();
  if (data.error) {
    el.innerHTML = `<div class="card"><div class="card-body padded"><p class="empty-state">${escHtml(data.error)}</p></div></div>`;
    return;
  }
  const users = data.users || [];
  const rows = users.map((u) => `<tr>
    <td>${u.id}</td>
    <td><strong>${escHtml(u.username)}</strong></td>
    <td>${escHtml(u.role)}</td>
    <td>${u.parent_user_id ?? '—'}</td>
    <td>${escHtml(String(u.balance))}</td>
    <td>${escHtml(u.status)}</td>
    <td>
      <button type="button" class="btn btn-outline btn-sm ic-bal" data-id="${u.id}">Balance</button>
      <button type="button" class="btn btn-outline btn-sm ic-asn" data-id="${u.id}">Assign #</button>
      <button type="button" class="btn btn-outline btn-sm ic-del" data-id="${u.id}" style="color:var(--danger)">Delete</button>
    </td>
  </tr>`).join('');
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>IPRN client users (MySQL)</h3><button type="button" class="btn btn-primary" id="ic-add">+ User</button></div>
      <div class="card-body padded">
        ${rows ? `<table><thead><tr><th>ID</th><th>Username</th><th>Role</th><th>Parent</th><th>Balance</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="empty-state">No users — create a client (<code>user</code> or <code>admin</code>) for portal login.</p>'}
      </div>
    </div>`;
  document.getElementById('ic-add').onclick = () => {
    showModal('Create IPRN user', `
      <div class="form-group"><label>Username</label><input class="form-control" id="ic-u"></div>
      <div class="form-group"><label>Password (8+)</label><input type="password" class="form-control" id="ic-p"></div>
      <div class="form-group"><label>Role</label><select class="form-control" id="ic-r"><option value="user">user (client)</option><option value="admin">admin</option><option value="subuser">subuser</option></select></div>
      <div class="form-group"><label>Parent user id (optional)</label><input class="form-control" id="ic-par" placeholder="empty = root client"></div>
      <div class="form-group"><label>Balance</label><input class="form-control" id="ic-b" value="0"></div>
    `, async () => {
      const body = {
        username: document.getElementById('ic-u').value.trim(),
        password: document.getElementById('ic-p').value,
        role: document.getElementById('ic-r').value,
        parent_user_id: document.getElementById('ic-par').value.trim() || null,
        balance: parseFloat(document.getElementById('ic-b').value) || 0,
      };
      const r = await API.createIprnClientUser(body);
      if (!r.ok) { toast(r.error || 'Failed', 'error'); return; }
      closeModal();
      toast('User created');
      renderIprnClients(el);
    });
  };
  el.querySelectorAll('.ic-bal').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      showModal('Set balance', `<div class="form-group"><label>Balance</label><input class="form-control" id="ic-bv"></div>`, async () => {
        const r = await API.setIprnClientBalance(id, parseFloat(document.getElementById('ic-bv').value) || 0);
        if (!r.ok) { toast(r.error || 'Failed', 'error'); return; }
        closeModal();
        renderIprnClients(el);
      });
    };
  });
  el.querySelectorAll('.ic-asn').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.id;
      showModal('Assign number from inventory', `<div class="form-group"><label>Full number (digits)</label><input class="form-control" id="ic-n"></div>`, async () => {
        const r = await API.assignIprnClientNumber(id, document.getElementById('ic-n').value.trim());
        if (!r.ok) { toast(r.error || 'Failed', 'error'); return; }
        closeModal();
        toast('Assigned');
        renderIprnClients(el);
      });
    };
  });
  el.querySelectorAll('.ic-del').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Delete user and assignments?')) return;
      await API.deleteIprnClientUser(b.dataset.id);
      toast('Deleted');
      renderIprnClients(el);
    };
  });
}

// ---- SUPPLIERS ----
async function renderSuppliers(el) {
  const suppliers = await API.getSuppliers();

  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>Termination Providers (${suppliers.length})</h3>
        <button class="btn btn-primary" id="btn-add-sup">+ Add Supplier</button>
      </div>
      <div class="card-body">
        ${suppliers.length ? `
        <table>
          <thead><tr><th>Name</th><th>Trusted IP/CIDR</th><th>DIDs</th><th></th></tr></thead>
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
      <label>Trusted IP/CIDR (one per line)</label>
      <textarea class="form-control" id="sup-ips" rows="4" style="font-family:monospace;font-size:13px" placeholder="e.g.\n108.61.70.46\n1.2.3.4/32\n203.0.113.0/24">${(supplier?.ips || []).join('\n')}</textarea>
    </div>
  `, async () => {
    const name = document.getElementById('sup-name').value.trim();
    const ips = document.getElementById('sup-ips').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!name) { toast('Supplier name is required', 'error'); return; }
    if (!ips.length) { toast('At least one trusted IP/CIDR is required', 'error'); return; }

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

function sipStateForEndpoint(contacts, endpoint) {
  if (!contacts || !contacts.length || !endpoint) return '—';
  const el = String(endpoint).toLowerCase();
  for (const c of contacts) {
    const blob = `${c.uri || ''} ${c.line || ''}`.toLowerCase();
    if (blob.includes(el)) {
      if (c.state === 'available') return 'Avail';
      if (c.state === 'unavailable') return 'Unavail';
      return '?';
    }
  }
  return 'n/a';
}

// ---- NUMBERS ----
async function renderNumbers(el) {
  el.innerHTML = '<div class="card"><div class="card-body padded"><p class="empty-state">Loading number inventory…</p></div></div>';
  try {
  const settled = await Promise.allSettled([
    API.getNumbers(),
    API.getSuppliers(),
    API.getIvrMenus(),
    API.getGlobals(),
    API.getIprnBillingSummary(800).catch(() => ({ rows: [] })),
    API.getPjsipContacts().catch(() => ({ contacts: [] })),
  ]);
  const numRes = settled[0];
  let numbers = numRes.status === 'fulfilled' && Array.isArray(numRes.value) ? numRes.value : [];
  if (numRes.status === 'rejected') {
    console.error('[numbers]', numRes.reason);
    toast(`Could not load numbers: ${numRes.reason?.message || numRes.reason}`, 'error');
  } else if (numRes.status === 'fulfilled' && numRes.value && !Array.isArray(numRes.value) && numRes.value.error) {
    toast(`Numbers API: ${escHtml(String(numRes.value.error))}`, 'error');
    numbers = [];
  }
  const suppliers = settled[1].status === 'fulfilled' && Array.isArray(settled[1].value) ? settled[1].value : [];
  const ivrMenus = settled[2].status === 'fulfilled' && Array.isArray(settled[2].value) ? settled[2].value : [];
  const globals = settled[3].status === 'fulfilled' && settled[3].value && typeof settled[3].value === 'object'
    ? settled[3].value
    : {};
  const billingRes = settled[4].status === 'fulfilled' ? settled[4].value : { rows: [] };
  const sipRes = settled[5].status === 'fulfilled' ? settled[5].value : { contacts: [] };
  const billRows = billingRes && Array.isArray(billingRes.rows) ? billingRes.rows : [];
  const billByNum = Object.fromEntries(billRows.map((r) => [String(r.number), r]));
  const contacts = sipRes && Array.isArray(sipRes.contacts) ? sipRes.contacts : [];

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
  const dialEntries = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  const detectCountryFromPrefix = (fullPrefix) => {
    const normalized = String(fullPrefix || '').replace(/\D/g, '');
    for (const c of dialEntries) {
      if (normalized.startsWith(c.dial)) return c;
    }
    return null;
  };

  const flatPrefixes = [];
  for (const country of countries) {
    const prefixes = byCountry[country];
    const prefixKeys = Object.keys(prefixes).sort();
    for (const pk of prefixKeys) {
      const pg = prefixes[pk];
      const fullPrefix = `${pg.countryCode || ''}${pg.prefix || ''}`;
      const detected = country === 'XX' ? detectCountryFromPrefix(fullPrefix) : COUNTRIES.find(cc => cc.code === country);
      const countryName = detected ? detected.name : (country === 'XX' ? 'Unknown' : country);
      flatPrefixes.push({ country, pg, detectedCountry: countryName });
    }
  }
  const detectedCountryCount = new Set(flatPrefixes.map(p => p.detectedCountry)).size;
  const groupedByDetectedCountry = flatPrefixes.reduce((acc, item) => {
    if (!acc[item.detectedCountry]) acc[item.detectedCountry] = [];
    acc[item.detectedCountry].push(item);
    return acc;
  }, {});
  const detectedCountryOrder = Object.keys(groupedByDetectedCountry).sort();

  const prefixRowsSorted = [...flatPrefixes].sort((a, b) => {
    const ca = String(a.detectedCountry || '');
    const cb = String(b.detectedCountry || '');
    if (ca !== cb) return ca.localeCompare(cb);
    const pa = `${a.pg.countryCode || ''}${a.pg.prefix || ''}`;
    const pb = `${b.pg.countryCode || ''}${b.pg.prefix || ''}`;
    return pa.localeCompare(pb);
  });
  const prefixSummaryByCountry = prefixRowsSorted.reduce((acc, entry) => {
    const k = String(entry.detectedCountry || '—');
    if (!acc[k]) acc[k] = [];
    acc[k].push(entry);
    return acc;
  }, {});
  const prefixSummaryCountryOrder = Object.keys(prefixSummaryByCountry).sort();
  const prefixInventoryTable = prefixRowsSorted.length
    ? `<div class="did-inventory-wrap">
        ${prefixSummaryCountryOrder.map((cLabel) => {
          const entries = prefixSummaryByCountry[cLabel];
          return `
          <section class="did-country-block">
            <h4 class="did-country-title">${escHtml(cLabel)} <span class="did-country-meta">(${entries.length} prefix${entries.length !== 1 ? 'es' : ''})</span></h4>
            ${entries.map((entry) => {
              const { pg, detectedCountry } = entry;
              const fullP = `${pg.countryCode || ''}${pg.prefix || ''}`;
              const ivrId = pg.numbers[0]?.destinationId;
              const ivrName = ivrMenus.find((i) => i.id === ivrId)?.name || '—';
              const supNames = [...new Set(
                pg.numbers.map((n) => suppliers.find((s) => s.id === n.supplierId)?.name).filter(Boolean)
              )];
              const supStr = supNames.length ? supNames.map((x) => escHtml(String(x))).join(', ') : '—';
              return `
              <div class="did-prefix-card did-prefix-card--summary">
                <div class="did-prefix-card-toolbar">
                  <div class="did-prefix-line">
                    <span class="did-prefix-key">${escHtml(fullP)}</span>
                    <span class="did-prefix-count">(${pg.numbers.length} number${pg.numbers.length !== 1 ? 's' : ''})</span>
                  </div>
                  <div class="did-prefix-meta-inline" style="font-size:12px;color:var(--text-muted)">${escHtml(String(detectedCountry || '—'))}</div>
                </div>
                <div class="did-prefix-body">
                  <table class="did-simple-table">
                    <thead><tr><th>Default IVR</th><th>IVR tariff</th><th>Termination</th></tr></thead>
                    <tbody><tr>
                      <td>${escHtml(ivrName)}</td>
                      <td>${formatPrefixTariff(pg)}</td>
                      <td style="color:var(--text-muted);font-size:12px">${supStr}</td>
                    </tr></tbody>
                  </table>
                </div>
              </div>`;
            }).join('')}
          </section>`;
        }).join('')}
      </div>`
    : '<p class="empty-state">No prefixes yet — add DIDs below.</p>';

  el.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>IPRN routing defaults</h3></div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 14px;line-height:1.45">
          <strong>One source of truth:</strong> the inventory below defines DIDs. <strong>Apply &amp; Reload Asterisk</strong> regenerates dialplan (<code>did-routing</code>) from that list and, when MySQL is enabled, keeps <code>numbers</code> and <code>number_inventory</code> in sync for ODBC billing/routing.
        </p>
        <div class="form-row">
          <div class="form-group">
            <label>Default Fallback IVR (unmatched DID)</label>
            <select class="form-control" id="did-fallback-ivr">
              ${ivrMenus.map(ivr => `<option value="${ivr.id}" ${String(globals.fallbackIvrId || '1') === ivr.id ? 'selected' : ''}>${ivr.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-outline" id="btn-save-did-standard">Save routing defaults</button>
          </div>
        </div>
        <div class="form-row" style="margin-top:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
            <input type="checkbox" id="iprn-odbc-routing" ${globals.iprnOdbcRouting ? 'checked' : ''} />
            <span>ODBC supplier routing for <strong>matched</strong> DIDs (MySQL <code>number_inventory</code> + DSN <code>iprn_db</code> → PJSIP Dial + <code>call_billing</code>). Unmatched DIDs still use fallback IVR.</span>
          </label>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:8px">Standard flow: <code>from-supplier-ip → did-routing</code> → either IVR or ODBC/PJSIP when the option above is on; catch-all → fallback IVR.</div>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="label">Total DIDs</div><div class="value blue">${totalNumbers}</div></div>
      <div class="stat-card"><div class="label">Countries</div><div class="value">${detectedCountryCount}</div></div>
      <div class="stat-card"><div class="label">Prefixes</div><div class="value">${totalPrefixes}</div></div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>Prefix inventory</h3></div>
      <div class="card-body padded">
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px;line-height:1.45">
          One summary row per <strong>CC + prefix</strong>. Full DID lists and per-number edits are in <strong>DID Inventory</strong> below (grouped by country, same layout as wholesale number panels).
        </p>
        ${prefixInventoryTable}
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <h3>DID Inventory</h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-outline" id="btn-upload-file">Upload File</button>
          <button class="btn btn-primary" id="btn-add-number">+ Add DID</button>
        </div>
      </div>
      <div class="card-body padded" id="numbers-list">
        ${flatPrefixes.length ? `
        <div class="did-inventory-wrap">
            ${detectedCountryOrder.map((countryLabel) => {
              const entries = groupedByDetectedCountry[countryLabel];
              return `
              <section class="did-country-block">
                <h4 class="did-country-title">${escHtml(countryLabel)} <span class="did-country-meta">(${entries.length} prefix${entries.length !== 1 ? 'es' : ''})</span></h4>
                ${entries.map((entry, idx) => {
                const { country, pg, detectedCountry } = entry;
                const groupId = `prefix-group-${countryLabel.replace(/\W+/g, '-')}-${idx}`;
                const fullPrefixDigits = `${pg.countryCode || ''}${pg.prefix || ''}`;
                return `
                <div class="did-prefix-card">
                  <div class="did-prefix-card-toolbar">
                    <div class="did-prefix-line">
                      <span class="did-prefix-key">${escHtml(fullPrefixDigits)}</span>
                      <span class="did-prefix-count">(${pg.numbers.length} number${pg.numbers.length !== 1 ? 's' : ''})</span>
                    </div>
                    <div class="did-prefix-bulk">
                      <span class="text-muted" style="font-size:12px">Default IVR</span>
                      <select class="form-control prefix-ivr-sel" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" style="width:auto;min-width:140px;padding:4px 8px;font-size:12px">
                        ${ivrMenus.map(ivr => `<option value="${ivr.id}" ${pg.numbers[0]?.destinationId === ivr.id ? 'selected' : ''}>${ivr.name}</option>`).join('')}
                      </select>
                      <span class="did-prefix-tariff-inline">${formatPrefixTariff(pg)}</span>
                      <select class="form-control prefix-bulk-ivr" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" style="width:auto;min-width:120px;padding:4px 8px;font-size:12px;display:inline-block">
                        ${ivrMenus.map(ivr => `<option value="${ivr.id}">${ivr.name}</option>`).join('')}
                      </select>
                      <button type="button" class="btn btn-outline btn-sm apply-prefix-bulk-ivr" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}">Set</button>
                      <button type="button" class="btn-icon del-prefix" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" title="Delete entire prefix">&#128465;</button>
                    </div>
                  </div>
                  <div id="${groupId}" class="did-prefix-body">
                    <table class="did-simple-table">
                      <thead>
                        <tr>
                          <th class="did-col-chk"><input type="checkbox" class="prefix-select-all" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" title="Select all"></th>
                          <th>Numbers</th>
                          <th>Country</th>
                          <th>IVR</th>
                          <th>IVR tariff</th>
                          <th>Terms</th>
                          <th>Allocation</th>
                          <th>Del</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${pg.numbers.map((n) => {
                          const sup = suppliers.find((s) => s.id === n.supplierId);
                          const isAlloc = String(n.status || '').toLowerCase() === 'allocated';
                          const allocDateShort = n.allocationDate ? String(n.allocationDate).slice(0, 10) : '';
                          const fullDig = `${n.countryCode}${n.prefix}${n.extension}`;
                          const routeSel = n.iprnRouteStatus === 'blocked' ? 'blocked' : 'active';
                          const sipLbl = sipStateForEndpoint(contacts, n.routingPjsipEndpoint || '');
                          const br = billByNum[fullDig];
                          const billTxt = br
                            ? `${br.call_count}× ${Math.round((br.duration_seconds || 0) / 60)}m / ${Number(br.total_profit || 0).toFixed(2)}`
                            : '—';
                          const lastU = n.lastUsedInventory ? String(n.lastUsedInventory).replace('T', ' ').slice(0, 19) : '—';
                          return `<tr>
                            <td><input type="checkbox" class="prefix-number-chk" data-country="${country}" data-cc="${n.countryCode}" data-prefix="${n.prefix}" data-id="${n.id}"></td>
                            <td style="font-family:monospace;font-weight:500">${fullDig}</td>
                            <td>${escHtml(String(detectedCountry))}</td>
                            <td>
                              <select class="form-control number-ivr-sel" data-id="${n.id}" style="width:auto;min-width:130px;padding:4px 8px;font-size:12px">
                                ${ivrMenus.map(ivr => `<option value="${ivr.id}" ${n.destinationId === ivr.id ? 'selected' : ''}>${ivr.name}</option>`).join('')}
                              </select>
                            </td>
                            <td style="font-size:13px">${formatDidIvrTariff(n)}</td>
                            <td style="font-size:12px">${formatDidPaymentTerms(n)}</td>
                            <td style="font-size:12px;vertical-align:middle">
                              ${isAlloc
                                ? `<span class="badge badge-ring">allocated</span><div style="margin-top:4px">${escHtml(n.clientName || '—')}</div>
                                   ${allocDateShort ? `<div style="color:var(--text-muted);font-size:11px">${escHtml(allocDateShort)}</div>` : ''}
                                   <button type="button" class="btn btn-outline btn-sm btn-release-did" data-id="${n.id}" style="margin-top:6px">Release</button>`
                                : `<span class="badge badge-direct">pool</span>
                                   <button type="button" class="btn btn-outline btn-sm btn-assign-did" data-id="${n.id}" style="margin-top:6px">Assign</button>`}
                            </td>
                            <td>
                              <button type="button" class="btn-icon del-single-did" data-id="${n.id}" title="Delete this DID">&#128465;</button>
                            </td>
                          </tr>
                          <tr class="did-advanced-row">
                            <td colspan="8" style="padding:0;border:none">
                              <details class="did-advanced-details">
                                <summary>Advanced — supplier, ODBC route, billing</summary>
                                <div style="overflow:auto;padding:10px 0 4px">
                                  <table class="did-advanced-table">
                                    <thead>
                                      <tr>
                                        <th>Ext</th><th>Supplier</th><th>Route</th><th>PJSIP</th><th>Backup</th><th>Cost/m</th><th>Pri</th><th>Last used</th><th>Billing Σ</th><th>SIP</th><th>Rate</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      <tr>
                                        <td style="font-family:monospace">${escHtml(String(n.extension))}</td>
                                        <td>${sup ? `<span class="badge badge-direct">${escHtml(sup.name)}</span>` : '—'}</td>
                                        <td><select class="form-control iprn-route-st" data-id="${n.id}" style="width:auto;padding:2px 6px;font-size:11px">
                                          <option value="active" ${routeSel === 'active' ? 'selected' : ''}>active</option>
                                          <option value="blocked" ${routeSel === 'blocked' ? 'selected' : ''}>blocked</option>
                                        </select></td>
                                        <td><input type="text" class="form-control iprn-pjsip" data-id="${n.id}" value="${escHtml(String(n.routingPjsipEndpoint || ''))}" placeholder="endpoint" style="width:100px;font-size:11px;padding:2px 6px" /></td>
                                        <td><input type="text" class="form-control iprn-backup" data-id="${n.id}" value="${escHtml(String(n.backupPjsipEndpoint || ''))}" style="width:88px;font-size:11px;padding:2px 6px" /></td>
                                        <td><input type="text" class="form-control iprn-cost" data-id="${n.id}" value="${escHtml(String(n.costPerMin != null ? n.costPerMin : ''))}" style="width:52px;font-size:11px;padding:2px 6px" /></td>
                                        <td><input type="text" class="form-control iprn-pri" data-id="${n.id}" value="${escHtml(String(n.iprnPriority != null ? n.iprnPriority : 0))}" style="width:36px;font-size:11px;padding:2px 6px" /></td>
                                        <td style="font-size:11px;color:var(--text-muted)">${escHtml(lastU)}</td>
                                        <td style="font-size:11px" title="calls × approx minutes / profit sum">${escHtml(billTxt)}</td>
                                        <td style="font-size:11px">${escHtml(sipLbl)}</td>
                                        <td><button type="button" class="btn btn-outline btn-sm edit-prefix-rate" data-country="${country}" data-cc="${pg.countryCode}" data-prefix="${pg.prefix}" data-rate="${escHtml(String(pg.rate))}" data-currency="${escHtml(String(pg.numbers[0]?.rateCurrency || 'usd'))}" data-term="${escHtml(String(pg.numbers[0]?.paymentTerm || 'weekly'))}">Edit rate</button></td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>
                              </details>
                            </td>
                          </tr>`;
                        }).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>`;
              }).join('')}
              </section>`;
            }).join('')}
        </div>` : '<div class="empty-state">No numbers in inventory yet. Click &quot;+ Add DID&quot; to get started.</div>'}
      </div>
    </div>`;
  el.querySelectorAll('.del-single-did').forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!id || !confirm('Delete this DID from inventory?')) return;
      await API.deleteNumber(id);
      markChanged();
      toast('DID removed');
      renderNumbers(el);
    };
  });

  const numListRoot = el.querySelector('#numbers-list');
  if (numListRoot) {
    numListRoot.addEventListener('change', async (e) => {
      const t = e.target;
      if (t.classList && t.classList.contains('iprn-route-st')) {
        await API.updateNumber(t.dataset.id, { iprnRouteStatus: t.value });
        markChanged();
        toast('Route status saved');
      }
    });
    numListRoot.addEventListener('blur', async (e) => {
      const t = e.target;
      if (!t.classList || !t.dataset.id) return;
      if (t.classList.contains('iprn-pjsip')) {
        await API.updateNumber(t.dataset.id, { routingPjsipEndpoint: t.value.trim() });
        markChanged();
        toast('Primary PJSIP endpoint saved');
      } else if (t.classList.contains('iprn-backup')) {
        await API.updateNumber(t.dataset.id, { backupPjsipEndpoint: t.value.trim() });
        markChanged();
        toast('Backup endpoint saved');
      } else if (t.classList.contains('iprn-cost')) {
        await API.updateNumber(t.dataset.id, { costPerMin: t.value.trim() });
        markChanged();
        toast('Cost/min saved');
      } else if (t.classList.contains('iprn-pri')) {
        const p = parseInt(t.value, 10);
        await API.updateNumber(t.dataset.id, { iprnPriority: Number.isFinite(p) ? p : 0 });
        markChanged();
        toast('Priority saved');
      }
    }, true);
  }

  document.getElementById('btn-save-did-standard').onclick = async () => {
    const fallbackIvrId = document.getElementById('did-fallback-ivr').value;
    const iprnOdbcRouting = !!document.getElementById('iprn-odbc-routing')?.checked;
    await API.updateGlobals({ fallbackIvrId, iprnOdbcRouting });
    markChanged();
    toast(`Routing defaults saved (fallback IVR ${fallbackIvrId}${iprnOdbcRouting ? ', ODBC routing on' : ''})`);
  };

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

  el.querySelectorAll('.number-ivr-sel').forEach(sel => {
    sel.onchange = async () => {
      const id = sel.dataset.id;
      const newIvrId = sel.value;
      await API.updateNumber(id, { destinationType: 'ivr', destinationId: newIvrId });
      markChanged();
      toast(`DID route updated -> IVR ${newIvrId}`);
    };
  });

  el.querySelectorAll('.prefix-select-all').forEach(chk => {
    chk.onchange = () => {
      const country = chk.dataset.country;
      const cc = chk.dataset.cc;
      const prefix = chk.dataset.prefix;
      el.querySelectorAll(`.prefix-number-chk[data-country="${country}"][data-cc="${cc}"][data-prefix="${prefix}"]`)
        .forEach(c => { c.checked = chk.checked; });
    };
  });

  el.querySelectorAll('.apply-prefix-bulk-ivr').forEach(btn => {
    btn.onclick = async () => {
      const country = btn.dataset.country;
      const cc = btn.dataset.cc;
      const prefix = btn.dataset.prefix;
      const targetSel = el.querySelector(`.prefix-bulk-ivr[data-country="${country}"][data-cc="${cc}"][data-prefix="${prefix}"]`);
      const newIvrId = targetSel?.value;
      if (!newIvrId) {
        toast('Select an IVR first', 'error');
        return;
      }
      const selected = Array.from(
        el.querySelectorAll(`.prefix-number-chk[data-country="${country}"][data-cc="${cc}"][data-prefix="${prefix}"]:checked`)
      );
      if (!selected.length) {
        toast('Select at least one DID', 'error');
        return;
      }
      for (const c of selected) {
        await API.updateNumber(c.dataset.id, { destinationType: 'ivr', destinationId: newIvrId });
      }
      markChanged();
      toast(`Updated ${selected.length} DID(s) -> IVR ${newIvrId}`);
      renderNumbers(el);
    };
  });

  el.querySelectorAll('.btn-assign-did').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      showModal('Assign DID', `
        <div class="form-group">
          <label>Client name</label>
          <input class="form-control" id="assign-client-name" placeholder="Client or company name" maxlength="255" autocomplete="organization">
        </div>
        <p style="font-size:12px;color:var(--text-muted)">Status is set to <strong>allocated</strong> and the allocation date is stored (UTC).</p>
      `, async () => {
        const clientName = document.getElementById('assign-client-name').value;
        try {
          const result = await API.assignNumber(id, { clientName });
          if (result && result.error) {
            toast(result.error, 'error');
            return;
          }
          markChanged();
          toast('DID allocated');
          closeModal();
          renderNumbers(el);
        } catch (e) {
          toast(e.message || 'Assign failed', 'error');
        }
      });
    };
  });

  el.querySelectorAll('.btn-release-did').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!confirm('Release this DID back to the pool? Client name and allocation date will be cleared.')) return;
      try {
        const result = await API.releaseNumber(id);
        if (result && result.error) {
          toast(result.error, 'error');
          return;
        }
        markChanged();
        toast('DID released to pool');
        renderNumbers(el);
      } catch (e) {
        toast(e.message || 'Release failed', 'error');
      }
    };
  });

  el.querySelectorAll('.edit-prefix-rate').forEach(b => b.onclick = () => {
    const currentRate = b.dataset.rate;
    const curCy = b.dataset.currency === 'eur' ? 'eur' : 'usd';
    const curTerm = b.dataset.term || 'weekly';
    const cc = b.dataset.cc;
    const prefix = b.dataset.prefix;
    const country = b.dataset.country;
    showModal('Edit rate & payment', `
      <div class="form-group">
        <label>Rate for ${escHtml(cc)} ${escHtml(prefix)} (${curCy === 'eur' ? '€' : '$'}/min)</label>
        <input class="form-control" id="edit-rate-val" type="number" step="0.001" value="${escHtml(String(currentRate))}">
      </div>
      <div class="form-group">
        <label>Rate currency</label>
        <select class="form-control" id="edit-rate-currency">
          <option value="usd" ${curCy === 'usd' ? 'selected' : ''}>USD per minute</option>
          <option value="eur" ${curCy === 'eur' ? 'selected' : ''}>EUR per minute</option>
        </select>
      </div>
      <div class="form-group">
        <label>Payment term → wallet</label>
        <select class="form-control" id="edit-payment-term">
          <option value="weekly" ${curTerm === 'weekly' ? 'selected' : ''}>Weekly (weekly wallet, Mon–Sun UTC)</option>
          <option value="daily" ${curTerm === 'daily' ? 'selected' : ''}>Daily (weekly wallet)</option>
          <option value="monthly" ${curTerm === 'monthly' ? 'selected' : ''}>Monthly (monthly wallet)</option>
        </select>
      </div>
    `, async () => {
      const newRate = document.getElementById('edit-rate-val').value;
      const newCy = document.getElementById('edit-rate-currency').value;
      const newTerm = document.getElementById('edit-payment-term').value;
      const nums = numbers.filter(n => n.country === country && n.countryCode === cc && n.prefix === prefix);
      for (const n of nums) {
        await API.updateNumber(n.id, { rate: newRate, rateCurrency: newCy, paymentTerm: newTerm });
      }
      toast('Rate & payment term updated');
      closeModal();
      renderNumbers(el);
    });
  });
  } catch (err) {
    console.error('[renderNumbers]', err);
    el.innerHTML = `<div class="card"><div class="card-body padded">
      <p style="color:var(--danger);margin-bottom:8px"><strong>Number inventory failed to load.</strong></p>
      <p style="font-size:13px;color:var(--text-muted)">${escHtml(String(err?.message || err))}</p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:10px">If MySQL is slow or the schema is wrong, check server logs and <code>journalctl -u asterisk-dashboard</code>. Retry after fixing DB or use <code>MYSQL_ENABLED=0</code> to use <code>db.json</code> only.</p>
      <button type="button" class="btn btn-outline btn-sm" style="margin-top:12px" onclick="navigateTo('numbers')">Retry</button>
    </div></div>`;
    toast('Number inventory error — see message above', 'error');
  }
}

function showAddNumberModal(suppliers, ivrMenus) {
  showModal('Add DID', `
    <div class="form-row">
      <div class="form-group">
        <label>Country Code (optional)</label>
        <input class="form-control" id="num-country-code" placeholder="e.g. 39" style="font-family:monospace">
      </div>
      <div class="form-group">
        <label>DID Prefix</label>
        <input class="form-control" id="num-prefix" placeholder="e.g. 393199050 (no spaces)">
      </div>
    </div>
    <div class="form-group" style="margin-top:-4px">
      <label>Extension(s) — appended to the prefix above</label>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin:8px 0;font-size:13px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="radio" name="num-ext-mode" id="num-ext-mode-list" value="list" checked> List (one extension per line)
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="radio" name="num-ext-mode" id="num-ext-mode-range" value="range"> Range (from → to)
        </label>
      </div>
      <div id="num-ext-manual">
        <textarea class="form-control" id="num-extensions" rows="5" style="font-family:monospace" placeholder="646&#10;642&#10;645"></textarea>
      </div>
      <div id="num-ext-range" style="display:none">
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <input class="form-control" id="num-range-from" aria-label="Extension range from" placeholder="From" style="font-family:monospace">
          </div>
          <div class="form-group" style="margin-bottom:0">
            <input class="form-control" id="num-range-to" aria-label="Extension range to" placeholder="To" style="font-family:monospace">
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:6px" id="num-range-count"></div>
      </div>
    </div>
    <div class="form-row-3">
      <div class="form-group">
        <label>Rate / min</label>
        <input class="form-control" id="num-rate" type="number" step="0.001" value="0.01" placeholder="0.01">
      </div>
      <div class="form-group">
        <label>Rate currency</label>
        <select class="form-control" id="num-rate-currency">
          <option value="usd">USD per minute</option>
          <option value="eur">EUR per minute</option>
        </select>
      </div>
      <div class="form-group">
        <label>Payment term</label>
        <select class="form-control" id="num-payment-term">
          <option value="weekly">Weekly → weekly wallet</option>
          <option value="daily">Daily → weekly wallet</option>
          <option value="monthly">Monthly → monthly wallet</option>
        </select>
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
      <label>Or paste full DIDs (auto-split to prefix + extensions)</label>
      <textarea class="form-control" id="num-full-dids" rows="4" style="font-family:monospace" placeholder="393199050646\n393199050642\n393199050645"></textarea>
      <div style="margin-top:8px">
        <button type="button" class="btn btn-outline btn-sm" id="btn-auto-split-dids">Auto-split Full DIDs</button>
      </div>
    </div>
    <div class="form-group">
      <label>Preview</label>
      <div id="num-preview" style="font-size:12px;color:var(--text-muted);font-family:monospace;padding:8px;background:var(--bg-input);border-radius:var(--radius);min-height:30px">Enter DID prefix and extension(s) to preview</div>
    </div>
  `, async () => {
    const country = 'XX';
    const countryCode = document.getElementById('num-country-code').value.trim().replace(/\D/g, '');
    const prefix = document.getElementById('num-prefix').value.trim();
    const rate = document.getElementById('num-rate').value || '0.01';
    const rateCurrency = document.getElementById('num-rate-currency').value || 'usd';
    const paymentTerm = document.getElementById('num-payment-term').value || 'weekly';
    const supplierId = document.getElementById('num-supplier').value;
    let extensions;
    const isRange = document.getElementById('num-ext-mode-range').checked;
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

    if (!prefix) { toast('Prefix is required', 'error'); return; }
    if (!extensions.length) { toast('Enter at least one extension', 'error'); return; }

    const destinationId = document.getElementById('num-dest-id').value;
    const nums = extensions.map(ext => ({ country, countryCode, prefix, extension: ext, rate, rateCurrency, paymentTerm, supplierId, destinationType: 'ivr', destinationId }));
    await API.addBulkNumbers(nums);
    toast(`Added ${nums.length} DID(s)`);
    closeModal();
    renderPage('numbers');
  });

  function updatePreview() {
    const cc = document.getElementById('num-country-code').value.trim().replace(/\D/g, '') || '?';
    const prefix = document.getElementById('num-prefix').value.trim() || '???';
    const preview = document.getElementById('num-preview');
    const isRange = document.getElementById('num-ext-mode-range')?.checked;

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
  document.getElementById('num-country-code').oninput = updatePreview;
  document.getElementById('num-prefix').oninput = updatePreview;
  document.getElementById('num-extensions').oninput = updatePreview;
  function syncExtModeUi() {
    const range = document.getElementById('num-ext-mode-range').checked;
    document.getElementById('num-ext-manual').style.display = range ? 'none' : '';
    document.getElementById('num-ext-range').style.display = range ? '' : 'none';
    updatePreview();
  }
  document.getElementById('num-ext-mode-list').onchange = syncExtModeUi;
  document.getElementById('num-ext-mode-range').onchange = syncExtModeUi;
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

  document.getElementById('btn-auto-split-dids').onclick = () => {
    const raw = document.getElementById('num-full-dids').value;
    const dids = raw
      .split(/\r?\n/)
      .map(s => s.trim().replace(/[^\d]/g, ''))
      .filter(Boolean);

    if (!dids.length) {
      toast('Paste at least one full DID', 'error');
      return;
    }

    const first = dids[0];
    if (first.length <= 3) {
      toast('DID too short to auto-split', 'error');
      return;
    }
    const prefix = first.slice(0, -3);
    const exts = [];
    for (const d of dids) {
      if (!d.startsWith(prefix) || d.length <= 3) {
        toast('All DIDs must share same prefix and end with 3 digits (XXX)', 'error');
        return;
      }
      exts.push(d.slice(-3));
    }

    document.getElementById('num-prefix').value = prefix;
    document.getElementById('num-extensions').value = exts.join('\n');
    document.getElementById('num-ext-mode-list').checked = true;
    document.getElementById('num-ext-manual').style.display = '';
    document.getElementById('num-ext-range').style.display = 'none';
    updatePreview();
    toast(`Detected prefix ${prefix} with ${exts.length} extension(s) as XXX`);
  };

}

// ---- IPRN RANGE INVENTORY (MySQL iprn_inv_* — Phase 1) ----
async function renderIprnInventory(el) {
  el.innerHTML = '<div class="card"><div class="card-body padded"><p class="empty-state">Loading IPRN range inventory…</p></div></div>';
  const [supRes, rangeRes] = await Promise.all([
    API.getIprnInventorySuppliers(),
    API.getIprnInventoryRanges(),
  ]);
  if (supRes && supRes.error && supRes.enabled === false) {
    el.innerHTML = `<div class="card"><div class="card-body padded">
      <p style="color:var(--danger)"><strong>MySQL required.</strong> Set <code>MYSQL_ENABLED=1</code> and DB credentials, restart the dashboard, then refresh. Tables <code>iprn_inv_*</code> are created on connect from <code>sql/iprn_inventory.sql</code>.</p>
    </div></div>`;
    return;
  }
  const suppliers = (supRes && supRes.rows) || [];
  const rows = (rangeRes && rangeRes.rows) || [];
  const statusOpts = ['NEW', 'TESTING', 'ACTIVE', 'DEGRADED', 'BLOCKED', 'ARCHIVED'];

  function iprnRouteKey(n) {
    const c = String(n.country || '').trim();
    const p = String(n.prefix || '').trim();
    const cd = digitsOnly(c);
    if (cd.length >= 1 && p) return cd + digitsOnly(p);
    if (c && p) return `${c} ${p}`;
    return p || c || '—';
  }

  const iprnByCountry = rows.reduce((acc, r) => {
    const k = String(r.country || '—');
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});
  const iprnCountryOrder = Object.keys(iprnByCountry).sort();

  el.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>Add IPRN range</h3></div>
      <div class="card-body padded">
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Range-based rows in <code>iprn_inv_numbers</code>. Separate from per-DID <strong>DID Inventory</strong>.</p>
        <div class="form-row" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
          <div class="form-group"><label>Country</label><input class="form-control" id="iprn-add-country" placeholder="e.g. DE"></div>
          <div class="form-group"><label>Prefix</label><input class="form-control" id="iprn-add-prefix" placeholder="e.g. 49"></div>
          <div class="form-group"><label>Range start</label><input class="form-control" id="iprn-add-rs" placeholder="digits"></div>
          <div class="form-group"><label>Range end</label><input class="form-control" id="iprn-add-re" placeholder="digits"></div>
          <div class="form-group"><label>Supplier</label>
            <select class="form-control" id="iprn-add-sup">${suppliers.length ? suppliers.map((s) => `<option value="${escHtml(String(s.id))}">${escHtml(s.name)}</option>`).join('') : '<option value="">— add supplier first —</option>'}</select>
          </div>
          <div class="form-group"><label>Access</label>
            <select class="form-control" id="iprn-add-acc"><option value="IVR">IVR</option><option value="DIRECT">DIRECT</option><option value="SIP">SIP</option></select>
          </div>
          <div class="form-group"><label>Type</label>
            <select class="form-control" id="iprn-add-typ"><option value="IPRN">IPRN</option><option value="TEST">TEST</option></select>
          </div>
          <button type="button" class="btn btn-primary" id="iprn-add-btn">Add range</button>
        </div>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3>Add supplier (IPRN module)</h3></div>
      <div class="card-body padded">
        <div class="form-row" style="flex-wrap:wrap;gap:12px;align-items:flex-end">
          <div class="form-group"><label>Name</label><input class="form-control" id="iprn-sup-name" placeholder="Name"></div>
          <div class="form-group"><label>Country</label><input class="form-control" id="iprn-sup-country" placeholder=""></div>
          <div class="form-group"><label>SIP host</label><input class="form-control" id="iprn-sup-host" placeholder="sip.example.com"></div>
          <div class="form-group"><label>Protocol</label>
            <select class="form-control" id="iprn-sup-prot"><option value="SIP">SIP</option><option value="IAX">IAX</option></select>
          </div>
          <div class="form-group"><label>Reliability</label><input class="form-control" id="iprn-sup-rel" type="number" step="0.1" value="0"></div>
          <button type="button" class="btn btn-outline" id="iprn-sup-btn">Add supplier</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Prefix Routing Map</h3></div>
      <div class="card-body padded">
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Range blocks in <code>iprn_inv_numbers</code>, grouped by country (same panel style as DID Inventory). ASR / ACD placeholders in <code>iprn_inv_stats</code>. Health job: <code>node dashboard/jobs/numberHealth.js</code>.</p>
        ${rows.length ? `<div class="did-inventory-wrap">
          ${iprnCountryOrder.map((cLabel) => {
            const list = iprnByCountry[cLabel];
            return `
            <section class="did-country-block">
              <h4 class="did-country-title">${escHtml(cLabel)} <span class="did-country-meta">(${list.length} range${list.length !== 1 ? 's' : ''})</span></h4>
              ${list.map((n) => {
                const rk = iprnRouteKey(n);
                const sel = statusOpts.map((s) => `<option value="${s}" ${n.status === s ? 'selected' : ''}>${s}</option>`).join('');
                return `
                <div class="did-prefix-card">
                  <div class="did-prefix-card-toolbar">
                    <div class="did-prefix-line">
                      <span class="did-prefix-key">${escHtml(rk)}</span>
                      <span class="did-prefix-count">(${escHtml(String(n.type || 'IPRN'))})</span>
                    </div>
                    <div class="did-prefix-meta-inline" style="font-size:12px;color:var(--text-muted)">ID ${n.id}</div>
                  </div>
                  <div class="did-prefix-body">
                    <table class="did-simple-table">
                      <thead>
                        <tr>
                          <th>Range</th>
                          <th>Supplier</th>
                          <th>Access</th>
                          <th>Status</th>
                          <th>ASR / ACD</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style="font-family:monospace;font-size:13px">${escHtml(String(n.range_start || ''))} – ${escHtml(String(n.range_end || ''))}</td>
                          <td>${escHtml(String(n.supplier_name || '—'))}</td>
                          <td>${escHtml(String(n.access_type || '—'))}</td>
                          <td><select class="form-control iprn-inv-status" data-id="${n.id}" style="width:auto;min-width:120px;padding:4px 8px;font-size:12px">${sel}</select></td>
                          <td style="font-size:12px;color:var(--text-muted)">— / —</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>`;
              }).join('')}
            </section>`;
          }).join('')}
        </div>` : '<p class="empty-state">No IPRN ranges yet.</p>'}
      </div>
    </div>`;

  document.getElementById('iprn-add-btn').onclick = async () => {
    const body = {
      country: document.getElementById('iprn-add-country').value.trim(),
      prefix: document.getElementById('iprn-add-prefix').value.trim(),
      range_start: document.getElementById('iprn-add-rs').value.trim(),
      range_end: document.getElementById('iprn-add-re').value.trim(),
      supplier_id: document.getElementById('iprn-add-sup').value || null,
      access_type: document.getElementById('iprn-add-acc').value,
      type: document.getElementById('iprn-add-typ').value,
    };
    const r = await API.postIprnInventoryRange(body);
    if (r && r.error) {
      toast(String(r.error), 'error');
      return;
    }
    toast('Range added');
    renderIprnInventory(el);
  };

  document.getElementById('iprn-sup-btn').onclick = async () => {
    const body = {
      name: document.getElementById('iprn-sup-name').value.trim(),
      country: document.getElementById('iprn-sup-country').value.trim(),
      sip_host: document.getElementById('iprn-sup-host').value.trim(),
      protocol: document.getElementById('iprn-sup-prot').value,
      reliability_score: parseFloat(document.getElementById('iprn-sup-rel').value) || 0,
    };
    const r = await API.postIprnInventorySupplier(body);
    if (r && r.error) {
      toast(String(r.error), 'error');
      return;
    }
    toast('Supplier added');
    renderIprnInventory(el);
  };

  el.querySelectorAll('.iprn-inv-status').forEach((sel) => {
    sel.onchange = async () => {
      const id = sel.dataset.id;
      const r = await API.putIprnInventoryRangeStatus(id, sel.value);
      if (r && r.error) {
        toast(String(r.error), 'error');
        return;
      }
      toast('Status updated');
    };
  });
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
      <div class="card-header"><h3>SIP Listening (Trunk Config)</h3></div>
      <div class="card-body padded">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Supplier authentication is managed under <a href="#" onclick="event.preventDefault();navigateTo('suppliers')" style="color:var(--primary)">Termination Providers</a>. Save here, then use Apply & Reload Asterisk to activate.</p>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Inbound route is fixed as <code>from-supplier-ip → did-routing → ivr-*</code>. DIDs and destinations are managed in <a href="#" onclick="event.preventDefault();navigateTo('numbers')" style="color:var(--primary)">DID Inventory</a>.</p>
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
        <div class="form-row">
          <div class="form-group">
            <label>RTP Start Port</label>
            <input class="form-control" type="number" id="trunk-rtp-start" value="${trunk.rtpStart || 10000}">
          </div>
          <div class="form-group">
            <label>RTP End Port</label>
            <input class="form-control" type="number" id="trunk-rtp-end" value="${trunk.rtpEnd || 20000}">
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
    const qfVal = parseInt(document.getElementById('trunk-qf').value, 10);
    await API.updateTrunkConfig({
      publicIp: document.getElementById('trunk-pip').value.trim(),
      userAgent: document.getElementById('trunk-ua').value.trim(),
      bindPort: parseInt(document.getElementById('trunk-port').value) || 5060,
      codecs: document.getElementById('trunk-codecs').value.split(',').map(s => s.trim()).filter(Boolean),
      // Allow 0 to disable qualify/keepalive noise.
      qualifyFrequency: Number.isNaN(qfVal) ? 60 : qfVal,
      rtpStart: parseInt(document.getElementById('trunk-rtp-start').value) || 10000,
      rtpEnd: parseInt(document.getElementById('trunk-rtp-end').value) || 20000
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

// ---- DID TEST ----
async function renderDidTest(el) {
  el.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Controlled DID Route Test</h3></div>
      <div class="card-body padded">
        <div class="form-row">
          <div class="form-group">
            <label>DID Number</label>
            <input class="form-control" id="did-test-number" placeholder="e.g. 306953281580 or +306953281580" style="font-family:monospace">
          </div>
          <div class="form-group">
            <label>Source IP (optional)</label>
            <input class="form-control" id="did-test-source-ip" placeholder="e.g. 52.28.165.40" style="font-family:monospace">
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
          <button class="btn btn-primary" id="btn-run-did-test">Run DID Test</button>
          <button class="btn btn-outline" id="btn-clear-did-test">Clear</button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Test Result</h3></div>
      <div class="card-body padded" id="did-test-result">
        <p class="empty-state">Enter a DID and run test.</p>
      </div>
    </div>`;

  document.getElementById('btn-run-did-test').onclick = async () => {
    const did = document.getElementById('did-test-number').value.trim();
    const sourceIp = document.getElementById('did-test-source-ip').value.trim();
    if (!did) {
      toast('DID is required', 'error');
      return;
    }
    const resultBox = document.getElementById('did-test-result');
    resultBox.innerHTML = '<p class="empty-state">Running test...</p>';
    try {
      const result = await API.testDidRoute(did, sourceIp);
      if (!result.ok) {
        resultBox.innerHTML = `<p class="empty-state" style="color:var(--danger)">Error: ${escHtml(result.error || 'Unknown error')}</p>`;
        return;
      }
      resultBox.innerHTML = `
        <table>
          <tbody>
            <tr><th>NORMALIZED DID</th><td style="font-family:monospace">${escHtml(result.normalizedDid || '-')}</td></tr>
            <tr><th>MATCH TYPE</th><td>${escHtml(String(result.matchType || '-').toUpperCase())}</td></tr>
            <tr><th>MATCHED NUMBER</th><td style="font-family:monospace">${escHtml(result.matchedNumber?.fullNumber || '-')}</td></tr>
            <tr><th>MATCHED PREFIX</th><td style="font-family:monospace">${escHtml(result.matchedNumber?.prefix || '-')}</td></tr>
            <tr><th>EXTENSION</th><td style="font-family:monospace">${escHtml(result.matchedNumber?.extension || '-')}</td></tr>
            <tr><th>ROUTED IVR</th><td>${escHtml(result.route?.ivrName || '-')} (ID: ${escHtml(result.route?.ivrId || '-')})</td></tr>
            <tr><th>FALLBACK USED</th><td>${result.route?.isFallback ? 'YES' : 'NO'}</td></tr>
            <tr><th>SUPPLIER (ROUTE)</th><td>${escHtml(result.supplier?.routeSupplier || '-')} ${result.supplier?.routeSupplierId ? `<span style="color:var(--text-muted);font-size:12px">(ID ${escHtml(String(result.supplier.routeSupplierId))})</span>` : ''}</td></tr>
            <tr><th>SUPPLIER (SOURCE IP)</th><td>${escHtml(result.supplier?.sourceSupplier || '-')} ${result.supplier?.sourceSupplierId ? `<span style="color:var(--text-muted);font-size:12px">(ID ${escHtml(String(result.supplier.sourceSupplierId))})</span>` : ''}</td></tr>
          </tbody>
        </table>`;
    } catch (err) {
      resultBox.innerHTML = `<p class="empty-state" style="color:var(--danger)">Test error: ${escHtml(err.message)}</p>`;
    }
  };

  document.getElementById('btn-clear-did-test').onclick = () => {
    document.getElementById('did-test-number').value = '';
    document.getElementById('did-test-source-ip').value = '';
    document.getElementById('did-test-result').innerHTML = '<p class="empty-state">Enter a DID and run test.</p>';
  };
}

// ---- CONFIG PREVIEW ----
async function renderConfig(el) {
  const config = await API.previewConfig();
  if (config && config.ok === false) {
    el.innerHTML = `<div class="card"><div class="card-body padded">
      <p style="color:var(--danger);margin-bottom:8px"><strong>Could not load config preview.</strong>${config.error ? ` ${escHtml(config.error)}` : ''}</p>
      <p class="empty-state" style="font-size:13px">Sign in to the operator panel and refresh. Preview requires a valid session cookie.</p>
      <button type="button" class="btn btn-outline btn-sm" onclick="navigateTo('config')">Retry</button>
    </div></div>`;
    return;
  }
  const ext = String(config.extensionsConf ?? '').trim();
  const pj = String(config.pjsipConf ?? '').trim();
  const acl = String(config.aclConf ?? '').trim();
  const rtp = String(config.rtpConf ?? '').trim();
  const odbc = String(config.funcOdbcConf ?? '').trim();
  if (!ext && !pj) {
    el.innerHTML = `<div class="card"><div class="card-body padded"><p class="empty-state">No config text returned. If Asterisk configs are missing under <code>/etc/asterisk/</code>, click Apply after fixing DB/schema issues.</p></div></div>`;
    return;
  }
  const srcLive = config.source === 'live';
  const previewBanner = srcLive
    ? `<div class="card" style="margin-bottom:16px;border-color:var(--success);background:rgba(34,197,94,.08)">
        <div class="card-body padded" style="font-size:13px">
          <strong>Live Asterisk files</strong> — text below is read from <code>${escHtml(config.livePath || '/etc/asterisk')}</code> (what the PBX is using now).
        </div>
      </div>`
    : config.note
      ? `<div class="card" style="margin-bottom:16px;border-color:var(--warning);background:rgba(245,158,11,.08)">
          <div class="card-body padded" style="font-size:13px;color:var(--text-muted)">
            <strong>Generated preview</strong> — ${escHtml(config.note)}${(config.liveReadErrors && config.liveReadErrors.length) ? `<br><span style="font-size:11px">${escHtml(config.liveReadErrors.join('; '))}</span>` : ''}
          </div>
        </div>`
      : '';
  el.innerHTML = `${previewBanner}
    <div class="card">
      <div class="card-header"><h3>Deploy</h3></div>
      <div class="card-body padded" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div style="font-size:13px;color:var(--text-muted)">Apply generated configuration files and reload Asterisk service now.</div>
        <button class="btn btn-success" id="btn-apply-config-preview">Apply & Reload Asterisk</button>
      </div>
    </div>
    <div class="card">
      <div class="card-header"><h3>extensions.conf</h3></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(ext || '(empty)')}</div></div>
    </div>
    <div class="card">
      <div class="card-header"><h3>pjsip.conf</h3></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(pj || '(empty)')}</div></div>
    </div>
    ${acl ? `<div class="card">
      <div class="card-header"><h3>acl.conf</h3><span style="font-size:12px;color:var(--text-muted);font-weight:400">Supplier IP allow list (from Termination Providers)</span></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(acl)}</div></div>
    </div>` : ''}
    ${rtp ? `<div class="card">
      <div class="card-header"><h3>rtp.conf</h3></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(rtp)}</div></div>
    </div>` : ''}
    ${odbc ? `<div class="card">
      <div class="card-header"><h3>func_odbc.conf (DSN iprn_db)</h3></div>
      <div class="card-body padded"><div class="config-preview">${escHtml(odbc)}</div></div>
    </div>` : ''}`;

  document.getElementById('btn-apply-config-preview').onclick = async () => {
    const btn = document.getElementById('btn-apply-config-preview');
    btn.textContent = 'Applying & Reloading...';
    btn.disabled = true;
    try {
      const result = await API.apply();
      if (result.ok) {
        toast('Configuration applied and Asterisk reloaded');
        markSaved();
      } else {
        toast('Apply failed: ' + result.message, 'error');
      }
    } catch (err) {
      toast('Apply error: ' + err.message, 'error');
    } finally {
      btn.textContent = 'Apply & Reload Asterisk';
      btn.disabled = false;
    }
  };
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
  document.getElementById('btn-apply').textContent = 'Applying & Reloading...';
  try {
    const result = await API.apply();
    if (result.ok) {
      toast('Configuration applied and Asterisk reloaded');
      markSaved();
    } else {
      toast('Apply failed: ' + result.message, 'error');
    }
  } catch (err) {
    toast('Apply error: ' + err.message, 'error');
  }
  document.getElementById('btn-apply').textContent = 'Apply & Reload Asterisk';
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

// Optional: show “Legacy IPRN UI” when IPRN_PLATFORM_URL is set (separate app; primary control is this console).
(async () => {
  try {
    const cfg = await API.getAppConfig();
    const url = cfg && typeof cfg.iprnPlatformUrl === 'string' ? cfg.iprnPlatformUrl.trim() : '';
    const el = document.getElementById('nav-iprn-platform');
    if (!el || !url) return;
    el.style.display = '';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      window.open(url, '_blank', 'noopener,noreferrer');
      closeMobileMenu();
    });
  } catch {
    /* ignore */
  }
})();

// Init (panel vs tenant portal)
(async () => {
  try {
    const me = await API.getAuthMe();
    if (!me || !me.authenticated) {
      window.location.href = '/login';
      return;
    }
    const navPanel = document.getElementById('nav-panel');
    const navTenant = document.getElementById('nav-tenant');
    const applyBanner = document.getElementById('apply-banner');
    if (me.portal === 'tenant') {
      if (navPanel) navPanel.style.display = 'none';
      if (navTenant) navTenant.style.display = '';
      if (applyBanner) applyBanner.style.display = 'none';
      const brand = document.querySelector('.sidebar-brand span');
      if (brand) brand.textContent = 'Gulf Premium Telecom — client portal';
      if (me.role === 'user' || me.role === 'admin') {
        document.querySelectorAll('.tenant-client-only').forEach((n) => { n.style.display = ''; });
      }
      navigateTo('tenant-dashboard');
    } else {
      if (navTenant) navTenant.style.display = 'none';
      if (me.tenantPortalEnabled) {
        const ic = document.getElementById('nav-iprn-clients');
        if (ic) ic.style.display = '';
        const inv = document.getElementById('nav-iprn-inventory');
        if (inv) inv.style.display = '';
      }
      navigateTo('dashboard');
    }
    try {
      const raw = sessionStorage.getItem('dashAfterLogin');
      if (raw) {
        sessionStorage.removeItem('dashAfterLogin');
        const info = JSON.parse(raw);
        if (info && info.ok) toast('Asterisk configs deployed on login (AUTO_APPLY_ASTERISK_ON_LOGIN).', 'success');
        else toast(`Login auto-deploy failed: ${escHtml((info && info.message) || 'unknown')}`, 'error');
      }
    } catch {
      /* ignore */
    }
  } catch (err) {
    const el = document.getElementById('content');
    if (el) {
      el.innerHTML = `<p class="empty-state" style="color:var(--danger)">Dashboard failed to start: ${escHtml(err.message)}. Check browser console (F12).</p>`;
    }
  }
})();
