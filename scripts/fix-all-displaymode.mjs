#!/usr/bin/env node
/**
 * 全面修复所有缺失的 displayMode
 * 
 * 策略：
 * 1. 读取每个文件
 * 2. 逐行扫描
 * 3. 识别需要添加 displayMode 的模式
 * 4. 智能插入 displayMode
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/abilities/aliens.ts',
    'src/games/smashup/abilities/cthulhu.ts',
    'src/games/smashup/abilities/elder_things.ts',
    'src/games/smashup/abilities/frankenstein.ts',
    'src/games/smashup/abilities/ghosts.ts',
    'src/games/smashup/abilities/giant_ants.ts',
    'src/games/smashup/abilities/killer_plants.ts',
    'src/games/smashup/abilities/miskatonic.ts',
    'src/games/smashup/abilities/ninjas.ts',
    'src/games/smashup/abilities/pirates.ts',
    'src/games/smashup/abilities/robots.ts',
    'src/games/smashup/abilities/vampires.ts',
    'src/games/smashup/abilities/wizards.ts',
    'src/games/smashup/abilities/zombies.ts',
];

function fixFile(filePath) {
    let content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let modified = false;
    let fixCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 跳过已有 displayMode 的行
        if (line.includes('displayMode:')) continue;
        
        // 模式 1: { id: 'xxx', label: 'xxx', value: { cardUid: xxx } }
        // 需要添加 displayMode: 'card'
        if (line.includes('value:') && line.includes('cardUid') && !line.includes('displayMode')) {
            // 检查是否在对象字面量中
            if (line.includes('{') && line.includes('}')) {
                // 单行对象
                const newLine = line.replace(/}(\s*)(,?)(\s*)$/, `, displayMode: 'card' as const }$1$2$3`);
                if (newLine !== line) {
                    lines[i] = newLine;
                    modified = true;
                    fixCount++;
                }
            } else if (line.trim().endsWith(',')) {
                // 多行对象，value 行
                // 在下一行插入 displayMode
                const indent = line.match(/^(\s*)/)[1];
                lines.splice(i + 1, 0, `${indent}    displayMode: 'card' as const,`);
                modified = true;
                fixCount++;
                i++; // 跳过新插入的行
            }
        }
        
        // 模式 2: { id: 'skip', label: 'xxx', value: { skip: true } }
        // 需要添加 displayMode: 'button'
        if (line.includes('value:') && (line.includes('skip: true') || line.includes('done: true') || line.includes('cancel: true')) && !line.includes('displayMode')) {
            if (line.includes('{') && line.includes('}')) {
                // 单行对象
                const newLine = line.replace(/}(\s*)(,?)(\s*)$/, `, displayMode: 'button' as const }$1$2$3`);
                if (newLine !== line) {
                    lines[i] = newLine;
                    modified = true;
                    fixCount++;
                }
            } else if (line.trim().endsWith(',')) {
                // 多行对象
                const indent = line.match(/^(\s*)/)[1];
                lines.splice(i + 1, 0, `${indent}    displayMode: 'button' as const,`);
                modified = true;
                fixCount++;
                i++;
            }
        }
        
        // 模式 3: return { id: 'xxx', label: 'xxx', value: { cardUid: xxx } };
        if (line.includes('return') && line.includes('value:') && line.includes('cardUid') && !line.includes('displayMode')) {
            const newLine = line.replace(/}(\s*);/, `, displayMode: 'card' as const }$1;`);
            if (newLine !== line) {
                lines[i] = newLine;
                modified = true;
                fixCount++;
            }
        }
        
        // 模式 4: const skipOption = { id: 'skip', label: 'xxx', value: { skip: true } };
        if (line.includes('skipOption') && line.includes('value:') && line.includes('skip: true') && !line.includes('displayMode')) {
            const newLine = line.replace(/}(\s*);/, `, displayMode: 'button' as const }$1;`);
            if (newLine !== line) {
                lines[i] = newLine;
                modified = true;
                fixCount++;
            }
        }
    }
    
    if (modified) {
        const newContent = lines.join('\n');
        writeFileSync(filePath, newContent, 'utf-8');
        console.log(`✅ ${filePath}: 修复了 ${fixCount} 处`);
        return fixCount;
    }
    
    return 0;
}

function main() {
    console.log('开始修复 displayMode...\n');
    let totalFixed = 0;
    
    for (const file of files) {
        const fixed = fixFile(file);
        totalFixed += fixed;
    }
    
    console.log(`\n总计修复: ${totalFixed} 处`);
}

main();
