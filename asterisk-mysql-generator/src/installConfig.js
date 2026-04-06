import { cp, mkdir } from 'fs/promises';
import { join } from 'path';

/**
 * Copy generated tree into Asterisk config dir (e.g. /etc/asterisk).
 * Set ASTERISK_INSTALL_DIR=/etc/asterisk for production.
 */
export async function installToAsterisk(outputDir, installDir) {
  if (!installDir) return;
  await mkdir(installDir, { recursive: true });
  const names = ['pjsip.conf', 'extensions.conf', 'pjsip.d', 'extensions.d'];
  for (const n of names) {
    await cp(join(outputDir, n), join(installDir, n), { recursive: true, force: true });
  }
}
