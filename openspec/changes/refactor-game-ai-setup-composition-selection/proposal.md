# Change: 重构跨游戏 AI 开局选角/选派系策略

## Why
- 当前部分游戏的 AI 准备阶段选择仍被固定优先级表主导，导致可预测且不符合桌游“按组合、对局和玩法风格选择”的实际口径。
- SmashUp 已出现明显问题：`robots` / `wizards` 因静态优先级过强反复被选中，组合协同只是附加分。
- 既有 `update-ai-setup-selection-and-dice-strategy` 只覆盖去重与随机扰动，没有禁止固定强度表主导，也没有要求基于攻略/规则资料沉淀组合依据。

## What Changes
- 为 `game-ai-system` 增加准备阶段选择策略要求：单选角色/阵营必须无倾向随机，不得由静态强度表、打法 profile 或克制关系主导。
- 按游戏区分随机选择与组合选择：
  - SmashUp：首个派系从合法派系身份池中随机分散；第二派系才参考攻略/profile，按 pair 协同、已选派系互补、POD 与原版同身份处理。
  - Summoner Wars：从 `selectable` 阵营池中可复现随机选择，不参考阵营打法、对手阵营或先后手。
  - DiceThrone：从已完成角色池中可复现随机选择，不参考角色复杂度、攻防风格、对手角色或队友角色。
- 保留可复现随机扰动；单选阶段直接由随机扰动决定，组合阶段才允许在相近组合候选之间分歧。
- AI setup 候选池默认排除施工中/未完整可玩内容；SmashUp、Summoner Wars、DiceThrone 都必须从各自可选目录生成候选。
- 更新现有测试，移除“固定选某个角色/派系”的断言，改为验证分布、协同解释和禁止长期集中到同一小集合。

## Impact
- Affected specs:
  - `game-ai-system`
- Affected code:
  - `src/games/smashup/ai.ts`
  - `src/games/smashup/aiProfiles.ts`
  - `src/games/summonerwars/ai.ts`
  - `src/games/dicethrone/ai.ts`
  - 相关 AI setup selection 测试

## External Strategy References
- SmashUp Wiki Strategy: https://smashup.fandom.com/wiki/Strategy
- SmashUp Wiki Robots: https://smashup.fandom.com/wiki/Robots
- SmashUp Wiki Wizards: https://smashup.fandom.com/wiki/Wizards
