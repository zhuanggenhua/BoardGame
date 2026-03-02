#!/usr/bin/env node
/**
 * 批量修复所有力量修正相关的测试失败
 * 
 * 力量系统重构后的三个字段：
 * - powerCounters: +1 力量指示物（可放置/移除/转移）→ POWER_COUNTER_ADDED/REMOVED
 * - powerModifier: 永久力量修正（非指示物）→ PERMANENT_POWER_ADDED
 * - tempPowerModifier: 临时力量修正（回合结束清零）→ TEMP_POWER_ADDED
 */

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
    // 1. bigGulpDroneIntercept.test.ts - 雄蜂防止消灭，应该检查 powerCounters
    {
        file: 'src/games/smashup/__tests__/bigGulpDroneIntercept.test.ts',
        replacements: [
            { from: 'expect(drone!.powerModifier).toBe(0); // 从1减到0', to: 'expect(drone!.powerCounters).toBe(0); // 从1减到0' }
        ]
    },
    
    // 2. duplicateInteractionRespond.test.ts - 雄蜂防止消灭，应该检查 powerCounters
    {
        file: 'src/games/smashup/__tests__/duplicateInteractionRespond.test.ts',
        replacements: [
            { from: 'expect(droneAfter1!.powerModifier).toBe(0); // 指示物从 1 → 0', to: 'expect(droneAfter1!.powerCounters).toBe(0); // 指示物从 1 → 0' }
        ]
    },
    
    // 3. newFactionAbilities.test.ts - 巨蚁派系，应该检查 powerCounters
    {
        file: 'src/games/smashup/__tests__/newFactionAbilities.test.ts',
        replacements: [
            { from: 'expect(m1Final?.powerModifier).toBe(0);', to: 'expect(m1Final?.powerCounters).toBe(0);' },
            { from: 'expect(m2Final?.powerModifier).toBe(3);', to: 'expect(m2Final?.powerCounters).toBe(3);' },
            { from: 'expect(finalMinion!.powerModifier).toBe(1);', to: 'expect(finalMinion!.powerCounters).toBe(1);' }
        ]
    },
    
    // 4. zombieInteractionChain.test.ts - 检查随从额度消耗
    // 这个可能需要检查测试逻辑，暂时跳过
];

let totalFixed = 0;

for (const fix of fixes) {
    try {
        let content = readFileSync(fix.file, 'utf-8');
        let modified = false;

        for (const replacement of fix.replacements) {
            if (content.includes(replacement.from)) {
                content = content.replace(replacement.from, replacement.to);
                modified = true;
                totalFixed++;
            }
        }

        if (modified) {
            writeFileSync(fix.file, content, 'utf-8');
            console.log(`✅ ${fix.file}`);
        }
    } catch (err) {
        console.error(`❌ ${fix.file}: ${err.message}`);
    }
}

console.log(`\n总计修复: ${totalFixed} 处`);
console.log('\n剩余需要手动检查的测试：');
console.log('- baseAbilitiesPrompt.test.ts (交互未创建)');
console.log('- baseAbilityIntegrationE2E.test.ts (交互未创建)');
console.log('- baseFactionOngoing.test.ts (所有权检查失败)');
console.log('- expansionAbilities.test.ts (验证失败)');
console.log('- interactionChainE2E.test.ts (交互未创建)');
console.log('- newBaseAbilities.test.ts (触发未防止)');
console.log('- newFactionAbilities.test.ts (事件未生成)');
console.log('- robot-hoverbot-chain.test.ts (选项刷新错误)');
console.log('- zombieInteractionChain.test.ts (额度未消耗)');
