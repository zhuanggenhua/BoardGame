import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

console.log('🔍 Finding dino test files...');
const testDir = 'src/games/smashup/__tests__';
const allFiles = readdirSync(testDir);
const files = allFiles
    .filter(f => f.startsWith('audit-d') && f.includes('dino') && f.endsWith('.test.ts'))
    .map(f => join(testDir, f));
console.log(`   Found ${files.length} dino test files`);

for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    let content = readFileSync(file, 'utf-8');
    let modified = false;

    // Pattern 1: const finalState = runner.getState().core; 后面访问 finalState.sys
    // 需要改为: const state = runner.getState(); 然后访问 state.sys 和 state.core
    const pattern1 = /const finalState = runner\.getState\(\)\.core;[\s\S]*?expect\(finalState\.sys/g;
    if (pattern1.test(content)) {
        console.log('   ✓ Found getState().core with .sys access');
        content = content.replace(
            /const finalState = runner\.getState\(\)\.core;/g,
            'const state = runner.getState();'
        );
        content = content.replace(
            /finalState\.sys/g,
            'state.sys'
        );
        content = content.replace(
            /finalState\.bases/g,
            'state.core.bases'
        );
        content = content.replace(
            /finalState\.players/g,
            'state.core.players'
        );
        modified = true;
    }

    // Pattern 2: const state = runner.getState(); 后面访问 state.core.players[...]
    // 这个是正确的，不需要修改

    if (modified) {
        writeFileSync(file, content, 'utf-8');
        console.log('   ✅ File updated');
    } else {
        console.log('   ℹ️  No changes needed');
    }
}

console.log('\n✅ Done!');
