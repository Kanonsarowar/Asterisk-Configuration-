import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Load `.env` from project root (next to `dist/`).
 * Any non-empty value in the file overwrites `process.env` — fixes systemd
 * `EnvironmentFile` leaving `MYSQL_PASSWORD` empty while the file has the real password.
 */
export function loadEnvFromFile(): void {
  const __d = dirname(fileURLToPath(import.meta.url));
  const envPath = join(__d, '..', '.env');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    if (v.length > 0) process.env[k] = v;
  }
}
