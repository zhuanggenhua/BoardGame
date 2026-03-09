#!/usr/bin/env node
/**
 * 批量修复 E2E 测试文件中的导入和函数调用
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';

const files = readdirSync('e2e').filter(f => f.startsWith('cardia-') && f.endsWith('.e2e.ts'));

for (const filename of files) {
    const file = `e2e/${filename}`;
    console.log(`Processing ${file}...`);
    
    let content = readFileSync(file, 'utf-8');
    let modified = false;
    
    // 1. 修复导入语句
    if (content.includes("import { setupOnlineMatch")) {
        content = content.replace(
            /import \{ setupOnlineMatch(.*?) \} from '\.\/helpers\/cardia'/g,
            "import { setupCardiaOnlineMatch$1, cleanupCardiaMatch } from './helpers/cardia'"
        );
        modified = true;
        console.log(`  ✓ Fixed import statement`);
    }
    
    // 2. 修复 setupOnlineMatch 调用
    if (content.includes("await setupOnlineMatch(")) {
        content = content.replace(/await setupOnlineMatch\(/g, "await setupCardiaOnlineMatch(");
        modified = true;
        console.log(`  ✓ Fixed setupOnlineMatch calls`);
    }
    
    // 3. 修复解构语法
    if (content.includes("{ page: p1Page, page2: p2Page")) {
        content = content.replace(
            /\{ page: p1Page, page2: p2Page, cleanup \}/g,
            "{ hostPage: p1Page, guestPage: p2Page }"
        );
        modified = true;
        console.log(`  ✓ Fixed destructuring syntax`);
    }
    
    // 4. 修复 cleanup() 调用
    if (content.includes("await cleanup()")) {
        content = content.replace(/await cleanup\(\)/g, "await cleanupCardiaMatch(setup)");
        modified = true;
        console.log(`  ✓ Fixed cleanup calls`);
    }
    
    if (modified) {
        writeFileSync(file, content, 'utf-8');
        console.log(`  ✅ ${file} updated`);
    } else {
        console.log(`  ⏭️  ${file} already up to date`);
    }
}

console.log('\n✅ All files processed');
