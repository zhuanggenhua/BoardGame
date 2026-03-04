#!/usr/bin/env node
/**
 * 修复内联在数组中的 skip/done 选项
 */

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
    // cthulhu.ts - 最后一个
    {
        file: 'src/games/smashup/abilities/cthulhu.ts',
        old: `        '选择要弃掉的疑狂卡（任意数量，可跳过）', [...options, { id: 'skip', label: '跳过', value: { skip: true } }] as any[],`,
        new: `        '选择要弃掉的疑狂卡（任意数量，可跳过）', [...options, { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }] as any[],`
    },
    
    // ghosts.ts
    {
        file: 'src/games/smashup/abilities/ghosts.ts',
        old: `        '亡者崛起：选择要弃掉的手牌', [...options, { id: 'skip', label: '跳过', value: { skip: true } }] as any[], 'ghost_the_dead_rise_discard',`,
        new: `        '亡者崛起：选择要弃掉的手牌', [...options, { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }] as any[], 'ghost_the_dead_rise_discard',`
    },
    
    // killer_plants.ts
    {
        file: 'src/games/smashup/abilities/killer_plants.ts',
        old: `    options.push({ id: 'skip', label: '跳过', value: { skip: true } } as any);`,
        new: `    options.push({ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const } as any);`
    },
    
    // miskatonic.ts
    {
        file: 'src/games/smashup/abilities/miskatonic.ts',
        old: `        [...options, { id: 'skip', label: '跳过', value: { skip: true } }] as any[],`,
        new: `        [...options, { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }] as any[],`
    },
    
    // robots.ts
    {
        file: 'src/games/smashup/abilities/robots.ts',
        old: `        return [{ id: 'skip', label: '跳过', value: { skip: true } }];`,
        new: `        return [{ id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }];`
    },
    
    // zombies.ts - 3 处
    {
        file: 'src/games/smashup/abilities/zombies.ts',
        old: `        return [...opts, { id: 'skip', label: '跳过', value: { skip: true } }];`,
        new: `        return [...opts, { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }];`
    },
    {
        file: 'src/games/smashup/abilities/zombies.ts',
        old: `    options.push({ id: 'done', label: '完成', value: { done: true } } as any);`,
        new: `    options.push({ id: 'done', label: '完成', value: { done: true }, displayMode: 'button' as const } as any);`
    },
    {
        file: 'src/games/smashup/abilities/zombies.ts',
        old: `        opts.push({ id: 'done', label: '完成', value: { done: true } } as any);`,
        new: `        opts.push({ id: 'done', label: '完成', value: { done: true }, displayMode: 'button' as const } as any);`
    },
];

function applyFixes() {
    let totalFixed = 0;
    const fileMap = new Map();
    
    // 按文件分组
    for (const fix of fixes) {
        if (!fileMap.has(fix.file)) {
            fileMap.set(fix.file, []);
        }
        fileMap.get(fix.file).push(fix);
    }
    
    // 逐文件处理
    for (const [file, fileFixes] of fileMap.entries()) {
        let content = readFileSync(file, 'utf-8');
        let fileFixed = 0;
        
        for (const { old, new: newStr } of fileFixes) {
            if (content.includes(old)) {
                content = content.replace(old, newStr);
                fileFixed++;
                totalFixed++;
            } else {
                console.log(`⚠️  ${file}: 未找到`);
                console.log(`   ${old.substring(0, 60)}...`);
            }
        }
        
        if (fileFixed > 0) {
            writeFileSync(file, content, 'utf-8');
            console.log(`✅ ${file}: 修复了 ${fileFixed} 处`);
        }
    }
    
    console.log(`\n总计修复: ${totalFixed} 处`);
}

applyFixes();
