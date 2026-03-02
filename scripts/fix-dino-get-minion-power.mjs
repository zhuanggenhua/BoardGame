#!/usr/bin/env node
/**
 * 修复 dino 测试文件中的 getMinionPower 调用
 * 
 * 问题：getMinionPower(state, minion, baseIndex)
 * 应该：getMinionPower(state.core, minion, baseIndex)
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts',
];

for (const file of files) {
    console.log(`\n处理文件: ${file}`);
    
    try {
        let content = readFileSync(file, 'utf-8');
        
        // 替换 getMinionPower(state, → getMinionPower(state.core,
        const matches = content.match(/getMinionPower\(state,/g);
        if (matches) {
            content = content.replace(/getMinionPower\(state,/g, 'getMinionPower(state.core,');
            console.log(`  ✅ 替换 ${matches.length} 处 getMinionPower(state, → getMinionPower(state.core,`);
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
