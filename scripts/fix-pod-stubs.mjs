#!/usr/bin/env node
/**
 * 批量替换 podStubs.ts 中的占位符调用
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/abilities/podStubs.ts';
let content = readFileSync(filePath, 'utf-8');

// 替换所有 registerTrigger 的 () => ({ events: [] })
content = content.replace(
    /registerTrigger\('([^']+)',\s*'onTurnStart',\s*\(\)\s*=>\s*\(\{\s*events:\s*\[\]\s*\}\)\)/g,
    "registerTrigger('$1', 'onTurnStart', createPodStubTrigger('$1'))"
);

// 替换所有 registerProtection 的 () => false
content = content.replace(
    /registerProtection\('([^']+)',\s*\(\)\s*=>\s*false\)/g,
    "registerProtection('$1', createPodStubProtection('$1'))"
);

writeFileSync(filePath, content, 'utf-8');
console.log('✅ 已批量替换 podStubs.ts 中的占位符调用');
