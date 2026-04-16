import { query } from '../database/index.js';
import { getRoutingSettings } from './scoring.js';

// ── DID lookup (unchanged contract) ─────────────────────────────────

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

// ── Prefix matching (unchanged) ─────────────────────────────────────

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

// ── Core route resolution ───────────────────────────────────────────
//
// resolveRoute dispatches to smart scoring when mode='smart', otherwise
// falls back to legacy priority+quality ordering. Response shape is
// identical in both paths — callers see no contract change.

export async function resolveRoute(destination) {
  const settings = await getRoutingSettings();
  if (settings.mode === 'smart') {
    return resolveRouteSmart(destination, settings);
  }
  return resolveRouteLegacy(destination);
}

/**
 * Legacy: prefix match → priority ASC → quality_score DESC.
 * Excludes quarantined/disabled routes and non-active providers.
 */
async function resolveRouteLegacy(destination) {
  const digits = String(destination).replace(/\D/g, '');
  const { rows } = await query(
    `SELECT r.*, p.name AS provider_name, p.host AS provider_host,
            p.quality_score, p.max_channels, p.max_cps, p.status AS provider_status
     FROM routes r
     JOIN providers p ON p.id = r.supplier_id
     WHERE r.status = 'active' AND r.active = 1 AND p.status = 'active'
     ORDER BY LENGTH(r.prefix) DESC, r.priority ASC, p.quality_score DESC`
  );
  const matched = [];
  for (const r of rows) {
    if (digits.startsWith(r.prefix)) matched.push(r);
  }
  return matched;
}

/**
 * Smart: prefix match → LEFT JOIN route_scores → final_score DESC.
 *
 * Margin protection: skips routes whose actual margin < margin_min.
 * Falls back to LCR if no scored routes match this prefix.
 */
async function resolveRouteSmart(destination, settings) {
  const digits = String(destination).replace(/\D/g, '');

  const { rows } = await query(
    `SELECT r.*, p.name AS provider_name, p.host AS provider_host,
            p.quality_score, p.max_channels, p.max_cps, p.status AS provider_status,
            p.cost_per_minute AS buy_rate,
            COALESCE(rs.final_score, 0) AS smart_score,
            COALESCE(rs.asr, 0) AS score_asr,
            COALESCE(rs.acd, 0) AS score_acd,
            COALESCE(rs.margin, 0) AS score_margin,
            rs.computed_at AS score_computed_at
     FROM routes r
     JOIN providers p ON p.id = r.supplier_id
     LEFT JOIN route_scores rs ON rs.route_id = r.id
     WHERE r.status = 'active' AND r.active = 1
       AND p.status IN ('active', 'testing')
     ORDER BY LENGTH(r.prefix) DESC, COALESCE(rs.final_score, 0) DESC, r.priority ASC`
  );

  const matched = [];
  for (const r of rows) {
    if (!digits.startsWith(r.prefix)) continue;
    const actualMargin = Number(r.rate) - Number(r.buy_rate);
    if (Number(r.margin_min) > 0 && actualMargin < Number(r.margin_min)) continue;
    matched.push(r);
  }

  if (matched.length === 0 && settings.lcr_fallback) {
    return resolveRouteLCR(destination);
  }
  return matched;
}

// ── LCR fallback (unchanged contract) ───────────────────────────────

export async function resolveRouteLCR(destination) {
  const candidates = await resolveRouteLegacy(destination);
  return candidates.sort((a, b) => Number(a.rate) - Number(b.rate));
}

// ── Quality-based (unchanged contract) ──────────────────────────────

export async function resolveRouteQuality(destination) {
  const candidates = await resolveRouteLegacy(destination);
  return candidates.sort((a, b) => Number(b.quality_score) - Number(a.quality_score));
}

// ── SIP endpoint lookup (unchanged) ─────────────────────────────────

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

// ── IVR menu lookup (unchanged) ─────────────────────────────────────

export async function getIvrMenu(ivrId) {
  const { rows } = await query('SELECT * FROM ivr_menus WHERE id = ? AND status = ?', [ivrId, 'active']);
  if (!rows[0]) return null;
  const { rows: options } = await query(
    'SELECT * FROM ivr_options WHERE ivr_id = ? ORDER BY digit', [ivrId]
  );
  return { ...rows[0], options };
}
