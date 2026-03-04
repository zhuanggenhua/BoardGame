#!/usr/bin/env node
/**
 * 修复测试中错误使用 POWER_COUNTER_ADDED 而应该使用 TEMP_POWER_ADDED 的问题
 * 
 * 临时力量修正（回合结束清零）应该使用 TEMP_POWER_ADDED 事件
 * 力量指示物（永久）才使用 POWER_COUNTER_ADDED 事件
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('src/games/smashup/__tests__/**/*.test.ts');

let totalFixed = 0;

for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    let modified = content;
    let fileFixed = 0;

    // 修复模式1: expect(minion.powerModifier).toBe(X) 在 reduce 验证中
    // 这些应该检查 TEMP_POWER_ADDED 事件而不是 powerModifier 字段
    // 但这需要更复杂的上下文分析，暂时跳过

    // 修复模式2: filter(e => e.type === SU_EVENTS.POWER_COUNTER_ADDED)
    // 应该改为 TEMP_POWER_ADDED（如果是临时力量修正）
    const powerCounterPattern = /filter\(e => e\.type === SU_EVENTS\.POWER_COUNTER_ADDED\)/g;
    const matches = content.match(powerCounterPattern);
    if (matches) {
        // 需要检查上下文判断是否应该改为 TEMP_POWER_ADDED
        // 暂时不自动修改，需要人工判断
    }

    if (modified !== content) {
        writeFileSync(file, modified, 'utf-8');
        totalFixed += fileFixed;
        console.log(`✅ ${file}: 修复 ${fileFixed} 处`);
    }
}

console.log(`\n总计修复: ${totalFixed} 处`);
