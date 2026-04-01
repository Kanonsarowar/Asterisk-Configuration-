/** DID allocation: status `allocated` vs pool `active`. */

export const ALLOCATED_STATUS = 'allocated';
export const POOL_STATUS = 'active';

const ALLOCATION_UPDATE_KEYS = new Set([
  'status',
  'clientName',
  'client_name',
  'allocationDate',
  'allocation_date',
]);

export function normalizeAllocationStatus(s) {
  const t = String(s ?? POOL_STATUS).trim().toLowerCase();
  return t === ALLOCATED_STATUS ? ALLOCATED_STATUS : POOL_STATUS;
}

export function isAllocatedRecord(n) {
  return normalizeAllocationStatus(n?.status) === ALLOCATED_STATUS;
}

/**
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function parseClientName(raw) {
  if (raw === undefined || raw === null) {
    return { ok: false, error: 'clientName is required' };
  }
  const value = String(raw).trim();
  if (!value) {
    return { ok: false, error: 'clientName cannot be empty' };
  }
  if (value.length > 255) {
    return { ok: false, error: 'clientName must be at most 255 characters' };
  }
  return { ok: true, value };
}

export function stripAllocationFieldsFromUpdates(updates) {
  if (!updates || typeof updates !== 'object') return {};
  const out = { ...updates };
  for (const k of ALLOCATION_UPDATE_KEYS) delete out[k];
  return out;
}
