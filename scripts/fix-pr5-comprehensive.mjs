#!/usr/bin/env node
/**
 * 综合修复 PR #5 引入的所有破坏性变更
 * 
 * 根据测试失败分析和代码审查，修复以下问题：
 * 1. ✅ robots.ts - 恢复删除的 ownership check (已修复)
 * 2. giant_ants.ts - powerModifier → powerCounters 错误替换
 * 3. vampires.ts - powerModifier → powerCounters 错误替换  
 * 4. zombies.ts - quota consumption 逻辑变更
 * 5. elder_things.ts - 删除的 registerProtection
 * 6. baseAbilities.ts - interaction 创建问题
 */

import { readFileSync, writeFileSync } from 'fs';

console.log('='.repeat(80));
console.log('PR #5 综合修复脚本');
console.log('='.repeat(80));

const fixes = [
    {
        file: 'src/games/smashup/abilities/giant_ants.ts',
        description: '修复 powerModifier 字段访问（应该是 powerCounters）',
        replacements: [
            {
                // 修复 giantAntSoldierTalent 中的 powerModifier 访问
                old: `    if (soldier.powerModifier < 1) {`,
                new: `    if (soldier.powerCounters < 1) {`,
            },
            {
                // 修复 handleDronePreventDestroy 中的 powerModifier 访问
                old: `    if (!drone || !target || drone.controller !== playerId || drone.powerModifier <= 0) {`,
                new: `    if (!drone || !target || drone.controller !== playerId || drone.powerCounters <= 0) {`,
            },
            {
                // 修复 giantAntWeWillRockYou 中的 powerModifier 访问
                old: `            if (m.powerModifier <= 0) continue;`,
                new: `            if (m.powerCounters <= 0) continue;`,
            },
            {
                // 修复 giantAntWeWillRockYou 中的 powerModifier 使用
                old: `            events.push(addTempPower(m.uid, i, m.powerModifier, 'giant_ant_we_will_rock_you', ctx.now));`,
                new: `            events.push(addTempPower(m.uid, i, m.powerCounters, 'giant_ant_we_will_rock_you', ctx.now));`,
            },
            {
                // 修复 giantAntUnderPressure 中的 powerModifier 访问
                old: `        .filter(m => m.controller === ctx.playerId && m.powerModifier > 0)`,
                new: `        .filter(m => m.controller === ctx.playerId && m.powerCounters > 0)`,
            },
            {
                // 修复 giantAntUnderPressure 中的 powerModifier 显示
                old: `            label: \`\${def?.name ?? m.defId}（力量指示物 \${m.powerModifier}）\`,`,
                new: `            label: \`\${def?.name ?? m.defId}（力量指示物 \${m.powerCounters}）\`,`,
            },
            {
                // 修复 handleSoldierChooseMinion 中的 powerModifier 访问
                old: `    if (!soldier || !target || soldier.controller !== playerId || soldier.powerModifier < 1) return { state, events: [] };`,
                new: `    if (!soldier || !target || soldier.controller !== playerId || soldier.powerCounters < 1) return { state, events: [] };`,
            },
            {
                // 修复 collectOwnMinionsWithCounters 中的 powerModifier 访问（如果存在）
                old: `count: ctx.state.bases[m.baseIndex]?.minions.find(x => x.uid === m.uid)?.powerModifier ?? 0,`,
                new: `count: ctx.state.bases[m.baseIndex]?.minions.find(x => x.uid === m.uid)?.powerCounters ?? 0,`,
            },
            {
                // 修复 handleWhoWantsToLiveForever 中的 powerModifier 访问
                old: `    if (!minion || minion.controller !== playerId || minion.powerModifier <= 0) {`,
                new: `    if (!minion || minion.controller !== playerId || minion.powerCounters <= 0) {`,
            },
        ],
    },
    {
        file: 'src/games/smashup/abilities/vampires.ts',
        description: '修复 powerModifier 字段访问（应该是 powerCounters）',
        replacements: [
            {
                // 修复 vampireMadMonsterParty 中的 powerModifier 访问
                old: `            if (m.controller === ctx.playerId && m.powerModifier === 0) {`,
                new: `            if (m.controller === ctx.playerId && m.powerCounters === 0) {`,
            },
        ],
    },
    {
        file: 'src/games/smashup/abilities/zombies.ts',
        description: '检查 quota consumption 逻辑（可能需要手动审查）',
        note: '僵尸派系的 quota 逻辑可能在 PR #5 中被修改，需要手动检查 grantExtraMinion 和 consumesNormalLimit 的使用',
    },
    {
        file: 'src/games/smashup/abilities/elder_things.ts',
        description: '恢复删除的 registerProtection（如果有）',
        note: 'PR #5 可能删除了 elder_thing_elder_thing 的 affect 类型保护注册，需要手动检查',
    },
    {
        file: 'src/games/smashup/domain/baseAbilities.ts',
        description: '修复基地能力 interaction 创建问题',
        note: 'PR #5 可能修改了基地能力的 interaction 创建逻辑，导致某些基地能力不创建 interaction',
    },
];

let totalFixed = 0;
let totalFailed = 0;

for (const fix of fixes) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`文件: ${fix.file}`);
    console.log(`描述: ${fix.description}`);
    if (fix.note) {
        console.log(`注意: ${fix.note}`);
    }
    console.log('='.repeat(80));
    
    if (!fix.replacements) {
        console.log('  ⚠️  需要手动审查');
        continue;
    }
    
    try {
        let content = readFileSync(fix.file, 'utf-8');
        let fixedCount = 0;
        
        for (const replacement of fix.replacements) {
            if (content.includes(replacement.old)) {
                content = content.replace(replacement.old, replacement.new);
                fixedCount++;
                console.log(`  ✅ 已修复: ${replacement.old.substring(0, 60)}...`);
            } else {
                console.log(`  ⚠️  未找到: ${replacement.old.substring(0, 60)}...`);
            }
        }
        
        if (fixedCount > 0) {
            writeFileSync(fix.file, content, 'utf-8');
            console.log(`  ✅ 已保存 ${fixedCount} 处修复`);
            totalFixed += fixedCount;
        } else {
            console.log(`  ℹ️  无需修复或已修复`);
        }
    } catch (error) {
        console.log(`  ❌ 修复失败: ${error.message}`);
        totalFailed++;
    }
}

console.log(`\n${'='.repeat(80)}`);
console.log('修复汇总');
console.log('='.repeat(80));
console.log(`✅ 成功修复: ${totalFixed} 处`);
console.log(`❌ 失败: ${totalFailed} 处`);
console.log(`⚠️  需要手动审查: ${fixes.filter(f => !f.replacements).length} 个文件`);

if (totalFixed > 0) {
    console.log(`\n建议运行测试验证修复: npm run test:games:core`);
}
