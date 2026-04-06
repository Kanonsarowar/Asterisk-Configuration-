/** Sanitize values for PJSIP ini-style config (no newlines). */
export function pjsipValue(s) {
  return String(s ?? '')
    .replace(/\r?\n/g, ' ')
    .trim();
}
