#!/usr/bin/env node
/**
 * 大杀四方测试修复脚本 - 综合修复
 * 
 * 修复内容：
 * 1. 修复 makeMinion 调用中缺失的 powerModifier 字段
 * 2. 修复 createSmashUpGame 未定义错误（替换为 SmashUpDomain）
 * 3. 修复 audit 测试中的 import 错误
 * 4. 修复 property 测试中的辅助函数调用
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const testDir = join(__dirname, '../src/games/smashup/__tests__');

let totalFiles = 0;
let totalFixes = 0;

/**
 * 修复单个文件
 */
function fixFile(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    let modified = content;
    let fileFixCount = 0;

    // Fix 1: 替换 createSmashUpGame 为 SmashUpDomain
    if (modified.includes('createSmashUpGame')) {
        // 添加 import
        if (!modified.includes('import { SmashUpDomain }')) {
            modified = modified.replace(
                /import.*from.*vitest.*;/,
                `$&\nimport { SmashUpDomain } from '../domain';`
            );
        }
        // 替换所有 createSmashUpGame() 调用
        modified = modified.replace(/new GameTestRunner\(createSmashUpGame\(\)\)/g, 
            'new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({\n' +
            '        domain: SmashUpDomain,\n' +
            '        systems: [\n' +
            '            createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),\n' +
            '            ...createBaseSystems<SmashUpCore>(),\n' +
            '        ],\n' +
            '        playerIds: PLAYER_IDS,\n' +
            '        silent: true,\n' +
            '    })');
        
        // 添加必要的 imports
        if (!modified.includes('import { createFlowSystem, createBaseSystems }')) {
            modified = modified.replace(
                /import { SmashUpDomain }/,
                `import { SmashUpDomain } from '../domain';\nimport { smashUpFlowHooks } from '../domain/index';\nimport { createFlowSystem, createBaseSystems } from '../../../engine';`
            );
        }
        
        fileFixCount++;
    }

    // Fix 2: 修复 audit 测试中的 helper imports
    if (filePath.includes('audit-') && modified.includes('from \'./helpers\'')) {
        modified = modified.replace(
            /from '\.\/helpers'/g,
            "from './helpers/auditUtils'"
        );
        fileFixCount++;
    }

    // Fix 3: 修复 makeMinion 调用中缺失 powerModifier 的情况
    // 匹配模式: makeMinion('id', 'defId', 'controller', power) 后面没有 overrides 参数
    const makeMinionPattern = /makeMinion\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*,\s*(\d+)\s*\)(?!\s*,)/g;
    
    let match;
    const replacements = [];
    while ((match = makeMinionPattern.exec(content)) !== null) {
        const [fullMatch, uid, defId, controller, power] = match;
        // 检查这个 minion 是否在后续代码中被赋值了 powerModifier
        const afterCode = content.slice(match.index + fullMatch.length, match.index + fullMatch.length + 500);
        
        // 如果后续没有显式设置 powerModifier，添加默认值
        if (!afterCode.includes(`${uid}.powerModifier`) && !afterCode.includes(`powerModifier: 0`)) {
            replacements.push({
                original: fullMatch,
                replacement: `makeMinion('${uid}', '${defId}', '${controller}', ${power}, { powerModifier: 0 })`
            });
        }
    }

    // 应用替换（从后往前，避免索引偏移）
    for (const { original, replacement } of replacements.reverse()) {
        modified = modified.replace(original, replacement);
        fileFixCount++;
    }

    // Fix 4: 修复 property 测试中的 getAllCardDefs 调用
    if (filePath.includes('property.test.ts')) {
        // 确保 import 了 getAllCardDefs
        if (modified.includes('getAllCardDefs') && !modified.includes('import { getAllCardDefs')) {
            modified = modified.replace(
                /import.*from.*auditUtils.*;/,
                `$&\nimport { getAllCardDefs } from '../../data/cards';`
            );
            fileFixCount++;
        }
    }

    // 只有在有修改时才写入
    if (modified !== content) {
        writeFileSync(filePath, modified, 'utf-8');
        totalFiles++;
        totalFixes += fileFixCount;
        console.log(`✅ Fixed ${filePath} (${fileFixCount} fixes)`);
        return true;
    }

    return false;
}

/**
 * 递归处理目录
 */
function processDirectory(dir) {
    const entries = readdirSync(dir);
    
    for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else if (entry.endsWith('.test.ts')) {
            try {
                fixFile(fullPath);
            } catch (error) {
                console.error(`❌ Error processing ${fullPath}:`, error.message);
            }
        }
    }
}

// 执行修复
console.log('🔧 Starting comprehensive SmashUp test fixes...\n');
processDirectory(testDir);
console.log(`\n✨ Done! Fixed ${totalFiles} files with ${totalFixes} total fixes.`);
