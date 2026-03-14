#!/usr/bin/env node
/**
 * 生成精简版音频注册表（registry-slim.json）。
 *
 * 规则：
 * 1. 扫描 src 下 .ts/.tsx 中引用的音频 key。
 * 2. 从全量 registry.json 过滤出实际使用条目。
 * 3. 若源码与 registry.json 未变化，则直接命中缓存并跳过生成。
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'fs';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const REGISTRY_PATH = 'src/assets/audio/registry.json';
const OUTPUT_PATH = 'src/assets/audio/registry-slim.json';
const CACHE_PATH = 'node_modules/.cache/audio-slim-registry.json';

const forceRebuild = process.argv.includes('--force');

function walkDir(dir, files = []) {
  for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b))) {
    const fullPath = join(dir, name);
    if (name === 'node_modules' || name === '.git' || name === 'dist' || name === '.tmp') {
      continue;
    }

    const st = statSync(fullPath);
    if (st.isDirectory()) {
      walkDir(fullPath, files);
      continue;
    }

    if (/\.(ts|tsx)$/.test(name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function computeSourceHash(files) {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.localeCompare(b))) {
    const st = statSync(file);
    hash.update(`${file}:${Math.trunc(st.mtimeMs)}`);
  }
  return hash.digest('hex');
}

function getRegistryMtime() {
  return Math.trunc(statSync(REGISTRY_PATH).mtimeMs);
}

function loadCache() {
  if (!existsSync(CACHE_PATH)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveCache(cache) {
  try {
    mkdirSync(dirname(CACHE_PATH), { recursive: true });
    writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf-8');
  } catch (err) {
    console.warn('缓存写入失败（不影响主流程）:', err.message);
  }
}

const startTime = Date.now();
const srcFiles = walkDir('src');
const sourceHash = computeSourceHash(srcFiles);
const registryMtime = getRegistryMtime();
const cache = loadCache();

if (
  !forceRebuild &&
  existsSync(OUTPUT_PATH) &&
  cache &&
  cache.sourceHash === sourceHash &&
  cache.registryMtime === registryMtime
) {
  const elapsed = Date.now() - startTime;
  console.log(`缓存有效，跳过生成 (${elapsed}ms)`);
  console.log(`输出: ${OUTPUT_PATH}`);
  process.exit(0);
}

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
const usedKeys = new Set();
const keyPattern = /['"`]([a-zA-Z0-9_]+\.[a-zA-Z0-9_.]+)['"`]/g;

for (const file of srcFiles) {
  const content = readFileSync(file, 'utf-8');
  let match;
  while ((match = keyPattern.exec(content)) !== null) {
    const key = match[1];
    const beforeMatch = content.substring(Math.max(0, match.index - 10), match.index);
    if (!beforeMatch.includes('t(') && !beforeMatch.includes('t (')) {
      usedKeys.add(key);
    }
  }
}

const usedEntries = registry.entries.filter((entry) => usedKeys.has(entry.key));
const slim = {
  version: registry.version,
  source: 'generate-slim-registry.mjs',
  total: usedEntries.length,
  entries: usedEntries,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(slim), 'utf-8');
saveCache({ sourceHash, registryMtime, timestamp: Date.now() });

const elapsed = Date.now() - startTime;
const fullSize = (readFileSync(REGISTRY_PATH).length / 1024).toFixed(0);
const slimSize = (JSON.stringify(slim).length / 1024).toFixed(0);

console.log(`全量: ${registry.entries.length} 条, ${fullSize} KB`);
console.log(`精简: ${usedEntries.length} 条, ${slimSize} KB`);
console.log(`缩减: ${((1 - slimSize / fullSize) * 100).toFixed(1)}%`);
console.log(`耗时: ${elapsed}ms`);
console.log(`输出: ${OUTPUT_PATH}`);
