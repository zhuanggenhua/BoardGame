#!/usr/bin/env node
/**
 * 批量修复测试文件中缺少的 SELECT_ABILITY 命令
 * 
 * 在 CONFIRM_ROLL 和 ADVANCE_PHASE 之间插入 SELECT_ABILITY
 */

import { readFileSync, writeFileSync } from 'fs';

const fixes = [
    {
        file: 'src/games/dicethrone/__tests__/flow.test.ts',
        replacements: [
            // 防御投掷确认后响应窗口排除防御方
            {
                search: `                name: '防御投掷确认后响应窗口排除防御方（不排除攻击方）',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2`,
                replace: `                name: '防御投掷确认后响应窗口排除防御方（不排除攻击方）',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2`
            }
        ]
    }
];

function applyFixes() {
    for (const { file, replacements } of fixes) {
        try {
            console.log(`Processing ${file}...`);
            let content = readFileSync(file, 'utf-8');
            let changeCount = 0;

            for (const { search, replace } of replacements) {
                if (content.includes(search)) {
                    content = content.replace(search, replace);
                    changeCount++;
                }
            }

            if (changeCount > 0) {
                writeFileSync(file, content, 'utf-8');
                console.log(`  ✅ Applied ${changeCount} fixes`);
            } else {
                console.log(`  ⚠️  No matches found`);
            }
        } catch (error) {
            console.error(`  ❌ Error processing ${file}:`, error.message);
        }
    }
}

applyFixes();
console.log('Done!');
