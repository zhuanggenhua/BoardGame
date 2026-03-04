#!/usr/bin/env node
/**
 * 修复 dino 测试文件中的 tempPower 属性访问
 * 
 * 问题：测试访问 minion.tempPower
 * 应该：访问 minion.tempPowerModifier
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts',
];

for (const file of files) {
    console.log(`\n处理文件: ${file}`);
    
    try {
        let content = readFileSync(file, 'utf-8');
        
        // 替换 .tempPower → .tempPowerModifier（但不要替换对象字面量中的 tempPower:）
        const matches = content.match(/\.tempPower\b(?!\s*:)/g);
        if (matches) {
            content = content.replace(/\.tempPower\b(?!\s*:)/g, '.tempPowerModifier');
            console.log(`  ✅ 替换 ${matches.length} 处 .tempPower → .tempPowerModifier`);
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
