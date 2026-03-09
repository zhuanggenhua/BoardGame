import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/cardia/__tests__/integration-ability-trigger.test.ts';
let content = readFileSync(filePath, 'utf-8');

// 修复 ACTIVATE_ABILITY 命令结构
// 从: { type: CARDIA_COMMANDS.ACTIVATE_ABILITY, playerId: 'p1', encounterIndex: 0, abilityId: ABILITY_IDS.XXX }
// 到: { type: CARDIA_COMMANDS.ACTIVATE_ABILITY, playerId: 'p1', payload: { abilityId: ABILITY_IDS.XXX, cardId: 'cX', playerId: 'p1' } }

// 这个正则表达式匹配 ACTIVATE_ABILITY 命令
const activateAbilityRegex = /{\s*type:\s*CARDIA_COMMANDS\.ACTIVATE_ABILITY,\s*playerId:\s*'([^']+)',\s*encounterIndex:\s*\d+,\s*abilityId:\s*(ABILITY_IDS\.[A-Z_]+)\s*}/g;

content = content.replace(activateAbilityRegex, (match, playerId, abilityId) => {
  return `{
        type: CARDIA_COMMANDS.ACTIVATE_ABILITY,
        playerId: '${playerId}',
        payload: {
          abilityId: ${abilityId},
          cardId: 'c1', // 简化测试，使用固定 cardId
          playerId: '${playerId}'
        }
      }`;
});

// 修复 SKIP_ABILITY 命令结构
// 从: { type: CARDIA_COMMANDS.SKIP_ABILITY, playerId: 'p1', encounterIndex: 0 }
// 到: { type: CARDIA_COMMANDS.SKIP_ABILITY, playerId: 'p1', payload: { playerId: 'p1' } }

const skipAbilityRegex = /{\s*type:\s*CARDIA_COMMANDS\.SKIP_ABILITY,\s*playerId:\s*'([^']+)',\s*encounterIndex:\s*\d+\s*}/g;

content = content.replace(skipAbilityRegex, (match, playerId) => {
  return `{
        type: CARDIA_COMMANDS.SKIP_ABILITY,
        playerId: '${playerId}',
        payload: {
          playerId: '${playerId}'
        }
      }`;
});

writeFileSync(filePath, content, 'utf-8');
console.log('✅ 命令结构已修复');
