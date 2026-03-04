#!/usr/bin/env node
/**
 * 修复剩余的 PR #5 测试失败
 * 
 * 已修复：
 * - base_laboratorium / base_moot_site (2个) ✅
 * - duplicateInteractionRespond (1个) ✅
 * 
 * 剩余需要修复的问题：
 * 1. cthulhu_complete_the_ritual - 打出约束验证
 * 2. pirate_first_mate - 交互链断裂
 * 3. giant_ant 交互问题 (2个)
 * 4. frankenstein_monster - POWER_COUNTER_REMOVED
 * 5. robot_hoverbot (2个)
 * 6. zombie_theyre_coming_to_get_you - POD版本配额
 * 7. innsmouth_the_deep_ones / miskatonic_mandatory_reading - 已正确实现，可能是测试问题
 */

console.log('开始分析剩余测试失败...\n');

// 运行测试获取详细错误信息
import { execSync } from 'child_process';

const failingTests = [
    'src/games/smashup/__tests__/expansionAbilities.test.ts',
    'src/games/smashup/__tests__/interactionChainE2E.test.ts',
    'src/games/smashup/__tests__/newFactionAbilities.test.ts',
    'src/games/smashup/__tests__/robot-hoverbot-chain.test.ts',
    'src/games/smashup/__tests__/zombieInteractionChain.test.ts',
    'src/games/smashup/__tests__/cthulhuExpansionAbilities.test.ts',
    'src/games/smashup/__tests__/madnessAbilities.test.ts',
];

console.log('剩余失败的测试文件：');
failingTests.forEach((test, i) => {
    console.log(`${i + 1}. ${test}`);
});

console.log('\n建议逐个运行测试查看具体错误：');
console.log('npm test -- --run <test-file>');
