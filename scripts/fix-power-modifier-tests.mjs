#!/usr/bin/env node
/**
 * 批量修复测试中混淆 powerModifier 和 tempPowerModifier 的问题
 * 
 * 规则：
 * - 临时力量修正（回合结束清零）→ tempPowerModifier
 * - 力量指示物（永久，可移动）→ powerModifier  
 * - 永久力量修正（不可移动）→ permanentPowerModifier
 */

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
    // factionAbilities.test.ts - pirate_swashbuckling 是临时修正
    {
        file: 'src/games/smashup/__tests__/factionAbilities.test.ts',
        pattern: /const powerEvents = events\.filter\(e => e\.type === SU_EVENTS\.POWER_COUNTER_ADDED\);/g,
        replacement: 'const powerEvents = events.filter(e => e.type === SU_EVENTS.TEMP_POWER_ADDED);',
    },
    
    // cthulhuExpansionAbilities.test.ts - innsmouth_the_deep_ones 是临时修正
    {
        file: 'src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts',
        searches: [
            { from: 'expect(minion!.powerModifier).toBe(1);', to: 'expect(minion!.tempPowerModifier).toBe(1);' }
        ]
    },
    
    // madnessAbilities.test.ts - miskatonic_mandatory_reading 是临时修正
    {
        file: 'src/games/smashup/__tests__/madnessAbilities.test.ts',
        searches: [
            { from: 'expect(newState.bases[0].minions[0].powerModifier).toBe(6);', to: 'expect(newState.bases[0].minions[0].tempPowerModifier).toBe(6);' }
        ]
    },
];

let totalFixed = 0;

for (const fix of fixes) {
    try {
        let content = readFileSync(fix.file, 'utf-8');
        let modified = false;

        if (fix.pattern && fix.replacement) {
            const newContent = content.replace(fix.pattern, fix.replacement);
            if (newContent !== content) {
                content = newContent;
                modified = true;
                totalFixed++;
            }
        }

        if (fix.searches) {
            for (const search of fix.searches) {
                if (content.includes(search.from)) {
                    content = content.replace(search.from, search.to);
                    modified = true;
                    totalFixed++;
                }
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
