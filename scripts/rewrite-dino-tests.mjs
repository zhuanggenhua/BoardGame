#!/usr/bin/env node
/**
 * 重写 dino 审计测试，将错误的 API 改为正确的 runner.run() 模式
 * 
 * 错误模式：
 * ```
 * const runner = createRunner();
 * runner.setState({ ... });
 * runner.executeCommand({ ... });
 * const finalState = runner.getState();
 * ```
 * 
 * 正确模式：
 * ```
 * const runner = createRunner();
 * const result = runner.run({
 *     name: 'test name',
 *     setup: (ids, random) => {
 *         const sys = createInitialSystemState(ids, systems);
 *         const core = { ... };
 *         return { sys, core };
 *     },
 *     commands: [{ type: 'PLAY_ACTION', playerId: '0', payload: { ... } }]
 * });
 * const finalState = result.finalState;
 * ```
 */

import { readFileSync, writeFileSync } from 'fs';

// 这些测试文件需要完全重写，因为它们使用了不存在的 API
const filesToRewrite = [
    'src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts',
    'src/games/smashup/__tests__/audit-d11-d12-d14-dino-rampage.test.ts',
    'src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts',
    'src/games/smashup/__tests__/audit-d8-dino-armor-stego.test.ts',
];

console.log('这些测试文件使用了不存在的 GameTestRunner API（setState/executeCommand/getState）');
console.log('需要手动重写为使用 runner.run() 模式\n');
console.log('受影响的文件：');
filesToRewrite.forEach(f => console.log(`  - ${f}`));
console.log('\n建议：');
console.log('1. 参考 src/games/smashup/__tests__/pirate-broadside-d1-audit.test.ts 的模式');
console.log('2. 将 runner.setState() 改为 setup 函数');
console.log('3. 将 runner.executeCommand() 改为 commands 数组');
console.log('4. 将 runner.getState() 改为 result.finalState');
console.log('\n由于这是结构性重写，建议手动修改或使用更复杂的 AST 转换工具。');
