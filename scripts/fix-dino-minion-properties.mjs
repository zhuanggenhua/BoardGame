#!/usr/bin/env node
/**
 * 修复 dino 测试文件中的随从属性名称
 * 
 * 问题：测试使用了错误的属性名
 * - power → basePower
 * - tempPower → tempPowerModifier
 * 
 * 修复范围：
 * - src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts
 * - src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts
 * - src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts
 * - src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts',
    'src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts',
    'src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts',
    'src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts',
];

let totalReplacements = 0;

for (const file of files) {
    console.log(`\n处理文件: ${file}`);
    
    try {
        let content = readFileSync(file, 'utf-8');
        let replacements = 0;
        
        // 替换 power: → basePower:
        const powerMatches = content.match(/power:\s*\d+/g);
        if (powerMatches) {
            content = content.replace(/power:\s*(\d+)/g, 'basePower: $1');
            replacements += powerMatches.length;
            console.log(`  ✅ 替换 ${powerMatches.length} 处 power → basePower`);
        }
        
        // 替换 tempPower: → tempPowerModifier:
        const tempPowerMatches = content.match(/tempPower:\s*\d+/g);
        if (tempPowerMatches) {
            content = content.replace(/tempPower:\s*(\d+)/g, 'tempPowerModifier: $1');
            replacements += tempPowerMatches.length;
            console.log(`  ✅ 替换 ${tempPowerMatches.length} 处 tempPower → tempPowerModifier`);
        }
        
        if (replacements > 0) {
            writeFileSync(file, content, 'utf-8');
            totalReplacements += replacements;
            console.log(`  ✅ 已保存，共 ${replacements} 处修改`);
        } else {
            console.log(`  ℹ️  无需修改`);
        }
    } catch (error) {
        console.error(`  ❌ 处理失败:`, error.message);
    }
}

console.log(`\n✅ 完成！共修复 ${totalReplacements} 处属性名错误`);
