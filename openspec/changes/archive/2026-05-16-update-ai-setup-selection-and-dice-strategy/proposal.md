# Change: AI 全面优化（准备阶段 + 决策质量 + 掷骰策略）

## Why
- 这轮诉求不是单点修补，而是把 AI 的“准备阶段 + 回合决策 + 响应窗口”系统化优化，避免只修一个点又出现其他薄弱环节。
- 当前跨游戏 AI 仍存在：准备阶段选角重复、专家难度非玩法决策过于可预测、关键响应与节奏判断偏弱等问题。
- DiceThrone、SmashUp、Summoner Wars 的 AI 需要各自的核心策略补强，确保“看起来像在认真下棋”，而不是机械随机。

## What Changes
- 在 `game-ai-system` 中补充跨游戏的“准备阶段去重 + 非玩法随机扰动”要求。
- 统一定义 AI 在响应窗口的优先级：必须优先阻止立即失败或确保立即得分的动作。
- 针对每个游戏明确关键优化点：
  - DiceThrone：锁骰/重投策略 + 资源/防御权衡。
  - SmashUp：基地评分与出牌节奏、关键行动卡时机。
  - Summoner Wars：召唤师安全、击杀优先与魔力经济。

## Impact
- Affected specs:
  - `game-ai-system`
- Affected code:
  - `src/games/dicethrone/ai.ts`
  - `src/games/smashup/ai.ts`
  - `src/games/summonerwars/ai.ts`
  - 相关 AI 测试与策略评估用例

## Scope Notes
- 选角去重已有实现，本提案负责补齐规范与验证，并扩展到“决策质量优化”的整体路径。
- DiceThrone/SmashUp/Summoner Wars 的优化均在本提案中覆盖，但实现阶段仍需拆分为可验证的小步。
