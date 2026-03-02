#!/usr/bin/env node
/**
 * 完整修复 dino 测试
 * 1. 修复 setState 调用（添加 wrapState 和闭合括号）
 * 2. 修复 getState 调用（添加 .core）
 * 3. 修复 executeCommand 调用（修改参数格式）
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
    
    // 1. 修复 setState 调用的闭合括号
    // 查找所有 runner.setState(wrapState({ ... }); 模式，在最后的 }); 前添加一个 )
    content = content.replace(
        /runner\.setState\(wrapState\(\{([\s\S]*?)\}\);/g,
        (match, innerContent) => {
            return `runner.setState(wrapState({${innerContent}}));`;
        }
    );
    console.log(`  ✓ Fixed setState closing parentheses`);
    
    // 2. 修复 getState 调用
    // runner.getState() → runner.getState().core
    content = content.replace(
        /const finalState = runner\.getState\(\);/g,
        'const finalState = runner.getState().core;'
    );
    console.log(`  ✓ Fixed getState calls`);
    
    // 3. 修复 executeCommand 调用
    // runner.executeCommand({ type: 'PLAY_ACTION', playerId: '0', cardUid: 'a1', targetBaseIndex: 0 })
    // → runner.executeCommand('PLAY_ACTION', { playerId: '0', cardUid: 'a1', targetBaseIndex: 0 })
    content = content.replace(
        /runner\.executeCommand\(\{\s*type:\s*'([^']+)',\s*playerId:\s*'([^']+)',\s*([^}]+)\}\);/g,
        (match, type, playerId, rest) => {
            return `runner.executeCommand('${type}', { playerId: '${playerId}', ${rest}});`;
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
