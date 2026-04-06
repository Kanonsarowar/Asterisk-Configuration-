import { join } from 'path';
import { query } from './db.js';
import { buildPjsipFragments } from './generators/pjsip.js';
import { groupRoutesByPrefix, buildExtensionsFragments } from './generators/extensions.js';
import { writeAtomic, writeFragmentDir, pruneFragmentDir } from './writeConfig.js';
import { reloadAsterisk } from './reloadAsterisk.js';
import { installToAsterisk } from './installConfig.js';

export function outputBaseDir() {
  return process.env.ASTERISK_OUTPUT_DIR || join(process.cwd(), 'output');
}

function rootIncludes(fragmentDirName, fragmentFiles) {
  const names = Object.keys(fragmentFiles).sort();
  const lines = names.map((n) => `#include "${fragmentDirName}/${n}"`);
  return lines.join('\n') + '\n';
}

/**
 * Load suppliers and routes from MySQL, write modular configs, optionally reload Asterisk.
 * @param {{ reload?: boolean }} options
 */
export async function generateAndApply(options = {}) {
  const reload = options.reload !== false && process.env.SKIP_ASTERISK_RELOAD !== '1';

  const supRes = await query(
    `SELECT id, name, host, port, username, password, protocol
     FROM suppliers WHERE active = 1 ORDER BY id`
  );

  const routeRes = await query(
    `SELECT r.prefix, r.priority, r.supplier_id
     FROM routes r
     INNER JOIN suppliers s ON s.id = r.supplier_id
     WHERE r.active = 1 AND s.active = 1
     ORDER BY r.prefix, r.priority ASC, r.supplier_id ASC`
  );

  const suppliers = supRes.rows;
  const { byPrefix, prefixes } = groupRoutesByPrefix(routeRes.rows);

  const pjsipParts = buildPjsipFragments(suppliers);
  const extParts = buildExtensionsFragments(byPrefix, prefixes);

  const base = outputBaseDir();
  const pjsipD = join(base, 'pjsip.d');
  const extD = join(base, 'extensions.d');

  await writeFragmentDir(pjsipD, pjsipParts);
  await writeFragmentDir(extD, extParts);
  await pruneFragmentDir(pjsipD, Object.keys(pjsipParts));
  await pruneFragmentDir(extD, Object.keys(extParts));

  const pjsipRoot =
    '; Auto-generated — do not edit; managed by asterisk-mysql-generator\n' +
    rootIncludes('pjsip.d', pjsipParts);
  const extRoot =
    '; Auto-generated — do not edit; managed by asterisk-mysql-generator\n' +
    rootIncludes('extensions.d', extParts);

  await writeAtomic(join(base, 'pjsip.conf'), pjsipRoot);
  await writeAtomic(join(base, 'extensions.conf'), extRoot);

  const installDir = process.env.ASTERISK_INSTALL_DIR;
  if (installDir) {
    await installToAsterisk(base, installDir);
  }

  if (reload) {
    await reloadAsterisk();
  }

  return {
    outputDir: base,
    supplierCount: suppliers.length,
    prefixCount: prefixes.length,
  };
}
