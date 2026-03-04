#!/usr/bin/env node
/**
 * 检查所有能力文件中缺失 displayMode 的卡牌选项
 * 
 * 规则：
 * - 包含 cardUid 的选项应该使用 displayMode: 'card'
 * - 跳过/确认/完成等按钮应该使用 displayMode: 'button'
 * - 已有 displayMode 的跳过检查
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const ABILITIES_DIR = 'src/games/smashup/abilities';

// 检查单个文件
function checkFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const issues = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNum = i + 1;
        
        // 跳过已有 displayMode 的行
        if (line.includes('displayMode:')) continue;
        
        // 跳过注释
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
        
        // 检查包含 cardUid 的选项定义
        if (line.includes('value:') && line.includes('cardUid')) {
            // 检查是否在对象字面量中（有 id: 和 label:）
            const hasId = line.includes('id:') || (i > 0 && lines[i-1].includes('id:'));
            const hasLabel = line.includes('label:') || (i > 0 && lines[i-1].includes('label:'));
            
            if (hasId || hasLabel) {
                // 检查接下来几行是否有 displayMode
                let hasDisplayMode = false;
                for (let j = i; j < Math.min(i + 3, lines.length); j++) {
                    if (lines[j].includes('displayMode:')) {
                        hasDisplayMode = true;
                        break;
                    }
                    // 如果遇到新的对象或语句结束，停止检查
                    if (lines[j].includes('}') || lines[j].includes(';')) break;
                }
                
                if (!hasDisplayMode) {
                    // 检查是否是特殊情况（_source: 'static' 等）
                    let hasSpecialMarker = false;
                    for (let j = Math.max(0, i - 2); j < Math.min(i + 3, lines.length); j++) {
                        if (lines[j].includes('_source:') || lines[j].includes('// 已有')) {
                            hasSpecialMarker = true;
                            break;
                        }
                    }
                    
                    if (!hasSpecialMarker) {
                        issues.push({
                            line: lineNum,
                            content: line.trim(),
                            type: 'missing_card_displayMode'
                        });
                    }
                }
            }
        }
        
        // 检查跳过/完成选项是否有 displayMode
        if (line.includes('value:') && 
            (line.includes('skip: true') || line.includes('done: true') || line.includes('cancel: true'))) {
            const hasId = line.includes('id:') || (i > 0 && lines[i-1].includes('id:'));
            const hasLabel = line.includes('label:') || (i > 0 && lines[i-1].includes('label:'));
            
            if (hasId || hasLabel) {
                let hasDisplayMode = false;
                for (let j = i; j < Math.min(i + 3, lines.length); j++) {
                    if (lines[j].includes('displayMode:')) {
                        hasDisplayMode = true;
                        break;
                    }
                    if (lines[j].includes('}') || lines[j].includes(';')) break;
                }
                
                if (!hasDisplayMode) {
                    issues.push({
                        line: lineNum,
                        content: line.trim(),
                        type: 'missing_button_displayMode'
                    });
                }
            }
        }
    }
    
    return issues;
}

// 主函数
function main() {
    const files = readdirSync(ABILITIES_DIR)
        .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))
        .map(f => join(ABILITIES_DIR, f));
    
    const allIssues = {};
    let totalIssues = 0;
    
    for (const file of files) {
        const issues = checkFile(file);
        if (issues.length > 0) {
            allIssues[file] = issues;
            totalIssues += issues.length;
        }
    }
    
    // 输出结果
    console.log('='.repeat(80));
    console.log('DisplayMode 检查报告');
    console.log('='.repeat(80));
    console.log();
    
    if (totalIssues === 0) {
        console.log('✅ 未发现问题');
        return;
    }
    
    console.log(`⚠️  发现 ${totalIssues} 个潜在问题\n`);
    
    for (const [file, issues] of Object.entries(allIssues)) {
        const fileName = file.replace('src/games/smashup/abilities/', '');
        console.log(`\n📄 ${fileName} (${issues.length} 个问题)`);
        console.log('-'.repeat(80));
        
        for (const issue of issues) {
            const typeLabel = issue.type === 'missing_card_displayMode' 
                ? '缺少 displayMode: "card"' 
                : '缺少 displayMode: "button"';
            console.log(`  行 ${issue.line}: ${typeLabel}`);
            console.log(`    ${issue.content}`);
        }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`总计: ${totalIssues} 个潜在问题`);
    console.log('='.repeat(80));
}

main();
