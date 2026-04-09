/**
 * Parse Gulf Telecom allocation TSV (Country, Range, Rate_USD) or pypdf blob.
 * - Trailing `x` = one wildcard digit → **10 DIDs** (0–9), e.g. `35376405881x` → …880 …889.
 * - Ranges: "A to B" (full E.164 digits, inclusive).
 * - Splits full number into countryCode + prefix + extension (last 4 national digits = extension).
 */

/** Longest-match first (E.164 without +). */
export const ITU_PREFIXES_SORTED = [
  '977', '420', '385', '386', '381', '358', '353', '351', '359', '372', '855', '856',
  '93', '84', '66', '63', '62', '49', '48', '47', '46', '45', '43', '41', '40', '39', '36', '34', '33', '32', '31', '30',
];

const COUNTRY_TO_ISO = {
  ireland: 'IE',
  france: 'FR',
  germany: 'DE',
  italy: 'IT',
  spain: 'ES',
  portgual: 'PT',
  portugal: 'PT',
  netherlands: 'NL',
  belgium: 'BE',
  switzerland: 'CH',
  austria: 'AT',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  poland: 'PL',
  'czech republic': 'CZ',
  'czech': 'CZ',
  hungary: 'HU',
  romania: 'RO',
  bulgaria: 'BG',
  greece: 'GR',
  croatia: 'HR',
  slovenia: 'SI',
  serbia: 'RS',
  estonia: 'EE',
  afghanistan: 'AF',
  philippines: 'PH',
  indonesia: 'ID',
  thailand: 'TH',
  vietnam: 'VN',
  cambodia: 'KH',
  laos: 'LA',
  nepal: 'NP',
};

/** Country labels in AllocationsGulfTelecom.pdf (longer names first for regex). */
const GULF_ALLOCATION_COUNTRY_NAMES = [
  'Czech republic',
  'Netherlands',
  'Switzerland',
  'Afghanistan',
  'Philippines',
  'Indonesia',
  'Thailand',
  'Vietnam',
  'Cambodia',
  'Estonia',
  'Portgual',
  'Belgium',
  'Bulgaria',
  'Romania',
  'Hungary',
  'Finland',
  'Denmark',
  'Norway',
  'Sweden',
  'Poland',
  'France',
  'Greece',
  'Italy',
  'Spain',
  'Laos',
  'Nepal',
  'Ireland',
  'Germany',
  'Austria',
  'Serbia',
  'Croatia',
  'Slovenia',
];

function uniqueCountryPattern() {
  const seen = new Set();
  const list = [];
  for (const c of GULF_ALLOCATION_COUNTRY_NAMES) {
    const k = c.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    list.push(c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'));
  }
  return list.join('|');
}

/**
 * Turn pypdf one-line-per-page blob into logical lines "Country\\tRange\\tRate".
 */
export function normalizeAllocationsPdfText(raw) {
  const t = String(raw || '')
    .replace(/\r/g, '')
    .replace(/^\s*Country\s+Range\s+Rate[^\n]*/i, '');
  const countryPat = uniqueCountryPattern();
  const rangePart = '([0-9x]+(?:\\s+to\\s+[0-9x]+)?)';
  const re = new RegExp(`(${countryPat})\\s+${rangePart}\\s+(\\d+\\.\\d+)`, 'gi');
  const rows = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const country = m[1].replace(/\s+/g, ' ').trim();
    const range = m[2].replace(/\s+/g, ' ').trim();
    const rate = m[3].trim();
    rows.push(`${country}\t${range}\t${rate}`);
  }
  return rows.join('\n');
}

export function countryLabelToIso(name) {
  const k = String(name || '').trim().toLowerCase();
  return COUNTRY_TO_ISO[k] || 'XX';
}

export function detectCountryCode(fullDigits) {
  const d = String(fullDigits).replace(/\D/g, '');
  for (const p of ITU_PREFIXES_SORTED) {
    if (d.startsWith(p)) return p;
  }
  return '';
}

/**
 * National part after CC → prefix + extension (last 4 digits = extension).
 */
export function splitNational(cc, fullDigits) {
  const d = String(fullDigits).replace(/\D/g, '');
  if (!cc || !d.startsWith(cc)) return { countryCode: cc, prefix: '', extension: '' };
  const national = d.slice(cc.length);
  if (national.length <= 4) {
    return { countryCode: cc, prefix: '', extension: national };
  }
  return {
    countryCode: cc,
    prefix: national.slice(0, -4),
    extension: national.slice(-4),
  };
}

/**
 * @returns {Array<{ country: string, countryIso: string, rate: string, fullNumber: string, countryCode: string, prefix: string, extension: string }>}
 */
export function parseAllocationsText(raw) {
  const normalized = normalizeAllocationsPdfText(raw);
  const text = normalized.trim().length >= 10 ? normalized : String(raw || '');
  const lines = text.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    if (/^--\s*\d+\s+of\s+\d+\s*--$/.test(t)) continue;
    if (/^country\s+range\s+rate/i.test(t)) continue;

    let parts = t.includes('\t')
      ? t.split(/\t/).map((x) => x.trim())
      : t.split(/\s{2,}/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 3) continue;
    if (/^country$/i.test(parts[0]) && /^range$/i.test(parts[1])) continue;
    if (/^rate\s+in\s+usd$/i.test(parts[2] || '')) continue;
    const countryName = parts[0];
    const rangeField = parts[1];
    const rateStr = parts[parts.length - 1];
    const rate = String(parseFloat(rateStr) || 0);

    const iso = countryLabelToIso(countryName);

    if (/\s+to\s+/i.test(rangeField)) {
      const [a, b] = rangeField.split(/\s+to\s+/i).map((x) => x.trim().replace(/\D/g, ''));
      let start = a;
      let end = b;
      // Ireland PDF typo: 353234280004 → treat as 35323428004 (11-digit end)
      if (start.startsWith('35323428000') && end.length === 12 && end === '353234280004') {
        end = '35323428004';
      }
      const bi = BigInt(start);
      const bj = BigInt(end);
      if (bj < bi) continue;
      const max = 10000;
      let n = 0;
      for (let x = bi; x <= bj && n < max; x++, n++) {
        const full = String(x);
        const cc = detectCountryCode(full);
        const { countryCode, prefix, extension } = splitNational(cc, full);
        out.push({
          country: iso,
          countryIso: iso,
          rate,
          fullNumber: full,
          countryCode,
          prefix,
          extension,
        });
      }
      continue;
    }

    let pat = rangeField.replace(/\s+/g, '');
    const isX = /x$/i.test(pat);
    pat = pat.replace(/x$/i, '');
    const digits = pat.replace(/\D/g, '');
    if (isX) {
      for (let d = 0; d <= 9; d++) {
        const testFull = `${digits}${d}`;
        const cc = detectCountryCode(testFull);
        const { countryCode, prefix, extension } = splitNational(cc, testFull);
        out.push({
          country: iso,
          countryIso: iso,
          rate,
          fullNumber: testFull,
          countryCode,
          prefix,
          extension,
        });
      }
    } else {
      const testFull = digits;
      const cc = detectCountryCode(testFull);
      const { countryCode, prefix, extension } = splitNational(cc, testFull);
      out.push({
        country: iso,
        countryIso: iso,
        rate,
        fullNumber: testFull,
        countryCode,
        prefix,
        extension,
      });
    }
  }
  return out;
}
