#!/usr/bin/env node
/**
 * 修复 dino 测试文件的 import 和 createRunner 函数
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
    
    // Replace buildSystems import
    if (content.includes('import { buildSystems }')) {
        content = content.replace(
            /import { buildSystems } from '\.\.\/domain\/systems';/g,
            `import { createFlowSystem, createBaseSystems } from '../../../engine/systems';`
        );
        console.log(`  ✓ Fixed buildSystems import`);
    }
    
    // Add smashUpFlowHooks to SmashUpDomain import
    if (content.includes(`import { SmashUpDomain } from '../game';`) && !content.includes('smashUpFlowHooks')) {
        content = content.replace(
            /import { SmashUpDomain } from '\.\.\/game';/g,
            `import { SmashUpDomain, smashUpFlowHooks } from '../game';`
        );
        console.log(`  ✓ Added smashUpFlowHooks import`);
    }
    
    // Fix createRunner function
    if (content.includes('systems: buildSystems()')) {
        content = content.replace(
            /function createRunner\(\) {\s+return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>\({\s+domain: SmashUpDomain,\s+systems: buildSystems\(\),\s+playerIds: \['0', '1'\],\s+}\);?\s+}/g,
            `function createRunner() {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: ['0', '1'],
    });
}`
        );
        console.log(`  ✓ Fixed createRunner function`);
    }
    
    // Write back if changed
    if (content !== originalContent) {
        writeFileSync(file, content, 'utf-8');
        console.log(`  ✅ File updated`);
    } else {
        console.log(`  ℹ️  No changes needed`);
    }
}

console.log('\n✅ Done!');
