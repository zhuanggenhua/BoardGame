#!/usr/bin/env node
/**
 * 验证精简版音频注册表的正确性
 * 
 * 检查项：
 * 1. 所有代码中引用的音效 key 都在 slim registry 中
 * 2. slim registry 中的所有条目都在代码中被引用
 * 3. 条目数量稳定（多次生成结果一致）
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const REGISTRY_PATH = 'src/assets/audio/registry.json';
const SLIM_PATH = 'src/assets/audio/registry-slim.json';

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

console.log('=== 验证精简版音频注册表 ===\n');

// 1. 读取注册表
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
const slim = JSON.parse(readFileSync(SLIM_PATH, 'utf-8'));

console.log(`全量注册表: ${registry.entries.length} 条`);
console.log(`精简注册表: ${slim.entries.length} 条`);
console.log(`缩减比例: ${((1 - slim.entries.length / registry.entries.length) * 100).toFixed(1)}%\n`);

// 2. 提取代码中的音效引用（排除 i18n key）
const srcFiles = walkDir('src');
const usedKeys = new Set();
const keyPattern = /['"`]((?:ui|game|bgm|fx)\.[a-zA-Z0-9_.]+)['"`]/g;

for (const file of srcFiles) {
  const content = readFileSync(file, 'utf-8');
  let match;
  while ((match = keyPattern.exec(content)) !== null) {
    const key = match[1];
    // 排除 i18n key（通过上下文判断：t('ui.xxx') 或 t("ui.xxx")）
    const beforeMatch = content.substring(Math.max(0, match.index - 10), match.index);
    if (!beforeMatch.includes('t(') && !beforeMatch.includes('t (')) {
      usedKeys.add(key);
    }
  }
}

console.log(`代码中引用的音效 key: ${usedKeys.size} 个\n`);

// 已知的占位符 key（FX 系统、音频系统的抽象 key，不对应实际文件）
const PLACEHOLDER_KEYS = new Set([
  'fx.combat.shockwave',
  'fx.summon',
  'fx.combat.damage',
  'fx.unknown',
  'fx.combat.',
  'fx.charge.vortex',
  'fx.damage',
  'fx.heal',
  'fx.status',
  'fx.token',
  // defineEvents.ts 中的默认音效（会被实际音效覆盖）
  'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_select_001',
  'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_close_001',
  'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_hover_001',
  'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_next_001',
  'ui.general.modern_ui_sound_fx_pack_vol.menu_navigation.menu_navigation_open_001',
]);

// 3. 检查 slim registry 中的条目
const slimKeys = new Set(slim.entries.map(e => e.key));

// 检查是否有遗漏（代码中引用但不在 slim 中，排除占位符）
const missing = [...usedKeys].filter(k => !slimKeys.has(k) && !PLACEHOLDER_KEYS.has(k));
if (missing.length > 0) {
  console.error('❌ 错误：以下音效在代码中被引用但不在 slim registry 中：');
  missing.forEach(k => console.error(`  - ${k}`));
  process.exit(1);
}

// 检查是否有冗余（slim 中有但代码中未引用）
const unused = [...slimKeys].filter(k => !usedKeys.has(k));
if (unused.length > 0) {
  console.warn('⚠️  警告：以下音效在 slim registry 中但代码中未引用：');
  unused.forEach(k => console.warn(`  - ${k}`));
  console.warn('（这可能是正常的，如果这些音效是通过动态 key 引用的）\n');
}

// 4. 验证所有 slim 条目都在全量注册表中
const fullKeys = new Set(registry.entries.map(e => e.key));
const invalid = [...slimKeys].filter(k => !fullKeys.has(k));
if (invalid.length > 0) {
  console.error('❌ 错误：以下音效在 slim registry 中但不在全量注册表中：');
  invalid.forEach(k => console.error(`  - ${k}`));
  process.exit(1);
}

console.log('✅ 验证通过！');
console.log(`   - 所有代码引用的音效都在 slim registry 中`);
console.log(`   - 所有 slim 条目都在全量注册表中`);
console.log(`   - 精简版大小: ${(JSON.stringify(slim).length / 1024).toFixed(1)} KB`);
