/**
 * Panel sidebar — grouped navigation (data-page values must match renderPage switch).
 * Routing section: carrier-style control plane (inventory, policy, providers, roadmap).
 */

/** @typedef {{ page?: string, label: string, icon?: string, navId?: string, hiddenUntilMysql?: boolean, placeholder?: boolean, special?: string }} NavItem */

/** @typedef {{ id: string, subtitle: string, collapsed?: boolean, items: NavItem[] }} NavSubgroup */

/** @typedef {{ id: string, title: string, defaultOpen?: boolean, items?: NavItem[], subgroups?: NavSubgroup[] }} NavGroup */

/** @type {NavGroup[]} */
export const PANEL_NAV_GROUPS = [
  {
    id: 'operations',
    title: 'Operations',
    defaultOpen: true,
    items: [
      { page: 'dashboard', label: 'Dashboard', icon: 'grid' },
      { page: 'live-calls', label: 'Live Calls', icon: 'activity' },
      { page: 'call-stats', label: 'Call Stats', icon: 'chart' },
      { page: 'cdr-history', label: 'CDR', icon: 'file' },
    ],
  },
  {
    id: 'routing',
    title: 'Routing',
    defaultOpen: true,
    subgroups: [
      {
        id: 'routing-inventory',
        subtitle: 'Inventory & numbering',
        defaultOpen: true,
        items: [
          { page: 'numbers', label: 'DID Inventory', icon: 'hash' },
          { page: 'prefix-staging', label: 'Prefix staging', icon: 'layers', navId: 'nav-prefix-staging', hiddenUntilMysql: true },
          { page: 'iprn-inventory', label: 'Prefix Routing Map', icon: 'map-route', navId: 'nav-iprn-inventory', hiddenUntilMysql: true },
        ],
      },
      {
        id: 'routing-policy',
        subtitle: 'Policy & engine',
        defaultOpen: true,
        items: [{ page: 'routing-rules', label: 'Traffic Policy Engine', icon: 'cpu' }],
      },
      {
        id: 'routing-providers',
        subtitle: 'Termination',
        defaultOpen: true,
        items: [{ page: 'suppliers', label: 'Termination Providers', icon: 'truck' }],
      },
      {
        id: 'routing-advanced',
        subtitle: 'Advanced routing (roadmap)',
        collapsed: true,
        items: [
          { page: 'routing-fraud', label: 'Fraud-aware routing', icon: 'shield', placeholder: true },
          { page: 'routing-lcr', label: 'Least-cost routing (LCR)', icon: 'percent', placeholder: true },
          { page: 'routing-geo', label: 'Geo-routing', icon: 'globe', placeholder: true },
          { page: 'routing-quality', label: 'Quality-based routing', icon: 'signal', placeholder: true },
        ],
      },
    ],
  },
  {
    id: 'voice',
    title: 'Voice System',
    defaultOpen: true,
    items: [
      { page: 'trunk', label: 'Trunks', icon: 'settings' },
      { page: 'ivr-menus', label: 'IVR Audio', icon: 'music' },
      { page: 'config', label: 'Config Preview', icon: 'code' },
    ],
  },
  {
    id: 'business',
    title: 'Business',
    defaultOpen: true,
    items: [
      { page: 'iprn-clients', label: 'Clients', icon: 'users', navId: 'nav-iprn-clients', hiddenUntilMysql: true },
      { page: 'billing', label: 'Billing', icon: 'credit', placeholder: true },
      { page: 'profit-reports', label: 'Profit Reports', icon: 'trending', placeholder: true },
      { special: 'legacy-iprn', label: 'Legacy IPRN UI', icon: 'monitor', navId: 'nav-iprn-platform', hidden: true },
    ],
  },
];

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'map-route':
    '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/>',
  truck: '<rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  signal: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20v-12"/><path d="M22 20V4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  credit: '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  trending: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  monitor: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/>',
};

export function navIconSvg(name) {
  const d = ICONS[name] || ICONS.grid;
  return `<svg class="nav-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${d}</svg>`;
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function appendNavItem(parts, item) {
  if (item.special === 'legacy-iprn') {
    const id = item.navId || 'nav-iprn-platform';
    parts.push(
      `<button type="button" class="nav-item nav-item--special" id="${escapeAttr(id)}" style="display:none" title="Optional: separate legacy IPRN web app (new tab).">`
    );
    parts.push(navIconSvg(item.icon || 'monitor'));
    parts.push(`<span class="nav-item-label">${escapeAttr(item.label)}</span></button>`);
    return;
  }
  if (item.placeholder) {
    parts.push('<button type="button" class="nav-item nav-item--placeholder" disabled title="Roadmap — control plane module">');
    parts.push(navIconSvg(item.icon || 'grid'));
    parts.push(`<span class="nav-item-label">${escapeAttr(item.label)}</span>`);
    parts.push('<span class="nav-item-badge">Soon</span></button>');
    return;
  }
  const page = item.page;
  const idAttr = item.navId ? ` id="${escapeAttr(item.navId)}"` : '';
  const hidden = item.hiddenUntilMysql ? ' style="display:none"' : '';
  const title = item.hiddenUntilMysql ? ' title="Requires MySQL"' : '';
  parts.push(`<button type="button" class="nav-item nav-item--routing" data-page="${escapeAttr(page)}"${idAttr}${hidden}${title}>`);
  parts.push(navIconSvg(item.icon || 'grid'));
  parts.push(`<span class="nav-item-label">${escapeAttr(item.label)}</span></button>`);
}

/**
 * Builds grouped sidebar HTML for #nav-panel.
 */
export function buildPanelNavHtml() {
  const parts = [];
  for (const g of PANEL_NAV_GROUPS) {
    const open = g.defaultOpen !== false;
    parts.push(
      `<div class="nav-group nav-group--${escapeAttr(g.id)}${g.id === 'routing' ? ' nav-group--routing-control' : ''}" data-group-id="${escapeAttr(g.id)}">`
    );
    parts.push(
      `<button type="button" class="nav-group-header" aria-expanded="${open ? 'true' : 'false'}" data-nav-toggle="${escapeAttr(g.id)}">`
    );
    parts.push(`<span class="nav-group-title">${escapeAttr(g.title)}</span>`);
    parts.push(
      '<svg class="nav-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
    );
    parts.push('</button>');
    parts.push(`<div class="nav-group-body" style="${open ? '' : 'display:none'}">`);

    if (g.subgroups && g.subgroups.length) {
      for (const sg of g.subgroups) {
        const collapsed = !!sg.collapsed;
        parts.push(
          `<div class="nav-subgroup${collapsed ? ' nav-subgroup--collapsed' : ''}" data-subgroup-id="${escapeAttr(sg.id)}">`
        );
        parts.push(
          `<button type="button" class="nav-subgroup-header" aria-expanded="${collapsed ? 'false' : 'true'}" data-subgroup-toggle="${escapeAttr(sg.id)}">`
        );
        parts.push(`<span class="nav-subgroup-title">${escapeAttr(sg.subtitle)}</span>`);
        parts.push(
          '<svg class="nav-subgroup-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
        );
        parts.push('</button>');
        parts.push(`<div class="nav-subgroup-items">`);
        for (const item of sg.items) {
          appendNavItem(parts, item);
        }
        parts.push('</div></div>');
      }
    } else if (g.items) {
      for (const item of g.items) {
        appendNavItem(parts, item);
      }
    }

    parts.push('</div></div>');
  }
  return parts.join('');
}
