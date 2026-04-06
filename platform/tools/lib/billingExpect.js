/**
 * Mirrors platform/api/src/lib/billingEngine.js for offline test expectations.
 */
export function computeBilledSeconds(rawSeconds, opts) {
  const min = Math.max(0, Number(opts.minimum_bill_seconds) || 0);
  const inc = Math.max(1, Number(opts.increment_seconds) || 1);
  let s = Math.max(0, Math.floor(Number(rawSeconds) || 0));
  if (s > 0 && s < min) s = min;
  if (s > 0 && inc > 1) {
    const rem = s % inc;
    if (rem !== 0) s += inc - rem;
  }
  return s;
}

export function amountFromBilledRate(billedSeconds, ratePerMin) {
  const r = Number(ratePerMin) || 0;
  const b = Math.max(0, Math.floor(Number(billedSeconds) || 0));
  return (b / 60) * r;
}

export function near(a, b, eps = 1e-4) {
  return Math.abs(Number(a) - Number(b)) <= eps;
}
