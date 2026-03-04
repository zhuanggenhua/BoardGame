#!/usr/bin/env node
/**
 * 修复 dino 测试文件中的状态访问路径
 * 
 * 问题：测试直接访问 state.bases / state.players / state.tempBreakpointModifiers
 * 应该：访问 state.core.bases / state.core.players / state.core.tempBreakpointModifiers
 * 
 * 注意：不要修改 state.sys（这个是正确的）
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts',
    'src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts',
    'src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts',
];

for (const file of files) {
    console.log(`\n处理文件: ${file}`);
    
    try {
        let content = readFileSync(file, 'utf-8');
        let replacements = 0;
        
        // 替换 state.bases → state.core.bases
        const basesMatches = content.match(/\bstate\.bases\[/g);
        if (basesMatches) {
            content = content.replace(/\bstate\.bases\[/g, 'state.core.bases[');
            replacements += basesMatches.length;
            console.log(`  ✅ 替换 ${basesMatches.length} 处 state.bases → state.core.bases`);
        }
        
        // 替换 state.players → state.core.players
        const playersMatches = content.match(/\bstate\.players\[/g);
        if (playersMatches) {
            content = content.replace(/\bstate\.players\[/g, 'state.core.players[');
            replacements += playersMatches.length;
            console.log(`  ✅ 替换 ${playersMatches.length} 处 state.players → state.core.players`);
        }
        
        // 替换 state.tempBreakpointModifiers → state.core.tempBreakpointModifiers
        const tempBpMatches = content.match(/\bstate\.tempBreakpointModifiers/g);
        if (tempBpMatches) {
            content = content.replace(/\bstate\.tempBreakpointModifiers/g, 'state.core.tempBreakpointModifiers');
            replacements += tempBpMatches.length;
            console.log(`  ✅ 替换 ${tempBpMatches.length} 处 state.tempBreakpointModifiers → state.core.tempBreakpointModifiers`);
        }
        
        if (replacements > 0) {
            writeFileSync(file, content, 'utf-8');
            console.log(`  ✅ 已保存，共 ${replacements} 处修改`);
        } else {
            console.log(`  ℹ️  无需修改`);
        }
    } catch (error) {
        console.error(`  ❌ 处理失败:`, error.message);
    }
}

console.log(`\n✅ 完成！`);
