#!/usr/bin/env node
/**
 * 调试盘旋机器人测试
 * 运行测试并输出详细的状态信息
 */

import { execSync } from 'child_process';

console.log('=== 运行盘旋机器人测试（详细模式）===\n');

try {
    const output = execSync(
        'npm run test -- src/games/smashup/__tests__/robot-hoverbot-chain.test.ts -t "应该正确处理连续打出两个盘旋机器人" --run --reporter=verbose',
        { encoding: 'utf-8', stdio: 'pipe' }
    );
    console.log(output);
} catch (error) {
    console.log('测试失败，输出：');
    console.log(error.stdout);
    console.log('\n错误信息：');
    console.log(error.stderr);
}
