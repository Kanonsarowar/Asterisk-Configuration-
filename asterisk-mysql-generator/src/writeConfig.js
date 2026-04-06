import { mkdir, writeFile, rename, rm } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';

export async function writeAtomic(filePath, body) {
  const dir = join(filePath, '..');
  await mkdir(dir, { recursive: true });
  const tmp = `${filePath}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(tmp, body, 'utf8');
  await rename(tmp, filePath);
}

/**
 * Write several text files under dir/, each atomically.
 * @param {string} dir
 * @param {Record<string, string>} files relativeName -> content
 */
export async function writeFragmentDir(dir, files) {
  await mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeAtomic(join(dir, name), content);
  }
}

/**
 * Remove .conf files in dir that are not in keepNames (cleanup stale fragments).
 */
export async function pruneFragmentDir(dir, keepNames) {
  const { readdir } = await import('fs/promises');
  let names;
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  const keep = new Set(keepNames);
  for (const n of names) {
    if (!n.endsWith('.conf')) continue;
    if (keep.has(n)) continue;
    await rm(join(dir, n), { force: true });
  }
}
