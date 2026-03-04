#!/usr/bin/env node
/**
 * 修复 dino 测试文件中的随从对象，确保所有必需属性都存在
 * 
 * MinionOnBase 接口要求：
 * - basePower (已修复)
 * - powerCounters (已修复)
 * - powerModifier (需要添加)
 * - tempPowerModifier (已修复)
 * - talentUsed (需要添加)
 * - attachedActions (已有)
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts',
    'src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts',
    'src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts',
    'src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts',
];

for (const file of files) {
    console.log(`\n处理文件: ${file}`);
    
    try {
        let content = readFileSync(file, 'utf-8');
        let replacements = 0;
        
        // 在 attachedActions: [] 后添加缺失的属性
        // 匹配模式：attachedActions: [], powerCounters: N, tempPowerModifier: N }
        // 替换为：attachedActions: [], powerCounters: N, powerModifier: 0, tempPowerModifier: N, talentUsed: false }
        
        const pattern = /(attachedActions:\s*\[\],\s*powerCounters:\s*\d+,\s*)(tempPowerModifier:\s*\d+\s*})/g;
        const matches = content.match(pattern);
        
        if (matches) {
            content = content.replace(pattern, '$1powerModifier: 0, $2, talentUsed: false }');
            // 修复多余的 }
            content = content.replace(/}\s*,\s*talentUsed:\s*false\s*}/g, ', talentUsed: false }');
            replacements += matches.length;
            console.log(`  ✅ 添加 ${matches.length} 处缺失属性 (powerModifier, talentUsed)`);
        }
        
        if (replacements > 0) {
            writeFileSync(file, content, 'utf-8');
            console.log(`  ✅ 已保存`);
        } else {
            console.log(`  ℹ️  无需修改`);
        }
    } catch (error) {
        console.error(`  ❌ 处理失败:`, error.message);
    }
}

console.log(`\n✅ 完成！`);
