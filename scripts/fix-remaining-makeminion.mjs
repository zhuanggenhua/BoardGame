#!/usr/bin/env node
/**
 * 修复剩余的 makeMinion 调用中缺失 powerModifier 的问题
 * 
 * 针对性修复：
 * 1. makeMinion('id', 'defId', 'controller', power) 没有第5个参数的情况
 * 2. 确保所有 minion 都有 powerModifier: 0
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/__tests__/newFactionAbilities.test.ts';

console.log('🔧 Fixing remaining makeMinion calls in newFactionAbilities.test.ts...\n');

const content = readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const newLines = [];

for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // 匹配 makeMinion('id', 'defId', 'controller', number) 后面没有 , { 的情况
    // 例如: makeMinion('m0', 'test', '0', 3)
    const pattern = /makeMinion\((['"])([^'"]+)\1,\s*(['"])([^'"]+)\3,\s*(['"])([^'"]+)\5,\s*(\d+)\)(?!\s*,\s*\{)/g;
    
    let match;
    let modified = line;
    const replacements = [];
    
    while ((match = pattern.exec(line)) !== null) {
        const [fullMatch, , uid, , defId, , controller, power] = match;
        const replacement = `makeMinion('${uid}', '${defId}', '${controller}', ${power}, { powerModifier: 0 })`;
        replacements.push({ original: fullMatch, replacement });
    }
    
    // 从后往前替换，避免索引偏移
    for (const { original, replacement } of replacements.reverse()) {
        modified = modified.replace(original, replacement);
    }
    
    if (modified !== line) {
        console.log(`Line ${i + 1}: Fixed makeMinion call`);
    }
    
    newLines.push(modified);
}

const newContent = newLines.join('\n');

if (newContent !== content) {
    writeFileSync(filePath, newContent, 'utf-8');
    console.log('\n✅ Fixed newFactionAbilities.test.ts');
} else {
    console.log('\n✨ No changes needed');
}
