#!/usr/bin/env node
/**
 * 修复 POD 派系的 ongoing trigger 实现
 * 
 * 问题：POD 派系的 ongoing 卡注册了 onTurnStart trigger，
 * 但 trigger 回调函数错误地在 base.ongoingActions 中查找自己，
 * 而不是在 attachedActions 中查找。
 * 
 * 修复策略：
 * 1. 找到所有 POD 派系文件
 * 2. 检查它们的 registerTrigger 调用
 * 3. 修改 trigger 回调函数，使其在 attachedActions 中查找自己
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const POD_FACTIONS_DIR = 'src/games/smashup/data/factions';

// 获取所有 POD 派系文件
const podFiles = readdirSync(POD_FACTIONS_DIR)
    .filter(f => f.endsWith('_pod.ts'))
    .map(f => join(POD_FACTIONS_DIR, f));

console.log(`找到 ${podFiles.length} 个 POD 派系文件`);

let totalFixed = 0;

for (const file of podFiles) {
    const content = readFileSync(file, 'utf-8');
    
    // 检查是否有 ongoingTarget: 'minion'
    if (!content.includes("ongoingTarget: 'minion'")) {
        continue;
    }
    
    console.log(`\n检查文件: ${file}`);
    
    // 这些文件需要修复 trigger 实现
    // 但由于 POD 派系的 trigger 实现在单独的文件中（如 abilities/ghosts.ts），
    // 我们需要找到对应的 abilities 文件
    
    const factionName = file.match(/[\/\\]([^\/\\]+)_pod\.ts$/)?.[1];
    if (!factionName) {
        console.log(`  ✗ 无法解析派系名`);
        continue;
    }
    console.log(`  派系名: ${factionName}`);
    
    // 检查是否有对应的 abilities 文件
    const abilitiesFile = `src/games/smashup/abilities/${factionName}.ts`;
    try {
        const abilitiesContent = readFileSync(abilitiesFile, 'utf-8');
        
        // 检查是否有 registerTrigger 调用
        if (abilitiesContent.includes('registerTrigger')) {
            console.log(`  ✓ 找到 abilities 文件: ${abilitiesFile}`);
            console.log(`  ⚠️  需要手动检查 trigger 实现是否正确`);
        }
    } catch (e) {
        console.log(`  ✗ 未找到 abilities 文件: ${abilitiesFile}`);
    }
}

console.log(`\n总结: 需要手动检查 ${totalFixed} 个文件的 trigger 实现`);
console.log(`\n修复指南:`);
console.log(`1. 对于 ongoingTarget: 'minion' 的卡牌`);
console.log(`2. 它们的 trigger 回调函数应该在 attachedActions 中查找自己`);
console.log(`3. 而不是在 base.ongoingActions 中查找`);
console.log(`\n示例:`);
console.log(`❌ 错误: base.ongoingActions.find(c => c.defId === 'xxx')`);
console.log(`✅ 正确: base.minions.flatMap(m => m.attachedActions || []).find(c => c.defId === 'xxx')`);
