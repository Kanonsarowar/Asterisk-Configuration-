import { query } from '../db.js';

const DEFAULT_BILLING = {
  minimum_bill_seconds: 30,
  increment_seconds: 6,
  routing_mode: 'priority',
  default_prefix_length: 5,
  max_cps_global: 50,
};

const DEFAULT_FRAUD = {
  enabled: true,
  max_calls_per_cli_per_hour: 120,
  suspicious_short_ratio_threshold: 0.85,
};

export async function getBillingSettings() {
  const r = await query('SELECT svalue FROM system_settings WHERE skey = ?', ['billing']);
  const row = r.rows[0];
  if (!row?.svalue) return { ...DEFAULT_BILLING };
  const v = typeof row.svalue === 'string' ? JSON.parse(row.svalue) : row.svalue;
  return { ...DEFAULT_BILLING, ...v };
}

export async function getFraudSettings() {
  const r = await query('SELECT svalue FROM system_settings WHERE skey = ?', ['fraud']);
  const row = r.rows[0];
  if (!row?.svalue) return { ...DEFAULT_FRAUD };
  const v = typeof row.svalue === 'string' ? JSON.parse(row.svalue) : row.svalue;
  return { ...DEFAULT_FRAUD, ...v };
}

export async function setBillingSettings(patch) {
  const cur = await getBillingSettings();
  const next = { ...cur, ...patch };
  await query(
    'INSERT INTO system_settings (skey, svalue) VALUES (?, CAST(? AS JSON)) ON DUPLICATE KEY UPDATE svalue = VALUES(svalue)',
    ['billing', JSON.stringify(next)]
  );
  return next;
}
