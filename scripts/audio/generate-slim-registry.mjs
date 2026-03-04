#!/usr/bin/env node
/**
 * 生成精简版音频注册表（slim registry）
 * 
 * 全量 registry.json (~3MB, 10000+ 条) 仅供 AudioBrowser 开发工具使用。
 * 运行时只需要代码中实际引用的音效条目（~300 条）。
 * 
 * 本脚本扫描 src/ 下所有 .ts/.tsx 文件，提取被引用的音效 key，
 * 生成 registry-slim.json（~80KB），供运行时使用。
 * 
 * 优化策略：
 * 1. 缓存机制：检查源码和 registry.json 的 mtime，未变更则跳过
 * 2. 正则优化：一次性提取所有音效 key，避免逐个匹配
 * 3. 流式读取：避免一次性加载所有文件到内存
 * 
 * 用法：node scripts/audio/generate-slim-registry.mjs [--force]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const REGISTRY_PATH = 'src/assets/audio/registry.json';
const OUTPUT_PATH = 'src/assets/audio/registry-slim.json';
const CACHE_PATH = 'node_modules/.cache/audio-slim-registry.json';

const forceRebuild = process.argv.includes('--force');

// 递归收集源码文件
function walkDir(dir, files = []) {
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (f === 'node_modules' || f === '.git' || f === 'dist' || f === '.tmp') continue;
    const stat = statSync(full);
    if (stat.isDirectory()) walkDir(full, files);
    else if (/\.(ts|tsx)$/.test(f)) files.push(full);
  }
  return files;
}

// 计算文件哈希（用于缓存验证）
function computeHash(files) {
  const hash = createHash('sha256');
  // 只计算文件路径和 mtime，避免读取所有文件内容
  for (const f of files) {
    const stat = statSync(f);
    hash.update(`${f}:${stat.mtimeMs}`);
  }
  return hash.digest('hex');
}

// 检查缓存是否有效
function isCacheValid(srcFiles, registryMtime) {
  if (forceRebuild || !existsSync(CACHE_PATH) || !existsSync(OUTPUT_PATH)) {
    return false;
  }
  
  try {
    const cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
    const currentHash = computeHash(srcFiles);
    const currentRegistryMtime = statSync(REGISTRY_PATH).mtimeMs;
    
    return cache.hash === currentHash && cache.registryMtime === currentRegistryMtime;
  } catch {
    return false;
  }
}

// 保存缓存
function saveCache(srcFiles, registryMtime) {
  const cache = {
    hash: computeHash(srcFiles),
    registryMtime,
    timestamp: Date.now(),
  };
  
  try {
    writeFileSync(CACHE_PATH, JSON.stringify(cache), 'utf-8');
  } catch (err) {
    // 缓存失败不影响主流程
    console.warn('缓存保存失败（不影响功能）:', err.message);
  }
}

const startTime = Date.now();

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
const registryMtime = statSync(REGISTRY_PATH).mtimeMs;
const srcFiles = walkDir('src');

// 检查缓存
if (isCacheValid(srcFiles, registryMtime)) {
  const elapsed = Date.now() - startTime;
  console.log(`✓ 缓存有效，跳过生成 (${elapsed}ms)`);
  console.log(`输出: ${OUTPUT_PATH}`);
  process.exit(0);
}

// 优化：一次性提取所有音效 key（使用 Set 去重）
const usedKeys = new Set();

// 模式 1: 字符串字面量中的音效 key（用于 AudioManager.play() 等）
const keyPattern1 = /['"`]((?:ui|game|bgm|fx)\.[a-zA-Z0-9_.]+)['"`]/g;

// 模式 2: i18n key（t('ui.xxx')）— 这些不是音效 key，需要排除
// 但我们需要保留真正的音效 key，所以只匹配 sound/audio 相关的上下文

for (const file of srcFiles) {
  const content = readFileSync(file, 'utf-8');
  
  // 提取字符串字面量中的音效 key
  let match;
  while ((match = keyPattern1.exec(content)) !== null) {
    const key = match[1];
    // 排除 i18n key（通过上下文判断：t('ui.xxx') 或 t("ui.xxx")）
    const beforeMatch = content.substring(Math.max(0, match.index - 10), match.index);
    if (!beforeMatch.includes('t(') && !beforeMatch.includes('t (')) {
      usedKeys.add(key);
    }
  }
}

// 过滤出被引用的条目
const usedEntries = registry.entries.filter(entry => usedKeys.has(entry.key));

// 生成精简版（不含时间戳，避免内容未变时产生无意义 diff）
const slim = {
  version: registry.version,
  source: 'generate-slim-registry.mjs',
  total: usedEntries.length,
  entries: usedEntries,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(slim), 'utf-8');

// 保存缓存
saveCache(srcFiles, registryMtime);

const elapsed = Date.now() - startTime;
const fullSize = (readFileSync(REGISTRY_PATH).length / 1024).toFixed(0);
const slimSize = (JSON.stringify(slim).length / 1024).toFixed(0);

console.log(`全量: ${registry.entries.length} 条, ${fullSize} KB`);
console.log(`精简: ${usedEntries.length} 条, ${slimSize} KB`);
console.log(`缩减: ${((1 - slimSize / fullSize) * 100).toFixed(1)}%`);
console.log(`耗时: ${elapsed}ms`);
console.log(`输出: ${OUTPUT_PATH}`);
