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

    // 检查是否已经有 initAllAbilities
    if (content.includes('initAllAbilities')) {
        console.log('   ℹ️  Already has initAllAbilities');
        continue;
    }

    // 检查是否已经有 beforeAll
    if (content.includes('beforeAll')) {
        console.log('   ⚠️  Already has beforeAll, skipping');
        continue;
    }

    // 添加 import
    if (!content.includes("import { initAllAbilities } from '../abilities';")) {
        content = content.replace(
            /import type { SmashUpCore } from '\.\.\/domain\/types';/,
            `import type { SmashUpCore } from '../domain/types';\nimport { initAllAbilities } from '../abilities';`
        );
        modified = true;
        console.log('   ✓ Added import');
    }

    // 添加 beforeAll
    const beforeAllCode = `\n\nbeforeAll(() => {\n    initAllAbilities();\n});\n`;
    content = content.replace(
        /\n\nfunction createRunner\(\)/,
        `${beforeAllCode}\nfunction createRunner()`
    );
    modified = true;
    console.log('   ✓ Added beforeAll');

    if (modified) {
        writeFileSync(file, content, 'utf-8');
        console.log('   ✅ File updated');
    }
}

console.log('\n✅ Done!');
