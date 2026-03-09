import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/cardia/__tests__/integration-victory-conditions.test.ts';
const content = readFileSync(filePath, 'utf-8');

// 替换所有 CardiaDomain.isGameOver(state) 为 CardiaDomain.isGameOver(state.core)
const newContent = content.replace(
  /CardiaDomain\.isGameOver\(state\)/g,
  'CardiaDomain.isGameOver(state.core)'
);

writeFileSync(filePath, newContent, 'utf-8');
console.log('✅ 已修复所有 isGameOver 调用');
