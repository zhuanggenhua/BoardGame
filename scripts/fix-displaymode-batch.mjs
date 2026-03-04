#!/usr/bin/env node
/**
 * 批量修复缺失的 displayMode
 * 
 * 规则：
 * 1. 包含 cardUid 的选项 → displayMode: 'card'
 * 2. skip/done/cancel 选项 → displayMode: 'button'
 */

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
    // aliens.ts
    {
        file: 'src/games/smashup/abilities/aliens.ts',
        replacements: [
            {
                old: `        { id: 'skip', label: '跳过（不返回随从）', value: { skip: true } },`,
                new: `        { id: 'skip', label: '跳过（不返回随从）', value: { skip: true }, displayMode: 'button' as const },`
            },
            {
                old: `        { id: 'skip', label: '跳过（不收回随从）', value: { skip: true } },`,
                new: `        { id: 'skip', label: '跳过（不收回随从）', value: { skip: true }, displayMode: 'button' as const },`
            },
            {
                old: `            { id: 'skip', label: '跳过额外随从', value: { skip: true } },`,
                new: `            { id: 'skip', label: '跳过额外随从', value: { skip: true }, displayMode: 'button' as const },`
            },
            {
                old: `                    value: { cardUid: card.uid, defId: card.defId },`,
                new: `                    value: { cardUid: card.uid, defId: card.defId },
                    displayMode: 'card' as const,`
            }
        ]
    },
    
    // wizards.ts - 聚集秘术
    {
        file: 'src/games/smashup/abilities/wizards.ts',
        replacements: [
            {
                old: `    const options = actionCandidates.map((c, i) => ({ id: \`card-\${i}\`, label: c.label, value: { cardUid: c.uid, defId: c.defId, pid: c.pid } }));`,
                new: `    const options = actionCandidates.map((c, i) => ({ id: \`card-\${i}\`, label: c.label, value: { cardUid: c.uid, defId: c.defId, pid: c.pid }, displayMode: 'card' as const }));`
            },
            // 传送门排序选项
            {
                old: `        return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId } };`,
                new: `        return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const };`
            },
            // 占卜选项
            {
                old: `        return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const interaction = createSimpleChoice(
        \`wizard_scry_\${ctx.now}\`, ctx.playerId,`,
                new: `        return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const };
    });
    const interaction = createSimpleChoice(
        \`wizard_scry_\${ctx.now}\`, ctx.playerId,`
            }
        ]
    },
    
    // zombies.ts
    {
        file: 'src/games/smashup/abilities/zombies.ts',
        replacements: [
            {
                old: `        return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId } };
    });
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };`,
                new: `        return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const };
    });
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const };`
            },
            {
                old: `            return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId } };
        });
        return [...opts, { id: 'skip', label: '跳过', value: { skip: true } }];`,
                new: `            return { id: \`card-\${i}\`, label: name, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const };
        });
        return [...opts, { id: 'skip', label: '跳过', value: { skip: true }, displayMode: 'button' as const }];`
            },
            {
                old: `        return { id: \`card-\${i}\`, label: \`\${name} (\${c.type === 'minion' ? '随从' : '行动'})\`, value: { cardUid: c.uid, defId: c.defId } };`,
                new: `        return { id: \`card-\${i}\`, label: \`\${name} (\${c.type === 'minion' ? '随从' : '行动'})\`, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const };`
            },
            {
                old: `        return { id: \`card-\${i}\`, label: \`\${name} (\${typeLabel})\`, value: { cardUid: c.uid, defId: c.defId } };`,
                new: `        return { id: \`card-\${i}\`, label: \`\${name} (\${typeLabel})\`, value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const };`
            },
            {
                old: `            return { id: \`card-\${i}\`, label: \`\${name} (力量 \${power})\`, value: { cardUid: c.uid, defId: c.defId, power } };
        });
    options.push({ id: 'done', label: '完成', value: { done: true } } as any);`,
                new: `            return { id: \`card-\${i}\`, label: \`\${name} (力量 \${power})\`, value: { cardUid: c.uid, defId: c.defId, power }, displayMode: 'card' as const };
        });
    options.push({ id: 'done', label: '完成', value: { done: true }, displayMode: 'button' as const } as any);`
            },
            {
                old: `                return { id: \`card-\${i}\`, label: \`\${name} (力量 \${power})\`, value: { cardUid: c.uid, defId: c.defId, power } };
            });
        opts.push({ id: 'done', label: '完成', value: { done: true } } as any);`,
                new: `                return { id: \`card-\${i}\`, label: \`\${name} (力量 \${power})\`, value: { cardUid: c.uid, defId: c.defId, power }, displayMode: 'card' as const };
            });
        opts.push({ id: 'done', label: '完成', value: { done: true }, displayMode: 'button' as const } as any);`
            }
        ]
    }
];

function applyFixes() {
    let totalFixed = 0;
    
    for (const { file, replacements } of fixes) {
        console.log(`\n处理 ${file}...`);
        let content = readFileSync(file, 'utf-8');
        let fileFixed = 0;
        
        for (const { old, new: newStr } of replacements) {
            if (content.includes(old)) {
                content = content.replace(old, newStr);
                fileFixed++;
                totalFixed++;
            } else {
                console.log(`  ⚠️  未找到: ${old.substring(0, 50)}...`);
            }
        }
        
        if (fileFixed > 0) {
            writeFileSync(file, content, 'utf-8');
            console.log(`  ✅ 修复了 ${fileFixed} 处`);
        }
    }
    
    console.log(`\n总计修复: ${totalFixed} 处`);
}

applyFixes();
