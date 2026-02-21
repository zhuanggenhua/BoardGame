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
 * 用法：node scripts/audio/generate-slim-registry.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = 'src/assets/audio/registry.json';
const OUTPUT_PATH = 'src/assets/audio/registry-slim.json';

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

const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
const srcFiles = walkDir('src');
const allCode = srcFiles.map(f => readFileSync(f, 'utf-8')).join('\n');

// 找出代码中引用的 key
const usedEntries = registry.entries.filter(entry => allCode.includes(entry.key));

// 生成精简版（不含时间戳，避免内容未变时产生无意义 diff）
const slim = {
  version: registry.version,
  source: 'generate-slim-registry.mjs',
  total: usedEntries.length,
  entries: usedEntries,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(slim), 'utf-8');

const fullSize = (readFileSync(REGISTRY_PATH).length / 1024).toFixed(0);
const slimSize = (JSON.stringify(slim).length / 1024).toFixed(0);

console.log(`全量: ${registry.entries.length} 条, ${fullSize} KB`);
console.log(`精简: ${usedEntries.length} 条, ${slimSize} KB`);
console.log(`缩减: ${((1 - slimSize / fullSize) * 100).toFixed(1)}%`);
console.log(`输出: ${OUTPUT_PATH}`);
