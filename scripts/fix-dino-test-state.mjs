#!/usr/bin/env node
/**
 * 修复 dino 测试文件中的状态初始化问题
 * 
 * 问题：手动构造的 SmashUpCore 状态缺少必需字段（baseDeck, turnNumber, nextUid）
 * 导致：getEffectivePower 计算返回 NaN
 * 
 * 修复策略：
 * 1. 在 wrapState() 调用中添加缺失的必需字段
 * 2. 使用合理的默认值：baseDeck: [], turnNumber: 1, nextUid: 100
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts',
    'src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts',
    'src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts',
];

for (const file of files) {
    console.log(`\n处理文件: ${file}`);
    
    try {
        let content = readFileSync(file, 'utf-8');
        let modified = false;
        
        // 查找 wrapState({ 后面的内容，检查是否缺少必需字段
        // 策略：在 turnOrder 行后面添加缺失字段
        
        // 匹配模式：turnOrder: [...], 后面紧跟 currentPlayerIndex
        // 在这两行之间插入缺失字段
        const pattern = /(turnOrder:\s*\[[^\]]+\],)\s*(currentPlayerIndex:\s*\d+,)/g;
        
        if (pattern.test(content)) {
            content = content.replace(
                pattern,
                (match, turnOrder, currentPlayerIndex) => {
                    // 检查是否已经有这些字段
                    const hasBaseDeck = /baseDeck:\s*\[/.test(content);
                    const hasTurnNumber = /turnNumber:\s*\d+/.test(content);
                    const hasNextUid = /nextUid:\s*\d+/.test(content);
                    
                    if (hasBaseDeck && hasTurnNumber && hasNextUid) {
                        return match; // 已经有所有字段，不修改
                    }
                    
                    // 构建要插入的字段
                    const fieldsToAdd = [];
                    if (!hasBaseDeck) fieldsToAdd.push('baseDeck: []');
                    if (!hasTurnNumber) fieldsToAdd.push('turnNumber: 1');
                    if (!hasNextUid) fieldsToAdd.push('nextUid: 100');
                    
                    return `${turnOrder}\n            ${currentPlayerIndex}\n            ${fieldsToAdd.join(',\n            ')},`;
                }
            );
            modified = true;
        }
        
        if (modified) {
            writeFileSync(file, content, 'utf-8');
            console.log(`  ✅ 已修复`);
        } else {
            console.log(`  ℹ️  无需修改或已包含必需字段`);
        }
    } catch (error) {
        console.error(`  ❌ 处理失败:`, error.message);
    }
}

console.log(`\n✅ 完成！`);
console.log(`\n建议：运行以下命令验证修复：`);
console.log(`  npm test -- audit-d8-dino-armor-stego`);
console.log(`  npm test -- audit-d31-dino-tooth-and-claw`);

