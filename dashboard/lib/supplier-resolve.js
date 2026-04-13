/**
 * Resolve supplier display names and source-IP → supplier for stats + test-route.
 */

/** Strip IPv6-mapped IPv4 (::ffff:x.x.x.x) and trim. */
export function normalizeSourceIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return '';
  const m = s.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (m) return m[1];
  return s;
}

export function findSupplierBySourceIp(suppliers, sourceIp) {
  const want = normalizeSourceIp(sourceIp);
  if (!want) return null;
  for (const s of suppliers || []) {
    const ips = Array.isArray(s.ips) ? s.ips : [];
    for (const ip of ips) {
      if (normalizeSourceIp(ip) === want) return s;
    }
  }
  return null;
}

/** Match DID supplier_id to store supplier (string or numeric id). */
export function findSupplierById(suppliers, idRaw) {
  if (idRaw === undefined || idRaw === null || String(idRaw).trim() === '') return null;
  const sid = String(idRaw).trim();
  for (const s of suppliers || []) {
    if (String(s.id) === sid) return s;
  }
  const n = Number(sid);
  if (!Number.isNaN(n)) {
    for (const s of suppliers || []) {
      if (Number(s.id) === n) return s;
    }
  }
  return null;
}

export function supplierDisplayName(suppliers, idRaw) {
  const s = findSupplierById(suppliers, idRaw);
  if (s) return String(s.name || '').trim() || `ID ${s.id}`;
  if (idRaw === undefined || idRaw === null || String(idRaw).trim() === '') return '—';
  return `ID ${String(idRaw).trim()}`;
}
