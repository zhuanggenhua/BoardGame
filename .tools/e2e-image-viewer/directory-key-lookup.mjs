import { createHash } from 'node:crypto';
import { readdir, realpath } from 'node:fs/promises';
import path from 'node:path';

const MAX_KEY_LOOKUP_DIRECTORIES = 20000;
const pendingLookups = new Map();

/** 登记与旧链接恢复共用相同的真实目录身份。 */
export const directoryIdFromRealPath = realPath => createHash('sha1').update(realPath.toLowerCase()).digest('hex').slice(0, 12);

const searchDirectory = async (key, roots) => {
  const matches = [];
  let scanned = 0;
  const walk = async currentDir => {
    if (matches.length > 1 || scanned >= MAX_KEY_LOOKUP_DIRECTORIES) return;
    let entries;
    try { entries = await readdir(currentDir, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (matches.length > 1 || scanned >= MAX_KEY_LOOKUP_DIRECTORIES) return;
      if (!entry.isDirectory()) continue;
      const candidate = path.join(currentDir, entry.name);
      scanned++;
      let real;
      try { real = await realpath(candidate); }
      catch { continue; }
      if (directoryIdFromRealPath(real) === key) { matches.push(real); continue; }
      await walk(candidate);
    }
  };
  for (const root of roots) await walk(root);
  if (matches.length > 1) throw new Error(`目录 key 不唯一: ${key}`);
  if (matches.length === 0) throw new Error(`找不到目录 key: ${key}`);
  return matches[0];
};

/** 旧链接恢复可扫描磁盘，但不能占住提供图片的事件循环；同一次查找复用在途结果。 */
export const recoverDirectoryByKey = (key, roots) => {
  const identity = JSON.stringify([key, roots]);
  if (pendingLookups.has(identity)) return pendingLookups.get(identity);
  const lookup = searchDirectory(key, roots).finally(() => pendingLookups.delete(identity));
  pendingLookups.set(identity, lookup);
  return lookup;
};
