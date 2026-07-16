# Change: 重构召唤师战争战术 AI 搜索策略

## Why
召唤师战争当前本地 AI 已能基于合法动作、启发式评分与轻量前瞻完成基本对局，但整体仍偏“一步动作打分”，对站位、防守、连招、派系打法和阶段内连续收益的判断上限较低。为了让 AI 从“能走通”升级到“有战术感”，需要在保留现有可解释、可预算、合法动作门禁的前提下增强局面评估与短线搜索。

## What Changes
- 为召唤师战争抽出统一局面价值函数，集中评估召唤师安全、击杀价值、魔力经济、中心/前线控制、城门与派系节奏。
- 将现有 `projectAction` 从局部动作加分升级为“动作后局面价值 - 当前局面价值”的差值评估。
- 增加阶段内 2-3 步候选序列搜索，在同一阶段内评估移动→攻击、技能→攻击、召唤→站位/挡路、事件牌→后续动作等短线组合。
- 增加派系策略权重，使亡灵、冰霜、哥布林、圣骑、蛮族、诡术等阵营能在同一公共评分框架下体现不同打法偏好。
- 将 MCTS 明确列为未来可选扩展；本 change 不实现完整 MCTS、不引入神经网络、不接入远程大模型决策。

## Impact
- Affected specs: `game-ai-system`, `summonerwars-core`
- Affected code:
  - `src/games/summonerwars/ai.ts`
  - 可能新增 `src/games/summonerwars/ai/evaluation.ts`
  - 可能新增 `src/games/summonerwars/ai/search.ts`
  - 可能新增 `src/games/summonerwars/ai/factionProfiles.ts`
  - `src/games/summonerwars/__tests__/flow.test.ts`
  - `src/games/summonerwars/__tests__/interaction-chain-comprehensive.test.ts`
- Non-goal code:
  - 不修改 `SummonerWarsDomain` 的正式规则语义
  - 不绕过 `AiDecisionContext.legalActions`
  - 不新增独立 AI 专用命令协议
