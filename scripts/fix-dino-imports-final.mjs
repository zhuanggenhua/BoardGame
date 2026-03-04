#!/usr/bin/env node
/**
 * 修复 dino 测试文件的 SU_COMMANDS import
 * 
 * 需要添加单独的 import { SU_COMMANDS } from '../domain/types';
 * 因为 SU_COMMANDS 是值，不是类型
 */

import { readFileSync, writeFileSync } from 'fs';

const files = [
    'src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts',
    'src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts',
    'src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts',
];

for (const file of files) {
    console.log(`\n处理文件: ${file}`);
    
    try {
        let content = readFileSync(file, 'utf-8');
        
        // 检查是否已经有 SU_COMMANDS 的单独 import
        if (content.includes("import { SU_COMMANDS }")) {
            console.log(`  ℹ️  已有 SU_COMMANDS import，跳过`);
            continue;
        }
        
        // 在 type import 后添加 SU_COMMANDS import
        const typeImportPattern = /import type \{[^}]+\} from '\.\.\/domain\/types';/;
        const match = content.match(typeImportPattern);
        
        if (match) {
            const typeImport = match[0];
            const newImport = typeImport + "\nimport { SU_COMMANDS } from '../domain/types';";
            content = content.replace(typeImport, newImport);
            
            writeFileSync(file, content, 'utf-8');
            console.log(`  ✅ 已添加 SU_COMMANDS import`);
        } else {
            console.log(`  ⚠️  未找到 type import 语句`);
        }
    } catch (error) {
        console.error(`  ❌ 处理失败:`, error.message);
    }
}

console.log(`\n✅ 完成！`);
