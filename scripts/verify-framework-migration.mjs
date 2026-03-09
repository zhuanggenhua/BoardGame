#!/usr/bin/env node
/**
 * 验证框架迁移是否成功
 * 
 * 检查项：
 * 1. App.tsx 中不再有旧的 /test 路由
 * 2. App.tsx 中保留新的 /play/:gameId → TestMatchRoom 映射
 * 3. GameTestContext.ts 中 openTestGame 不再使用 /test 路由
 * 4. 所有测试文件不再使用 page.goto('/play/.../test')
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let hasErrors = false;

function checkFile(filePath, checks) {
    try {
        const content = readFileSync(filePath, 'utf-8');
        
        for (const check of checks) {
            if (check.shouldNotContain) {
                if (content.includes(check.shouldNotContain)) {
                    console.error(`❌ ${filePath}: 不应该包含 "${check.shouldNotContain}"`);
                    if (check.context) {
                        const lines = content.split('\n');
                        const lineIndex = lines.findIndex(line => line.includes(check.shouldNotContain));
                        if (lineIndex !== -1) {
                            console.error(`   第 ${lineIndex + 1} 行: ${lines[lineIndex].trim()}`);
                        }
                    }
                    hasErrors = true;
                } else {
                    console.log(`✅ ${filePath}: 已移除 "${check.shouldNotContain}"`);
                }
            }
            
            if (check.shouldContain) {
                if (!content.includes(check.shouldContain)) {
                    console.error(`❌ ${filePath}: 应该包含 "${check.shouldContain}"`);
                    hasErrors = true;
                } else {
                    console.log(`✅ ${filePath}: 包含 "${check.shouldContain}"`);
                }
            }
        }
    } catch (error) {
        console.error(`❌ 无法读取文件 ${filePath}:`, error.message);
        hasErrors = true;
    }
}

function findE2ETests(dir, files = []) {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
            if (entry !== 'node_modules' && entry !== '.git') {
                findE2ETests(fullPath, files);
            }
        } else if (entry.endsWith('.e2e.ts')) {
            files.push(fullPath);
        }
    }
    
    return files;
}

console.log('🔍 验证框架迁移...\n');

// 1. 检查 App.tsx
console.log('📝 检查 App.tsx...');
checkFile(join(rootDir, 'src/App.tsx'), [
    { shouldNotContain: 'path="/play/:gameId/test"', context: true },
    { shouldContain: 'const TestMatchRoom = React.lazy(() => import(\'./pages/TestMatchRoom\')' },
    { shouldContain: '<Route path="/play/:gameId" element={<React.Suspense fallback={<LoadingScreen />}><TestMatchRoom /></React.Suspense>} />' },
]);

// 2. 检查 GameTestContext.ts
console.log('\n📝 检查 GameTestContext.ts...');
checkFile(join(rootDir, 'e2e/framework/GameTestContext.ts'), [
    { shouldNotContain: '/play/${gameId}/test', context: true },
    { shouldContain: 'const url = `/play/${gameId}`;' },
]);

// 3. 检查所有 E2E 测试文件
console.log('\n📝 检查 E2E 测试文件...');
const e2eTests = findE2ETests(join(rootDir, 'e2e'));
let testFilesChecked = 0;
let testFilesWithOldPattern = 0;

for (const testFile of e2eTests) {
    const content = readFileSync(testFile, 'utf-8');
    const relativePath = testFile.replace(rootDir, '').replace(/\\/g, '/');
    
    // 检查是否使用旧的 /test 路由（更精确的匹配：goto 调用中包含 /test）
    const lines = content.split('\n');
    let hasOldPattern = false;
    
    lines.forEach((line, index) => {
        // 匹配 goto('/play/.../test') 或 goto("/play/.../test")
        if (line.includes('goto(') && /goto\(['"]\/play\/[^'"]*\/test/.test(line)) {
            if (!hasOldPattern) {
                console.error(`❌ ${relativePath}: 仍在使用旧的 /test 路由`);
                hasOldPattern = true;
            }
            console.error(`   第 ${index + 1} 行: ${line.trim()}`);
        }
    });
    
    if (hasOldPattern) {
        testFilesWithOldPattern++;
        hasErrors = true;
    }
    
    testFilesChecked++;
}

console.log(`\n✅ 检查了 ${testFilesChecked} 个 E2E 测试文件`);
if (testFilesWithOldPattern > 0) {
    console.error(`❌ ${testFilesWithOldPattern} 个文件仍在使用旧的 /test 路由`);
} else {
    console.log(`✅ 所有测试文件已迁移到新框架`);
}

// 4. 总结
console.log('\n' + '='.repeat(50));
if (hasErrors) {
    console.error('❌ 验证失败：发现问题');
    process.exit(1);
} else {
    console.log('✅ 验证成功：框架迁移完成');
    process.exit(0);
}
