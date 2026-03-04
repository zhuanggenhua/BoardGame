#!/usr/bin/env node
/**
 * 修复 dino 测试文件中的命令类型
 * 
 * 问题：测试使用了错误的命令类型字符串
 * - 'PLAY_ACTION' → SU_COMMANDS.PLAY_ACTION (即 'su:play_action')
 * - 'PLAY_MINION' → SU_COMMANDS.PLAY_MINION (即 'su:play_minion')
 * 
 * 修复方案：
 * 1. 添加 import { SU_COMMANDS } from '../domain/types';
 * 2. 替换所有 executeCommand('PLAY_ACTION', ...) → executeCommand(SU_COMMANDS.PLAY_ACTION, ...)
 * 3. 替换所有 executeCommand('PLAY_MINION', ...) → executeCommand(SU_COMMANDS.PLAY_MINION, ...)
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
        
        // 检查是否已经 import SU_COMMANDS
        const hasImport = content.includes('import') && content.includes('SU_COMMANDS');
        
        if (!hasImport) {
            // 在 SmashUpEvent 的 import 后添加 SU_COMMANDS
            const importMatch = content.match(/(import.*SmashUpEvent.*from.*types';)/);
            if (importMatch) {
                const oldImport = importMatch[1];
                // 修改 import 语句，添加 SU_COMMANDS
                const newImport = oldImport.replace(
                    /import\s*{([^}]+)}\s*from\s*'\.\.\/domain\/types';/,
                    (match, imports) => {
                        const importList = imports.split(',').map(s => s.trim());
                        if (!importList.includes('SU_COMMANDS')) {
                            importList.push('SU_COMMANDS');
                        }
                        return `import { ${importList.join(', ')} } from '../domain/types';`;
                    }
                );
                content = content.replace(oldImport, newImport);
                console.log(`  ✅ 添加 SU_COMMANDS import`);
                replacements++;
            }
        }
        
        // 替换 executeCommand('PLAY_ACTION', ...) → executeCommand(SU_COMMANDS.PLAY_ACTION, ...)
        const playActionMatches = content.match(/executeCommand\('PLAY_ACTION'/g);
        if (playActionMatches) {
            content = content.replace(/executeCommand\('PLAY_ACTION'/g, 'executeCommand(SU_COMMANDS.PLAY_ACTION');
            replacements += playActionMatches.length;
            console.log(`  ✅ 替换 ${playActionMatches.length} 处 'PLAY_ACTION' → SU_COMMANDS.PLAY_ACTION`);
        }
        
        // 替换 executeCommand('PLAY_MINION', ...) → executeCommand(SU_COMMANDS.PLAY_MINION, ...)
        const playMinionMatches = content.match(/executeCommand\('PLAY_MINION'/g);
        if (playMinionMatches) {
            content = content.replace(/executeCommand\('PLAY_MINION'/g, 'executeCommand(SU_COMMANDS.PLAY_MINION');
            replacements += playMinionMatches.length;
            console.log(`  ✅ 替换 ${playMinionMatches.length} 处 'PLAY_MINION' → SU_COMMANDS.PLAY_MINION`);
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

console.log(`\n✅ 完成！共修复 ${totalReplacements} 处命令类型错误`);
