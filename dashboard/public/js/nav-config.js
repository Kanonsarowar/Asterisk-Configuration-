/**
 * Panel sidebar — grouped navigation (data-page values must match renderPage switch).
 */
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
    items: [
      { page: 'numbers', label: 'Number Inventory', icon: 'inbox' },
      { page: 'iprn-inventory', label: 'IPRN Ranges', icon: 'book', navId: 'nav-iprn-inventory', hiddenUntilMysql: true },
      { page: 'routing-rules', label: 'Routing Rules', icon: 'layers' },
      { page: 'suppliers', label: 'Suppliers', icon: 'map-pin' },
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
  inbox: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  layers:
    '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'map-pin': '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
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

/**
 * Builds grouped sidebar HTML for #nav-panel.
 */
export function buildPanelNavHtml() {
  const parts = [];
  for (const g of PANEL_NAV_GROUPS) {
    const open = g.defaultOpen !== false;
    parts.push(`<div class="nav-group" data-group-id="${escapeAttr(g.id)}">`);
    parts.push(
      `<button type="button" class="nav-group-header" aria-expanded="${open ? 'true' : 'false'}" data-nav-toggle="${escapeAttr(g.id)}">`
    );
    parts.push(`<span class="nav-group-title">${escapeAttr(g.title)}</span>`);
    parts.push(
      '<svg class="nav-group-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'
    );
    parts.push('</button>');
    parts.push(`<div class="nav-group-body" style="${open ? '' : 'display:none'}">`);

    for (const item of g.items) {
      if (item.special === 'legacy-iprn') {
        const id = item.navId || 'nav-iprn-platform';
        parts.push(
          `<button type="button" class="nav-item nav-item--special" id="${escapeAttr(id)}" style="display:none" title="Optional: separate legacy IPRN web app (new tab).">`
        );
        parts.push(navIconSvg(item.icon || 'monitor'));
        parts.push(`<span>${escapeAttr(item.label)}</span></button>`);
        continue;
      }
      if (item.placeholder) {
        parts.push('<button type="button" class="nav-item nav-item--placeholder" disabled title="Coming soon">');
        parts.push(navIconSvg(item.icon || 'grid'));
        parts.push(`<span>${escapeAttr(item.label)}</span>`);
        parts.push('<span class="nav-item-badge">Soon</span></button>');
        continue;
      }
      const page = item.page;
      const idAttr = item.navId ? ` id="${escapeAttr(item.navId)}"` : '';
      const hidden = item.hiddenUntilMysql ? ' style="display:none"' : '';
      const title = item.hiddenUntilMysql ? ' title="Requires MySQL"' : '';
      parts.push(
        `<button type="button" class="nav-item" data-page="${escapeAttr(page)}"${idAttr}${hidden}${title}>`
      );
      parts.push(navIconSvg(item.icon || 'grid'));
      parts.push(`<span class="nav-item-label">${escapeAttr(item.label)}</span></button>`);
    }

    parts.push('</div></div>');
  }
  return parts.join('');
}
