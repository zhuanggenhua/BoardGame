#!/usr/bin/env node
/**
 * 修复 GameTestRunner API 使用错误
 * 
 * 问题：部分测试使用了旧的 API `new GameTestRunner<SmashUpCore>('smashup')`
 * 正确：应该使用 `new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({ domain, systems, playerIds })`
 * 
 * 修复策略：
 * 1. 查找所有使用旧 API 的测试文件
 * 2. 添加必要的 import
 * 3. 创建 createRunner 辅助函数
 * 4. 替换所有 `new GameTestRunner<SmashUpCore>('smashup')` 为 `createRunner()`
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const testDir = 'src/games/smashup/__tests__';
const allFiles = readdirSync(testDir);
const files = allFiles
    .filter(f => f.startsWith('audit-d') && f.endsWith('.test.ts'))
    .map(f => join(testDir, f));

console.log(`Found ${files.length} audit test files`);

for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    
    let content = readFileSync(file, 'utf-8');
    const originalContent = content;
    
    // Check if file uses old API
    if (!content.includes(`new GameTestRunner<SmashUpCore>('smashup')`)) {
        console.log(`  ✓ Already using correct API`);
        continue;
    }
    
    // Add imports if not present
    if (!content.includes('import { SmashUpDomain }')) {
        const importLine = `import { describe, it, expect } from 'vitest';`;
        content = content.replace(
            importLine,
            `${importLine}\nimport { SmashUpDomain, smashUpFlowHooks } from '../game';\nimport type { SmashUpCommand, SmashUpEvent } from '../domain/types';\nimport { createFlowSystem, createBaseSystems } from '../../../engine/systems';`
        );
    }
    
    // Add createRunner function after imports
    const describeMatch = content.match(/describe\(/);
    if (describeMatch) {
        const insertPos = describeMatch.index;
        const createRunnerFn = `
function createRunner() {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: ['0', '1'],
    });
}

`;
        content = content.slice(0, insertPos) + createRunnerFn + content.slice(insertPos);
    }
    
    // Replace all occurrences of old API
    content = content.replace(
        /const runner = new GameTestRunner<SmashUpCore>\('smashup'\);/g,
        'const runner = createRunner();'
    );
    
    // Write back if changed
    if (content !== originalContent) {
        writeFileSync(file, content, 'utf-8');
        console.log(`  ✓ Fixed`);
    } else {
        console.log(`  ✗ No changes made`);
    }
}

console.log('\n✅ Done!');
