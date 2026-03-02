#!/usr/bin/env node
/**
 * 完整修复所有 executeCommand 调用
 * 包括只有 type 和 playerId 的简单情况
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const testDir = 'src/games/smashup/__tests__';
const allFiles = readdirSync(testDir);
const files = allFiles
    .filter(f => (f.startsWith('audit-d1-d8-d33-dino') || f.startsWith('audit-d11') || f.startsWith('audit-d31') || f.startsWith('audit-d8-dino')) && f.endsWith('.test.ts'))
    .map(f => join(testDir, f));

console.log(`Found ${files.length} dino test files`);

for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    
    let content = readFileSync(file, 'utf-8');
    const originalContent = content;
    
    // 修复所有 executeCommand 调用
    // 模式 1: { type: 'X', playerId: 'Y', ...rest }
    content = content.replace(
        /runner\.executeCommand\(\{\s*type:\s*'([^']+)',\s*playerId:\s*'([^']+)'(,\s*([^}]+))?\s*\}\);/g,
        (match, type, playerId, commaAndRest, rest) => {
            if (rest) {
                return `runner.executeCommand('${type}', { playerId: '${playerId}', ${rest}});`;
            } else {
                return `runner.executeCommand('${type}', { playerId: '${playerId}' });`;
            }
        }
    );
    
    console.log(`  ✓ Fixed executeCommand calls`);
    
    // Write back if changed
    if (content !== originalContent) {
        writeFileSync(file, content, 'utf-8');
        console.log(`  ✅ File updated`);
    } else {
        console.log(`  ℹ️  No changes needed`);
    }
}

console.log('\n✅ Done!');
