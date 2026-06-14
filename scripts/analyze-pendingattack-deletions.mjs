#!/usr/bin/env node
/**
 * 分析 POD commit 中所有 pendingAttack 删除
 * 
 * 目标：
 * 1. 提取所有删除 pendingAttack 的代码行
 * 2. 按文件分组
 * 3. 分类删除原因（POD 相关 vs 误删）
 * 4. 生成详细报告
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';

console.log('🔍 分析 POD commit 中的 pendingAttack 删除...\n');

// 获取 POD commit 的 diff
const diff = execSync('git diff 6ea1f9f^..6ea1f9f', { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

// 解析 diff
const lines = diff.split('\n');
const deletions = [];
let currentFile = null;
let lineNumber = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检测文件头
    if (line.startsWith('diff --git')) {
        const match = line.match(/diff --git a\/(.*) b\//);
        if (match) {
            currentFile = match[1];
            lineNumber = 0;
        }
    }
    
    // 检测行号
    if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)/);
        if (match) {
            lineNumber = parseInt(match[1], 10);
        }
    }
    
    // 检测删除行
    if (line.startsWith('-') && !line.startsWith('---') && line.includes('pendingAttack')) {
        // 获取上下文（前后 3 行）
        const context = {
            before: lines.slice(Math.max(0, i - 3), i).filter(l => !l.startsWith('@@')),
            line: line,
            after: lines.slice(i + 1, Math.min(lines.length, i + 4)).filter(l => !l.startsWith('@@')),
        };
        
        deletions.push({
            file: currentFile,
            lineNumber,
            line: line.substring(1).trim(), // 移除 '-' 前缀
            context,
        });
    }
    
    // 更新行号
    if (line.startsWith('-') && !line.startsWith('---')) {
        lineNumber++;
    }
}

console.log(`✅ 找到 ${deletions.length} 处 pendingAttack 删除\n`);

// 按文件分组
const byFile = {};
for (const deletion of deletions) {
    if (!byFile[deletion.file]) {
        byFile[deletion.file] = [];
    }
    byFile[deletion.file].push(deletion);
}

console.log(`📁 涉及 ${Object.keys(byFile).length} 个文件\n`);

// 分类删除
const categories = {
    ultimateShieldImmunity: [],
    testSetup: [],
    validation: [],
    flowHooks: [],
    utils: [],
    ui: [],
    comments: [],
    other: [],
};

for (const deletion of deletions) {
    const line = deletion.line;
    const file = deletion.file;
    
    // Ultimate 护盾免疫
    if (line.includes('isUltimate') || line.includes('Ultimate')) {
        categories.ultimateShieldImmunity.push(deletion);
    }
    // 测试设置
    else if (file.includes('.test.ts') && line.includes('pendingAttack = {')) {
        categories.testSetup.push(deletion);
    }
    // 验证逻辑
    else if (file.includes('validate') || line.includes('if (state.pendingAttack)')) {
        categories.validation.push(deletion);
    }
    // 流程钩子
    else if (file.includes('flowHooks')) {
        categories.flowHooks.push(deletion);
    }
    // 工具函数
    else if (file.includes('utils')) {
        categories.utils.push(deletion);
    }
    // UI 组件
    else if (file.includes('Board.tsx') || file.includes('hooks/')) {
        categories.ui.push(deletion);
    }
    // 注释
    else if (line.trim().startsWith('//')) {
        categories.comments.push(deletion);
    }
    // 其他
    else {
        categories.other.push(deletion);
    }
}

// 生成报告
let report = `# pendingAttack 删除详细分析

**分析日期**: ${new Date().toISOString().split('T')[0]}  
**提交**: 6ea1f9f  
**总删除数**: ${deletions.length}  
**涉及文件**: ${Object.keys(byFile).length}

---

## 📊 分类统计

`;

for (const [category, items] of Object.entries(categories)) {
    report += `- **${category}**: ${items.length} 处\n`;
}

report += `\n---\n\n`;

// 详细分类报告
for (const [category, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    
    report += `## ${category} (${items.length} 处)\n\n`;
    
    // 按文件分组
    const fileGroups = {};
    for (const item of items) {
        if (!fileGroups[item.file]) {
            fileGroups[item.file] = [];
        }
        fileGroups[item.file].push(item);
    }
    
    for (const [file, fileItems] of Object.entries(fileGroups)) {
        report += `### ${file} (${fileItems.length} 处)\n\n`;
        
        for (const item of fileItems) {
            report += `**删除内容**:\n\`\`\`typescript\n${item.line}\n\`\`\`\n\n`;
            
            // 上下文
            if (item.context.before.length > 0) {
                report += `**上文**:\n\`\`\`typescript\n${item.context.before.join('\n')}\n\`\`\`\n\n`;
            }
            
            if (item.context.after.length > 0) {
                report += `**下文**:\n\`\`\`typescript\n${item.context.after.join('\n')}\n\`\`\`\n\n`;
            }
            
            report += `---\n\n`;
        }
    }
}

// 按文件分组的完整列表
report += `## 📁 按文件分组\n\n`;

for (const [file, items] of Object.entries(byFile)) {
    report += `### ${file} (${items.length} 处)\n\n`;
    for (const item of items) {
        report += `- 第 ${item.lineNumber} 行: \`${item.line.substring(0, 80)}${item.line.length > 80 ? '...' : ''}\`\n`;
    }
    report += `\n`;
}

// 写入报告
writeFileSync('evidence/_shared/pendingattack-deletions-detailed.md', report, 'utf-8');

console.log('✅ 报告已生成: evidence/_shared/pendingattack-deletions-detailed.md\n');

// 输出摘要
console.log('📊 分类摘要:');
for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) {
        console.log(`  - ${category}: ${items.length} 处`);
    }
}

console.log('\n🎯 下一步:');
console.log('  1. 阅读 evidence/_shared/pendingattack-deletions-detailed.md');
console.log('  2. 逐个审查每处删除');
console.log('  3. 标记需要恢复的代码');
console.log('  4. 创建恢复清单');
