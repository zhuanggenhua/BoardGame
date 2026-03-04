#!/usr/bin/env node
/**
 * 调试 targeted-defense-damage 测试
 */

import { execSync } from 'child_process';

console.log('运行 targeted-defense-damage 测试...\n');

try {
  const output = execSync(
    'npm run test:core -- --run --reporter=verbose src/games/dicethrone/__tests__/targeted-defense-damage.test.ts',
    { 
      encoding: 'utf-8',
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, DEBUG: 'dicethrone:*' }
    }
  );
  
  // 提取关键信息
  const lines = output.split('\n');
  const relevantLines = lines.filter(line => 
    line.includes('玩家') ||
    line.includes('HP') ||
    line.includes('expected') ||
    line.includes('actual') ||
    line.includes('rollDiceCount') ||
    line.includes('footCount') ||
    line.includes('FOOT') ||
    line.includes('TARGETED') ||
    line.includes('FlowSystem') ||
    line.includes('defensiveRoll')
  );
  
  console.log('关键输出:');
  relevantLines.forEach(line => console.log(line));
  
} catch (error) {
  console.log('\n测试失败输出:');
  const lines = (error.stdout || '').split('\n');
  const relevantLines = lines.filter(line => 
    line.includes('玩家') ||
    line.includes('HP') ||
    line.includes('expected') ||
    line.includes('actual') ||
    line.includes('FAIL')
  );
  relevantLines.forEach(line => console.log(line));
}
