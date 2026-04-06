import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Reload PJSIP (if module exists) and dialplan. Uses sudo when ASTERISK_USE_SUDO=1.
 */
export async function reloadAsterisk() {
  const bin = process.env.ASTERISK_BIN || 'asterisk';
  const useSudo = process.env.ASTERISK_USE_SUDO === '1' || process.env.ASTERISK_USE_SUDO === 'true';
  const rx = async (asteriskArgs) => {
    if (useSudo) {
      await execFileAsync('sudo', [bin, ...asteriskArgs]);
    } else {
      await execFileAsync(bin, asteriskArgs);
    }
  };

  try {
    await rx(['-rx', 'module reload res_pjsip.so']);
  } catch {
    /* Built without PJSIP — ignore */
  }
  try {
    await rx(['-rx', 'pjsip reload']);
  } catch {
    /* Some builds use pjsip reload instead of module reload */
  }
  await rx(['-rx', 'dialplan reload']);
}
