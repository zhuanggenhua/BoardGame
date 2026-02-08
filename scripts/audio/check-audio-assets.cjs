#!/usr/bin/env node
/**
 * 检查游戏层音频资产/配置是否残留
 * - public/assets/<gameId>/audio
 * - src/games/<gameId>/audio.config.ts 中的 basePath/sounds/compressed
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const PUBLIC_ASSETS = path.join(PROJECT_ROOT, 'public', 'assets');
const COMMON_AUDIO_DIR = path.join(PUBLIC_ASSETS, 'common', 'audio');
const SRC_GAMES = path.join(PROJECT_ROOT, 'src', 'games');

const errors = [];

function walkDir(dir, onEntry) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      onEntry(fullPath, entry);
      walkDir(fullPath, onEntry);
    } else {
      onEntry(fullPath, entry);
    }
  }
}

function scanAudioAssetDirs() {
  if (!fs.existsSync(PUBLIC_ASSETS)) return;
  walkDir(PUBLIC_ASSETS, (fullPath, entry) => {
    if (!entry.isDirectory()) return;
    if (path.resolve(fullPath) === path.resolve(COMMON_AUDIO_DIR)) return;
    if (entry.name !== 'audio') return;
    if (fullPath.startsWith(COMMON_AUDIO_DIR)) return;
    errors.push(`发现游戏层音频目录: ${path.relative(PROJECT_ROOT, fullPath)}`);
  });
}

function scanAudioConfigFiles() {
  if (!fs.existsSync(SRC_GAMES)) return;
  walkDir(SRC_GAMES, (fullPath, entry) => {
    if (!entry.isFile()) return;
    if (!fullPath.endsWith('audio.config.ts')) return;
    const content = fs.readFileSync(fullPath, 'utf-8');
    const relative = path.relative(PROJECT_ROOT, fullPath);
    if (/\bbasePath\b/.test(content)) {
      errors.push(`音频配置禁止 basePath: ${relative}`);
    }
    if (/\bsounds\s*:/.test(content)) {
      errors.push(`音频配置禁止 sounds: ${relative}`);
    }
    if (/compressed\//.test(content)) {
      errors.push(`音频配置禁止写 compressed/: ${relative}`);
    }
  });
}

scanAudioAssetDirs();
scanAudioConfigFiles();

if (errors.length > 0) {
  console.error('❌ 音频资产/配置检查失败:\n');
  for (const err of errors) {
    console.error(`- ${err}`);
  }
  process.exit(1);
}

console.log('✅ 音频资产/配置检查通过');
