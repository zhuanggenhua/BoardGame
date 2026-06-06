# Change: 回合制 AI 语义层与适配边界

## Why
- 现有 AI 体系已经有统一的 `AiDecisionContext`、`legalActions`、本地 scorer 与 lookahead 基础，但仍缺少一层对“动作语义”的显式建模。
- 一旦进入复杂回合制桌游，单纯靠动作类型和少量权重很容易出现硬错，例如把增益给错目标、把减益打到自己、在多选交互中固定取前几个候选。
- 如果继续把这些判断散落在各游戏 `ai.ts` 里，框架会迅速退化成“每个游戏自己写一堆 if/else”，不利于后续扩展到更多游戏。

## What Changes
- 为通用回合制 AI 增加“语义层”规范：动作、交互选项和候选目标可以通过 AI-only hints 显式表达目标关系、效果意图、收益风险与 override 信息。
- 定义公共 AI 框架与游戏适配器之间的稳定边界：公共层负责评分/搜索/预算/trace，游戏层负责提供合法动作、语义 hints、局面评估和必要的特例覆盖。
- 要求交互系统支持在不污染业务 payload 的前提下保留 AI-only hints，并在 AI 生成 `legalActions` 时把这些 hints 传递到 action metadata。
- 强化决策 trace 要求，使 AI 每次选择都能解释“为何选这个动作”，便于调试与回归验证。

## Impact
- Affected specs:
  - `game-ai-system`
  - `interaction-system`
- Affected code:
  - `src/engine/ai/`
  - `src/engine/systems/InteractionSystem.ts`
  - `src/games/*/ai.ts`
  - `src/games/*/domain/*` 中参与目标选择与交互构造的 helper

## Relationship to Existing Changes
- 本 change 不替代 `add-cross-game-ai-system`，而是在其基础上补“语义层与适配边界”。
- 本 change 不替代 `add-strong-singleplayer-ai-difficulty`，而是为其搜索/评估框架补齐语义输入契约。
