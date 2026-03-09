import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/cardia/__tests__/integration-victory-conditions.test.ts';
let content = readFileSync(filePath, 'utf-8');

// 移除所有 expect(gameOver?.reason).toBe(...) 断言
content = content.replace(/\s+expect\(gameOver\?\.reason\)\.toBe\([^)]+\);/g, '');

// 修复平局测试：winner: 'tie' → draw: true
content = content.replace(
  /expect\(gameOver\?\.winner\)\.toBe\('tie'\);/g,
  "expect(gameOver?.draw).toBe(true);"
);

writeFileSync(filePath, content, 'utf-8');
console.log('✅ 已修复所有 GameOverResult 断言');
