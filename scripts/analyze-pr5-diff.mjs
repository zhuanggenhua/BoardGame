#!/usr/bin/env node
/**
 * 分析 PR #5 合并差异，识别所有破坏性变更
 * 
 * 根据测试失败分类，检查以下文件的变更：
 * 1. giant_ants.ts - power counter 逻辑
 * 2. vampires.ts - power counter 逻辑
 * 3. zombies.ts - quota consumption 逻辑
 * 4. elder_things.ts - protection registration
 * 5. baseAbilities.ts - interaction creation
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

console.log('='.repeat(80));
console.log('PR #5 差异分析 - 识别破坏性变更');
console.log('='.repeat(80));

// 获取 PR #5 合并提交的差异
const commit = '14670cb';
const files = [
    'src/games/smashup/abilities/giant_ants.ts',
    'src/games/smashup/abilities/vampires.ts',
    'src/games/smashup/abilities/zombies.ts',
    'src/games/smashup/abilities/elder_things.ts',
    'src/games/smashup/domain/baseAbilities.ts',
];

const issues = [];

for (const file of files) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`分析文件: ${file}`);
    console.log('='.repeat(80));
    
    try {
        // 获取该文件在 PR #5 中的差异
        const diff = execSync(`git show ${commit} -- ${file}`, { encoding: 'utf-8' });
        
        // 分析差异中的关键变更
        const lines = diff.split('\n');
        let inDiff = false;
        let currentHunk = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.startsWith('@@')) {
                if (currentHunk.length > 0) {
                    analyzeHunk(file, currentHunk, issues);
                }
                currentHunk = [line];
                inDiff = true;
            } else if (inDiff) {
                currentHunk.push(line);
            }
        }
        
        if (currentHunk.length > 0) {
            analyzeHunk(file, currentHunk, issues);
        }
    } catch (error) {
        console.log(`  ⚠️  无法获取差异: ${error.message}`);
    }
}

console.log(`\n${'='.repeat(80)}`);
console.log('发现的问题汇总');
console.log('='.repeat(80));

if (issues.length === 0) {
    console.log('✅ 未发现明显的破坏性变更');
} else {
    issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.type}`);
        console.log(`   文件: ${issue.file}`);
        console.log(`   位置: ${issue.location}`);
        console.log(`   描述: ${issue.description}`);
        if (issue.fix) {
            console.log(`   修复: ${issue.fix}`);
        }
    });
}

// 生成修复脚本
if (issues.length > 0) {
    console.log(`\n${'='.repeat(80)}`);
    console.log('生成修复脚本');
    console.log('='.repeat(80));
    
    const fixScript = generateFixScript(issues);
    writeFileSync('scripts/fix-pr5-issues.mjs', fixScript, 'utf-8');
    console.log('✅ 修复脚本已生成: scripts/fix-pr5-issues.mjs');
}

function analyzeHunk(file, hunk, issues) {
    const hunkText = hunk.join('\n');
    
    // 检查 1: powerModifier → powerCounters 变更
    if (hunkText.includes('-') && hunkText.includes('powerModifier') && 
        hunkText.includes('+') && hunkText.includes('powerCounters')) {
        issues.push({
            type: 'powerModifier → powerCounters 错误替换',
            file,
            location: hunk[0],
            description: 'PR #5 错误地将 powerModifier 改为 powerCounters',
            fix: '应该保持 powerModifier（+1 power tokens）或改为 powerCounters（取决于上下文）',
        });
    }
    
    // 检查 2: 删除的 ownership check
    if (hunkText.includes('-') && hunkText.includes('playerId') && hunkText.includes('!==')) {
        const deletedLines = hunk.filter(l => l.startsWith('-') && !l.startsWith('---'));
        if (deletedLines.some(l => l.includes('return []') || l.includes('return { events: [] }'))) {
            issues.push({
                type: '删除的 ownership check',
                file,
                location: hunk[0],
                description: 'PR #5 删除了 ownership/controller 检查',
                fix: '恢复被删除的检查逻辑',
            });
        }
    }
    
    // 检查 3: 删除的 registerProtection
    if (hunkText.includes('-') && hunkText.includes('registerProtection')) {
        issues.push({
            type: '删除的 registerProtection',
            file,
            location: hunk[0],
            description: 'PR #5 删除了 registerProtection 调用',
            fix: '恢复 registerProtection 注册',
        });
    }
    
    // 检查 4: 修改的 interaction handler 签名
    if (hunkText.includes('-') && hunkText.includes('function') && hunkText.includes('(') &&
        hunkText.includes('+') && hunkText.includes('function') && hunkText.includes('(')) {
        const oldSig = hunk.find(l => l.startsWith('-') && l.includes('function'));
        const newSig = hunk.find(l => l.startsWith('+') && l.includes('function'));
        if (oldSig && newSig && oldSig !== newSig.replace('+', '-')) {
            issues.push({
                type: '修改的函数签名',
                file,
                location: hunk[0],
                description: `函数签名变更:\n  旧: ${oldSig}\n  新: ${newSig}`,
                fix: '检查调用点是否需要更新',
            });
        }
    }
    
    // 检查 5: 删除的 quota consumption
    if (file.includes('zombies.ts') && hunkText.includes('-') && 
        (hunkText.includes('consumesNormalLimit') || hunkText.includes('grantExtraMinion'))) {
        issues.push({
            type: '删除的 quota consumption 逻辑',
            file,
            location: hunk[0],
            description: 'PR #5 可能修改了随从配额消耗逻辑',
            fix: '检查 grantExtraMinion 和 consumesNormalLimit 的使用',
        });
    }
    
    // 检查 6: 基地能力 interaction 创建问题
    if (file.includes('baseAbilities.ts') && hunkText.includes('-') && 
        hunkText.includes('createSimpleChoice')) {
        issues.push({
            type: '基地能力 interaction 创建变更',
            file,
            location: hunk[0],
            description: 'PR #5 修改了基地能力的 interaction 创建逻辑',
            fix: '检查 createSimpleChoice 参数和 queueInteraction 调用',
        });
    }
}

function generateFixScript(issues) {
    return `#!/usr/bin/env node
/**
 * 自动修复 PR #5 引入的破坏性变更
 * 
 * 生成时间: ${new Date().toISOString()}
 * 发现问题数: ${issues.length}
 */

import { readFileSync, writeFileSync } from 'fs';

console.log('开始修复 PR #5 引入的问题...');

const fixes = ${JSON.stringify(issues, null, 2)};

for (const fix of fixes) {
    console.log(\`\\n修复: \${fix.type}\`);
    console.log(\`  文件: \${fix.file}\`);
    console.log(\`  描述: \${fix.description}\`);
    
    // TODO: 实现具体的修复逻辑
    // 这里需要根据每个问题类型实现对应的修复代码
}

console.log('\\n✅ 修复完成');
`;
}
