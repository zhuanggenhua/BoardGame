#!/usr/bin/env node
/**
 * 架构守卫脚本
 * 
 * 检查框架层（engine/、systems/）是否违反解耦原则：
 * 1. 禁止 import 游戏层模块（games/）
 * 2. 禁止包含游戏特定术语
 * 
 * 使用方式：
 *   node scripts/infra/check-architecture.js
 *   npm run check:arch
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../..', 'src');

// 框架层目录
const FRAMEWORK_DIRS = ['engine', 'systems'];

// 禁止的 import 模式（框架层不应 import 游戏层）
const FORBIDDEN_IMPORTS = [
    /from\s+['"].*\/games\//,
    /import\s+.*from\s+['"].*\/games\//,
];

// 游戏特定术语（出现在框架层可能是耦合信号）
const GAME_SPECIFIC_TERMS = [
    // DiceThrone 特有
    /\bMonk\b/i,
    /\bfist\b/,
    /\bpalm\b/,
    /\btaiji\b/,
    /\blotus\b/,
    /\bDiceThrone\b/i,
    // 通用游戏术语但过于具体
    /\bsmallStraight\b/,
    /\blargeStraight\b/,
];

// 例外文件（允许包含游戏术语的框架文件）
const EXCEPTIONS = [
    // 类型定义中的条件类型名称（向后兼容）
    'systems/AbilitySystem/conditions.ts',
    // 通用骰子系统（smallStraight/largeStraight 是通用骰子规则，不是特定游戏）
    'systems/DiceSystem/',
    // 类型定义中的注释示例
    'systems/AbilitySystem/types.ts',
];

let errors = [];
let warnings = [];

function isException(filePath) {
    const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
    return EXCEPTIONS.some(exc => relativePath.includes(exc));
}

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
    const lines = content.split('\n');

    // 检查禁止的 import
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const pattern of FORBIDDEN_IMPORTS) {
            if (pattern.test(line)) {
                errors.push({
                    file: relativePath,
                    line: i + 1,
                    message: `框架层禁止 import 游戏层: ${line.trim()}`,
                });
            }
        }
    }

    // 检查游戏特定术语（除非是例外文件）
    if (!isException(filePath)) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 跳过注释
            if (line.trim().startsWith('//') || line.trim().startsWith('*')) continue;
            
            for (const pattern of GAME_SPECIFIC_TERMS) {
                if (pattern.test(line)) {
                    warnings.push({
                        file: relativePath,
                        line: i + 1,
                        message: `可能包含游戏特定术语: ${line.trim().substring(0, 80)}`,
                        pattern: pattern.toString(),
                    });
                }
            }
        }
    }
}

function walkDir(dir, callback) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            // 跳过 node_modules 和 __tests__
            if (file === 'node_modules' || file === '__tests__') continue;
            walkDir(filePath, callback);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            callback(filePath);
        }
    }
}

console.log('🔍 检查框架层解耦...\n');

for (const frameworkDir of FRAMEWORK_DIRS) {
    const fullPath = path.join(SRC_DIR, frameworkDir);
    if (fs.existsSync(fullPath)) {
        walkDir(fullPath, checkFile);
    }
}

// 输出结果
if (errors.length > 0) {
    console.log('❌ 错误（必须修复）：\n');
    for (const err of errors) {
        console.log(`  ${err.file}:${err.line}`);
        console.log(`    ${err.message}\n`);
    }
}

if (warnings.length > 0) {
    console.log('⚠️  警告（建议检查）：\n');
    for (const warn of warnings) {
        console.log(`  ${warn.file}:${warn.line}`);
        console.log(`    ${warn.message}\n`);
    }
}

if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ 框架层解耦检查通过！\n');
}

// 返回退出码
process.exit(errors.length > 0 ? 1 : 0);
