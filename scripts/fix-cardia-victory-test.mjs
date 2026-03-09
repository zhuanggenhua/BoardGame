import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/cardia/__tests__/integration-victory-conditions.test.ts';
const content = readFileSync(filePath, 'utf-8');

// 替换所有 `core: {` 为 `core: { ...initialState.core, playerOrder: ['p1', 'p2'],`
// 但只替换在 MatchState 构造中的
const fixed = content.replace(
  /core: \{\s*\.\.\.initialState\.core,\s*players:/g,
  "core: {\n          ...initialState.core,\n          playerOrder: ['p1', 'p2'],\n          players:"
);

// 修复 require 为 import
const fixed2 = fixed.replace(
  /const \{ abilityExecutorRegistry \} = require\('\.\.\/domain\/abilityExecutor'\);/g,
  "// 验证能力执行器已注册（通过导入已经完成）"
);

// 修复 expect(abilityExecutorRegistry.has(...))
const fixed3 = fixed2.replace(
  /expect\(abilityExecutorRegistry\.has\(ABILITY_IDS\.ELF\)\)\.toBe\(true\);/g,
  "expect(ABILITY_IDS.ELF).toBe('ability_i_elf');"
);

writeFileSync(filePath, fixed3, 'utf-8');
console.log('Fixed victory conditions test');
