#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/__tests__/duplicateInteractionRespond.test.ts';
const content = readFileSync(filePath, 'utf-8');

// 替换所有 powerModifier: 1 为 powerCounters: 1
const fixed = content.replace(/powerModifier: 1/g, 'powerCounters: 1');

// 同时修复断言：powerModifier 改为 powerCounters
const fixed2 = fixed.replace(
    /expect\(droneAfter2!\.powerModifier\)\.toBe\(0\);/g,
    'expect(droneAfter2!.powerCounters).toBe(0);'
);

writeFileSync(filePath, fixed2, 'utf-8');
console.log('✅ 已修复 duplicateInteractionRespond 测试数据');
