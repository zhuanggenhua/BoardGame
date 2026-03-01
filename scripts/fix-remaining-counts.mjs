#!/usr/bin/env node
/**
 * 修复剩余的卡牌数量错误
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 剩余需要修复的数量错误
const fixes = {
  tricksters: [
    { cardId: 'trickster_disenchant', oldCount: 1, newCount: 2 },
    { cardId: 'trickster_hideout', oldCount: 2, newCount: 1 },
    { cardId: 'trickster_mark_of_sleep', oldCount: 2, newCount: 1 },
  ],
  zombies: [
    { cardId: 'zombie_lend_a_hand', oldCount: 2, newCount: 1 },
    { cardId: 'zombie_overrun', oldCount: 2, newCount: 1 },
  ],
  bear_cavalry: [
    { cardId: 'bear_cavalry_bear_necessities', oldCount: 2, newCount: 1 },
  ],
  killer_plants: [
    { cardId: 'killer_plant_insta_grow', oldCount: 1, newCount: 2 },
    { cardId: 'killer_plant_overgrowth', oldCount: 2, newCount: 1 },
  ],
  steampunks: [
    { cardId: 'steampunk_change_of_venue', oldCount: 2, newCount: 1 },
    { cardId: 'steampunk_rotary_slug_thrower', oldCount: 2, newCount: 1 },
  ],
  elder_things: [
    { cardId: 'elder_thing_insanity', oldCount: 2, newCount: 1 },
    { cardId: 'elder_thing_spreading_horror', oldCount: 2, newCount: 1 },
  ],
};

console.log('🔧 修复剩余的卡牌数量错误...\n');

for (const [factionId, factionFixes] of Object.entries(fixes)) {
  const filePath = join(rootDir, `src/games/smashup/data/factions/${factionId}.ts`);
  
  try {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    for (const fix of factionFixes) {
      const { cardId, oldCount, newCount } = fix;
      
      // 匹配 count: oldCount 的行
      const regex = new RegExp(
        `(id: '${cardId}'[\\s\\S]*?count: )${oldCount}(,)`,
        'g'
      );
      
      if (regex.test(content)) {
        content = content.replace(regex, `$1${newCount}$2`);
        console.log(`  ✅ ${factionId}: ${cardId} (${oldCount}x → ${newCount}x)`);
        modified = true;
      } else {
        console.log(`  ⚠️  ${factionId}: 未找到 ${cardId} (count: ${oldCount})`);
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`  💾 已保存: ${factionId}.ts\n`);
    } else {
      console.log(`  ℹ️  ${factionId}: 无需修改\n`);
    }
  } catch (error) {
    console.error(`  ❌ ${factionId}: 修复失败 - ${error.message}\n`);
  }
}

console.log('✅ 修复完成！运行 node scripts/compare-wiki-code.mjs 验证');
