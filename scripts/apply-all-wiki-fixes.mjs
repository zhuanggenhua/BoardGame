#!/usr/bin/env node
/**
 * 批量修复所有派系的卡牌数量问题
 * 根据 wiki-comparison-report.json 自动修复所有派系
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 读取 Wiki 对比报告
const reportPath = join(rootDir, 'wiki-comparison-report.json');
const report = JSON.parse(readFileSync(reportPath, 'utf-8'));

// 修复规则映射
const fixes = {
  // 忍者：修复数量 + 已添加 Invisible Ninja
  ninjas: [
    { cardId: 'ninja_hidden_ninja', oldCount: 2, newCount: 1 },
    { cardId: 'ninja_infiltrate', oldCount: 1, newCount: 2 },
    { cardId: 'ninja_poison', oldCount: 2, newCount: 1 },
    { cardId: 'ninja_seeing_stars', oldCount: 1, newCount: 2 },
  ],
  
  // 海盗：修复数量 + 已添加 Cut Lass 和 The Kraken
  pirates: [
    { cardId: 'pirate_broadside', oldCount: 1, newCount: 2 },
    { cardId: 'pirate_full_sail', oldCount: 2, newCount: 1 },
  ],
  
  // 捣蛋鬼：修复数量 + 需要添加 Big Funny Giant
  tricksters: [
    { cardId: 'trickster_disenchant', oldCount: 1, newCount: 2 },
    { cardId: 'trickster_enshrouding_mist', oldCount: 1, newCount: 2 },
    { cardId: 'trickster_flame_trap', oldCount: 2, newCount: 1 },
    { cardId: 'trickster_pay_the_piper', oldCount: 2, newCount: 1 },
  ],
  
  // 丧尸：修复数量 + 命名修正
  zombies: [
    { cardId: 'zombie_grave_robbing', oldCount: 1, newCount: 2 },
    { cardId: 'zombie_mall_crawl', oldCount: 2, newCount: 1 },
  ],
  
  // 熊骑兵：修复数量 + 需要添加 Major Ursa
  bear_cavalry: [
    { cardId: 'bear_cavalry_bear_necessities', oldCount: 2, newCount: 1 },
    { cardId: 'bear_cavalry_commission', oldCount: 1, newCount: 2 },
    { cardId: 'bear_cavalry_high_ground', oldCount: 2, newCount: 1 },
    { cardId: 'bear_cavalry_youre_screwed', oldCount: 1, newCount: 2 },
  ],
  
  // 食人花：修复数量 + 需要添加 Killer Kudzu
  killer_plants: [
    { cardId: 'killer_plant_budding', oldCount: 2, newCount: 1 },
    { cardId: 'killer_plant_sleep_spores', oldCount: 1, newCount: 2 },
  ],
  
  // 蒸汽朋克：修复数量
  steampunks: [
    { cardId: 'steampunk_escape_hatch', oldCount: 2, newCount: 1 },
    { cardId: 'steampunk_zeppelin', oldCount: 1, newCount: 2 },
  ],
  
  // 远古物种：修复数量
  elder_things: [
    { cardId: 'elder_thing_begin_the_summoning', oldCount: 1, newCount: 2 },
    { cardId: 'elder_thing_power_of_madness', oldCount: 1, newCount: 2 },
    { cardId: 'elder_thing_touch_of_madness', oldCount: 3, newCount: 1 },
  ],
};

// 需要添加的卡牌（暂时跳过，需要图集索引）
const missingCards = {
  tricksters: ['Big Funny Giant'],
  wizards: ['Arcane Protector'],
  zombies: ["They're Coming To Get You"],
  dinosaurs: ['Tooth and Claw... and Guns', 'Fort Titanosaurus'],
  bear_cavalry: ['Major Ursa'],
  ghosts: ['Creampuff Man'],
  killer_plants: ['Killer Kudzu'],
  innsmouth: ['Dagon'],
  cthulhu: ['Cthulhu'],
  miskatonic: ['"Old Man Jenkins!?"', '... It Just Might Work', "That's So Crazy..."],
  'giant-ants': ['Death on Six Legs'],
  vampires: ['Ancient Lord'],
  werewolves: ['Great Wolf Spirit'],
  frankenstein: ["IT'S ALIVE!", 'The Bride'],
};

console.log('🔧 开始批量修复派系卡牌数量...\n');

// 修复每个派系
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

console.log('\n📋 缺失卡牌清单（需要手动添加图集索引）：\n');
for (const [factionId, cards] of Object.entries(missingCards)) {
  console.log(`${factionId}:`);
  cards.forEach(card => console.log(`  - ${card}`));
  console.log('');
}

console.log('✅ 批量修复完成！');
console.log('\n下一步：');
console.log('1. 运行 node scripts/compare-wiki-code.mjs 验证修复');
console.log('2. 为缺失卡牌分配图集索引');
console.log('3. 运行 npm run test 确认无破坏性变更');
