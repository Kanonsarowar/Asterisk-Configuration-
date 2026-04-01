/** Validate JSON body for `call_logs` inserts (matches column sizes in mysql.js DDL). */

const MAX_CALLER_LEN = 64;
const MAX_DEST_LEN = 64;
const MAX_STATUS_LEN = 32;
const MAX_DURATION_SEC = 2147483647; // signed INT upper bound

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @returns {{ ok: true, value: { caller: string, destination: string, duration: number, status: string } } | { ok: false, status: number, code: string, error: string }}
 */
export function validateAndNormalizeCallLog(body) {
  if (!isPlainObject(body)) {
    return { ok: false, status: 400, code: 'INVALID_BODY', error: 'Request body must be a JSON object' };
  }

  const errors = [];

  function requireTrimmedString(val, field, maxLen) {
    if (val === undefined || val === null) {
      errors.push(`${field} is required`);
      return null;
    }
    const s = String(val).trim();
    if (!s.length) {
      errors.push(`${field} cannot be empty`);
      return null;
    }
    if (s.length > maxLen) {
      errors.push(`${field} must be at most ${maxLen} characters`);
      return null;
    }
    return s;
  }

  const caller = requireTrimmedString(body.caller, 'caller', MAX_CALLER_LEN);
  const destination = requireTrimmedString(body.destination, 'destination', MAX_DEST_LEN);
  const status = requireTrimmedString(body.status, 'status', MAX_STATUS_LEN);

  let duration = body.duration;
  if (duration === undefined || duration === null) {
    errors.push('duration is required');
    duration = null;
  } else {
    const n = typeof duration === 'number' ? duration : Number(String(duration).trim());
    if (!Number.isFinite(n)) {
      errors.push('duration must be a finite number');
      duration = null;
    } else if (!Number.isInteger(n)) {
      errors.push('duration must be a whole number of seconds');
      duration = null;
    } else if (n < 0 || n > MAX_DURATION_SEC) {
      errors.push(`duration must be between 0 and ${MAX_DURATION_SEC}`);
      duration = null;
    } else {
      duration = n;
    }
  }

  if (errors.length) {
    return { ok: false, status: 400, code: 'VALIDATION_ERROR', error: errors.join('; ') };
  }

  return {
    ok: true,
    value: { caller, destination, duration, status },
  };
}
