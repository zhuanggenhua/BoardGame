# Change: 强化目标型 activated ability 的 AI 决策语义

## Why
当前目标型 activated ability 缺少目标语义，AI 容易选到低价值目标，需要显式目标语义与评分以提升稳定性。

## What Changes
- 引入目标级语义与评分入口（目标归属/类型/距离/生命值等），用于生成多条候选动作
- Summoner Wars 率先接入目标型 activated ability 的生成与评分（count=1，unit/position）
- 增加 targeted ability 回归测试覆盖
- 不支持的目标类型暂不生成（保持保守）

## Impact
- Affected specs: game-ai-system
- Affected code: src/games/summonerwars/ai.ts, src/games/summonerwars/__tests__/flow.test.ts
