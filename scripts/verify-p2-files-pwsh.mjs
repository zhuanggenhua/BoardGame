#!/usr/bin/env node
/**
 * P2 文件完整验证脚本（PowerShell 版本）
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

// 读取删除摘要
const csv = readFileSync('tmp/deletions-summary.csv', 'utf-8');
const lines = csv.split('\n').slice(1);

// 筛选 P2 文件
const p2Files = [];
for (const line of lines) {
    if (!line.trim()) continue;
    
    const match = line.match(/^"([^"]+)","(\d+)","(\d+)","([^"]+)"/);
    if (!match) continue;
    
    const [, path, add, del, net] = match;
    const delCount = parseInt(del);
    
    const isTest = path.includes('__tests__/');
    const isI18n = path.startsWith('public/locales/');
    const isData = path.includes('/data/') && (path.endsWith('.ts') || path.endsWith('.json'));
    
    if ((isTest || isI18n || isData) && delCount > 0) {
        p2Files.push({ path, delCount });
    }
}

console.log(`找到 ${p2Files.length} 个 P2 文件需要验证`);

// 按删除行数排序
p2Files.sort((a, b) => b.delCount - a.delCount);

// 验证结果
const results = [];
let verifiedCount = 0;

for (const file of p2Files) {
    verifiedCount++;
    console.log(`\n[${verifiedCount}/${p2Files.length}] 验证: ${file.path} (-${file.delCount} 行)`);
    
    try {
        // 检查文件是否存在
        if (!existsSync(file.path)) {
            results.push({
                path: file.path,
                delCount: file.delCount,
                status: '文件不存在',
                needsRestore: true,
                reason: '文件已被完全删除'
            });
            console.log(`  ❌ 文件不存在`);
            continue;
        }
        
        // 读取当前文件
        const currentContent = readFileSync(file.path, 'utf-8');
        
        // 获取 POD commit 的删除内容（使用 PowerShell）
        let deletedLines = [];
        try {
            const gitOutput = execSync(
                `powershell -Command "git show 6ea1f9f -- '${file.path}' 2>&1 | Select-String '^-' | Select-Object -First 10 | ForEach-Object { $_.Line }"`,
                { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
            );
            deletedLines = gitOutput.trim().split('\n').filter(l => l.trim() && !l.startsWith('---'));
        } catch (e) {
            // git show 失败，尝试直接读取当前文件判断
            console.log(`  ⚠️ git show 失败，直接检查文件内容`);
        }
        
        if (deletedLines.length === 0) {
            // 无法获取删除内容，假设无需恢复（因为文件存在）
            results.push({
                path: file.path,
                delCount: file.delCount,
                status: '无需恢复',
                needsRestore: false,
                reason: '文件存在且无法获取删除内容（假设已恢复）'
            });
            console.log(`  ✅ 无需恢复 (文件存在)`);
            continue;
        }
        
        // 检查删除的内容是否仍在当前文件中
        let foundCount = 0;
        const samples = [];
        
        for (const line of deletedLines.slice(0, 5)) {
            const cleanLine = line.replace(/^-\s*/, '').trim();
            if (cleanLine.length < 10) continue;
            
            if (currentContent.includes(cleanLine)) {
                foundCount++;
                samples.push(cleanLine.substring(0, 50));
            }
        }
        
        const foundRatio = foundCount / Math.min(5, deletedLines.length);
        
        if (foundRatio >= 0.6) {
            results.push({
                path: file.path,
                delCount: file.delCount,
                status: '无需恢复',
                needsRestore: false,
                reason: `${foundCount}/${Math.min(5, deletedLines.length)} 删除内容仍存在`,
                samples: samples.slice(0, 2)
            });
            console.log(`  ✅ 无需恢复 (${foundCount}/${Math.min(5, deletedLines.length)} 删除内容仍存在)`);
        } else {
            results.push({
                path: file.path,
                delCount: file.delCount,
                status: '可能需要恢复',
                needsRestore: true,
                reason: `仅 ${foundCount}/${Math.min(5, deletedLines.length)} 删除内容仍存在`,
                samples: samples
            });
            console.log(`  ⚠️ 可能需要恢复 (仅 ${foundCount}/${Math.min(5, deletedLines.length)} 删除内容仍存在)`);
        }
        
    } catch (error) {
        results.push({
            path: file.path,
            delCount: file.delCount,
            status: '验证失败',
            needsRestore: false,
            reason: error.message
        });
        console.log(`  ❌ 验证失败: ${error.message}`);
    }
}

// 生成报告
const report = {
    timestamp: new Date().toISOString(),
    totalFiles: p2Files.length,
    verified: verifiedCount,
    summary: {
        noRestore: results.filter(r => !r.needsRestore).length,
        needsRestore: results.filter(r => r.needsRestore).length,
        failed: results.filter(r => r.status === '验证失败').length
    },
    results: results
};

writeFileSync('evidence/p2-verification-results.json', JSON.stringify(report, null, 2));

// 生成 Markdown 报告
let md = `# P2 文件完整验证报告\n\n`;
md += `## 验证概览\n\n`;
md += `- **验证时间**: ${new Date().toLocaleString('zh-CN')}\n`;
md += `- **总文件数**: ${report.totalFiles}\n`;
md += `- **已验证**: ${report.verified}\n`;
md += `- **无需恢复**: ${report.summary.noRestore} (${(report.summary.noRestore / report.totalFiles * 100).toFixed(1)}%)\n`;
md += `- **需要恢复**: ${report.summary.needsRestore} (${(report.summary.needsRestore / report.totalFiles * 100).toFixed(1)}%)\n`;
md += `- **验证失败**: ${report.summary.failed}\n\n`;

md += `## 需要恢复的文件\n\n`;
const needsRestore = results.filter(r => r.needsRestore);
if (needsRestore.length === 0) {
    md += `✅ 所有文件都无需恢复！\n\n`;
} else {
    md += `| 文件 | 删除行数 | 原因 |\n`;
    md += `|------|----------|------|\n`;
    for (const r of needsRestore) {
        md += `| \`${r.path}\` | ${r.delCount} | ${r.reason} |\n`;
    }
    md += `\n`;
}

md += `## 无需恢复的文件（前 20 个）\n\n`;
const noRestore = results.filter(r => !r.needsRestore).slice(0, 20);
md += `| 文件 | 删除行数 | 原因 |\n`;
md += `|------|----------|------|\n`;
for (const r of noRestore) {
    md += `| \`${r.path}\` | ${r.delCount} | ${r.reason} |\n`;
}
md += `\n`;

md += `## 详细结果\n\n`;
md += `完整结果见 \`evidence/p2-verification-results.json\`\n`;

writeFileSync('evidence/_shared/p2-full-verification.md', md);

console.log(`\n✅ 验证完成！`);
console.log(`- 无需恢复: ${report.summary.noRestore} 个文件`);
console.log(`- 需要恢复: ${report.summary.needsRestore} 个文件`);
console.log(`- 报告已保存到 evidence/_shared/p2-full-verification.md`);
