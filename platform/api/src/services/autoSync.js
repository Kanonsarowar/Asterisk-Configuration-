import { generateAsteriskConfigs, reloadAsterisk } from './configGenerator.js';

let pending = null;

export function scheduleAsteriskSync() {
  if (process.env.AUTO_SYNC_ASTERISK !== '1') return;
  if (pending) return;
  pending = setTimeout(async () => {
    pending = null;
    try {
      await generateAsteriskConfigs();
      await reloadAsterisk();
    } catch (e) {
      console.error('[autoSync]', e.message);
    }
  }, 1500);
}
