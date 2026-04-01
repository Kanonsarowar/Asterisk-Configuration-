/**
 * Numbers source: MySQL `numbers` table when MySQL is enabled and initialized, else JSON store.
 * API shape unchanged for the UI.
 */
import { isMysqlNumbersReady, getMysqlPool } from './mysql.js';
import {
  mysqlListNumbers,
  mysqlGetById,
  mysqlUpsertDashboardNumber,
  mysqlDeleteById,
  mysqlDeleteByPrefix,
  mysqlBulkUpsert,
  fullNumberDigits,
} from './numbers-mysql.js';
import { normalizeNumberRecord } from './store.js';
import {
  parseClientName,
  isAllocatedRecord,
  stripAllocationFieldsFromUpdates,
  ALLOCATED_STATUS,
  POOL_STATUS,
} from './numbers-allocation.js';

export function useMysqlNumbers() {
  return isMysqlNumbersReady();
}

export async function getNumbers(store) {
  if (useMysqlNumbers()) return mysqlListNumbers();
  return store.getNumbers();
}

export async function getNumber(store, id) {
  if (useMysqlNumbers()) return mysqlGetById(id);
  return store.getNumber(id);
}

export async function addNumber(store, body) {
  const { id: _ignore, ...rest } = body || {};
  const n = normalizeNumberRecord(stripAllocationFieldsFromUpdates(rest));
  if (useMysqlNumbers()) {
    return mysqlUpsertDashboardNumber(n);
  }
  return store.addNumber(n);
}

export async function updateNumber(store, id, updates) {
  const safeUpdates = stripAllocationFieldsFromUpdates(updates || {});
  if (useMysqlNumbers()) {
    const ex = await mysqlGetById(id);
    if (!ex) return null;
    const merged = normalizeNumberRecord({ ...ex, ...safeUpdates, id: ex.id });
    const oldFull = fullNumberDigits(ex);
    const newFull = fullNumberDigits(merged);
    if (oldFull !== newFull) {
      const p = getMysqlPool();
      if (p) await p.execute('DELETE FROM `numbers` WHERE `id` = ?', [parseInt(id, 10)]);
      const { id: _i, ...withoutId } = merged;
      return mysqlUpsertDashboardNumber(withoutId);
    }
    return mysqlUpsertDashboardNumber(merged);
  }
  return store.updateNumber(id, safeUpdates);
}

export async function assignNumber(store, id, body) {
  const parsed = parseClientName(body?.clientName);
  if (!parsed.ok) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: parsed.error };
  }
  if (useMysqlNumbers()) {
    const ex = await mysqlGetById(id);
    if (!ex) return { ok: false, status: 404, code: 'NOT_FOUND', error: 'Number not found' };
    if (isAllocatedRecord(ex)) {
      return { ok: false, status: 409, code: 'ALREADY_ALLOCATED', error: 'This DID is already allocated' };
    }
    const merged = normalizeNumberRecord({
      ...ex,
      status: ALLOCATED_STATUS,
      clientName: parsed.value,
      allocationDate: new Date().toISOString(),
    });
    const number = await mysqlUpsertDashboardNumber(merged);
    return { ok: true, number };
  }
  return store.assignNumber(id, parsed.value);
}

export async function releaseNumber(store, id) {
  if (useMysqlNumbers()) {
    const ex = await mysqlGetById(id);
    if (!ex) return { ok: false, status: 404, code: 'NOT_FOUND', error: 'Number not found' };
    if (!isAllocatedRecord(ex)) {
      return { ok: false, status: 400, code: 'NOT_ALLOCATED', error: 'Number is not allocated' };
    }
    const merged = normalizeNumberRecord({
      ...ex,
      status: POOL_STATUS,
      clientName: null,
      allocationDate: null,
    });
    const number = await mysqlUpsertDashboardNumber(merged);
    return { ok: true, number };
  }
  return store.releaseNumber(id);
}

export async function deleteNumber(store, id) {
  if (useMysqlNumbers()) return mysqlDeleteById(id);
  return store.deleteNumber(id);
}

export async function deleteNumbersByPrefix(store, country, countryCode, prefix) {
  if (useMysqlNumbers()) return mysqlDeleteByPrefix(country, countryCode, prefix);
  return store.deleteNumbersByPrefix(country, countryCode, prefix);
}

export async function addBulkNumbers(store, nums) {
  const normalized = nums.map((x) => normalizeNumberRecord(stripAllocationFieldsFromUpdates({ ...x })));
  if (useMysqlNumbers()) return mysqlBulkUpsert(normalized);
  return store.addBulkNumbers(normalized);
}

/** For test-route / dedup checks (same logic as DB unique key). */
export function numberKey(n) {
  return fullNumberDigits(n);
}
