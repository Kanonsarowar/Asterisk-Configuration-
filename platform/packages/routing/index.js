import { query } from '../database/index.js';

export async function lookupDid(didNumber) {
  const digits = String(didNumber).replace(/\D/g, '');
  const { rows } = await query(
    `SELECT d.*, c.balance AS client_balance, c.billing_type AS client_billing,
            c.status AS client_status, p.name AS provider_name, p.host AS provider_host
     FROM did_inventory d
     LEFT JOIN clients c ON c.id = d.client_id
     LEFT JOIN providers p ON p.id = d.provider_id
     WHERE d.did_number = ? AND d.status = 'assigned'`,
    [digits]
  );
  return rows[0] || null;
}

export function longestPrefixMatch(destination, prefixes) {
  const digits = String(destination).replace(/\D/g, '');
  let best = null;
  for (const p of prefixes) {
    if (digits.startsWith(p.prefix)) {
      if (!best || p.prefix.length > best.prefix.length) best = p;
    }
  }
  return best;
}

export async function resolveRoute(destination) {
  const digits = String(destination).replace(/\D/g, '');
  const { rows } = await query(
    `SELECT r.*, p.name AS provider_name, p.host AS provider_host,
            p.quality_score, p.max_channels, p.max_cps, p.status AS provider_status
     FROM routes r
     JOIN providers p ON p.id = r.provider_id
     WHERE r.active = 1 AND p.status = 'active'
     ORDER BY LENGTH(r.prefix) DESC, r.priority ASC, p.quality_score DESC`
  );

  const matched = [];
  for (const r of rows) {
    if (digits.startsWith(r.prefix)) matched.push(r);
  }
  return matched;
}

export async function resolveRouteLCR(destination) {
  const candidates = await resolveRoute(destination);
  return candidates.sort((a, b) => Number(a.rate) - Number(b.rate));
}

export async function resolveRouteQuality(destination) {
  const candidates = await resolveRoute(destination);
  return candidates.sort((a, b) => Number(b.quality_score) - Number(a.quality_score));
}

export async function getSipEndpoint(endpointId) {
  const { rows } = await query(
    `SELECT sa.*, c.balance, c.billing_type, c.status AS client_status
     FROM sip_accounts sa
     LEFT JOIN clients c ON c.id = sa.client_id
     WHERE sa.id = ? AND sa.status = 'active'`,
    [endpointId]
  );
  return rows[0] || null;
}

export async function getIvrMenu(ivrId) {
  const { rows } = await query('SELECT * FROM ivr_menus WHERE id = ? AND status = ?', [ivrId, 'active']);
  if (!rows[0]) return null;
  const { rows: options } = await query(
    'SELECT * FROM ivr_options WHERE ivr_id = ? ORDER BY digit', [ivrId]
  );
  return { ...rows[0], options };
}
