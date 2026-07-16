# Change: 重构 DiceThrone 战术 AI 评估与响应策略

## Why
DiceThrone 当前本地 AI 已能生成合法动作并处理大量防卡死场景，但整体仍偏“动作类型 + 局部 scorer”叠分。用户已指出一个具体症状：真人投出普攻时，AI 仍会花响应牌去改真人骰子。这说明 AI 缺少“花资源后是否真的改变局面”的统一判断，容易把理论上的骰面干扰当成实际收益。

同时，`src/games/dicethrone/ai.ts` 已膨胀为单文件大模块，掷骰计划、响应窗口、出牌估值、投影和 profile 混在一起，难以验证和继续提升。需要把 DiceThrone AI 升级为可解释、可测试、可预算的战术评估模块。

## What Changes
- 抽出 DiceThrone AI 子模块，将合法动作生成、骰面计划、局面评估、动作投影、短线搜索、英雄 profile 和 scorer 组装分离。
- 新增统一局面价值函数，集中评估生命安全、即将承伤、伤害竞速、CP/手牌经济、升级引擎、状态/token、护盾和骰面命中率。
- 将可安全模拟的动作投影升级为“动作后局面价值 - 当前局面价值”，保守降级无法安全模拟的交互、额外骰和未知 custom action。
- 为响应窗口新增“可阻止实际收益”门槛，避免在真人仅投出普攻、低价值攻击或非关键骰面时稳定浪费改骰牌。
- 增加阶段内短线搜索，覆盖锁骰/改骰/重投/确认、卖牌/出牌/升级、响应窗口防御与干扰等组合。
- 扩展英雄策略 profile，使不同英雄在爆发、续航、防御、token、升级、改骰和响应依赖上体现差异。
- 明确 AI 预测只基于当前可见公开状态和自身候选动作，不预测真人隐藏意图、不读取隐藏手牌或牌堆顺序。
- 与现有 `refactor-dicethrone-roll-context-unification` / `refactor-dicethrone-extra-dice-unification` 保持兼容：统一掷骰上下文未完成前，额外骰相关 AI 只能保守降级。

## Impact
- Affected specs:
  - `game-ai-system`
- Affected code:
  - `src/games/dicethrone/ai.ts`
  - 可能新增 `src/games/dicethrone/ai/evaluation.ts`
  - 可能新增 `src/games/dicethrone/ai/dicePlanning.ts`
  - 可能新增 `src/games/dicethrone/ai/projection.ts`
  - 可能新增 `src/games/dicethrone/ai/search.ts`
  - 可能新增 `src/games/dicethrone/ai/profiles.ts`
  - 可能新增 `src/games/dicethrone/ai/legalActions.ts`
  - 可能新增 `src/games/dicethrone/ai/scorers.ts`
  - `src/games/dicethrone/__tests__/ai-roll-strategy.test.ts`
  - `src/games/dicethrone/__tests__/ai-main-phase-turn-gating.test.ts`
  - 可能新增 DiceThrone AI tactical / response / projection 测试
- Related pending changes:
  - `refactor-dicethrone-roll-context-unification`
  - `refactor-dicethrone-extra-dice-unification`
- Non-goals:
  - 本 change 不实现完整 MCTS。
  - 本 change 不接入远程大模型实时落子。
  - 本 change 不读取真人隐藏手牌、隐藏牌堆或预测真人主观意图。
  - 本 change 不重构 DiceThrone 统一掷骰上下文本体，但会为其完成后的 AI 接入预留边界。
