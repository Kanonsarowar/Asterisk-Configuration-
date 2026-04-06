'use client';

import { useEffect, useRef } from 'react';

/**
 * @param {() => void | Promise<void>} fn
 * @param {number} intervalMs
 * @param {boolean} enabled
 */
export function usePolling(fn, intervalMs, enabled = true) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const tick = () => ref.current();
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
