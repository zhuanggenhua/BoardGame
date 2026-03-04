#!/usr/bin/env node
/**
 * 运行 DiceThrone 失败的测试并输出详细信息
 */

import { execSync } from 'child_process';

const tests = [
  'src/games/dicethrone/__tests__/targeted-defense-damage.test.ts',
  'src/games/dicethrone/__tests__/monk-vs-shadow-thief-shield.test.ts',
  'src/games/dicethrone/__tests__/undo-after-card-give-hand.test.ts',
];

console.log('运行 DiceThrone 失败的测试...\n');

for (const test of tests) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`测试文件: ${test}`);
  console.log('='.repeat(80));
  
  try {
    const output = execSync(
      `npm run test:core -- --run --reporter=verbose ${test}`,
      { 
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024
      }
    );
    console.log(output);
  } catch (error) {
    console.log(error.stdout || error.message);
    console.log('\n失败输出:');
    console.log(error.stderr || '');
  }
}
