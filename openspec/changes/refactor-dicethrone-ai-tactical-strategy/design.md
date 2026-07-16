# Design: DiceThrone 战术 AI 评估与响应策略

## Context
DiceThrone 当前 AI 主体集中在 `src/games/dicethrone/ai.ts`，约 4880 行。它已经使用公共 `createLookaheadLocalAiPolicy`，并具备：

- 合法动作生成：选角、交互、响应窗口、奖励骰、净化、被动、阶段动作。
- 掷骰计划：按技能需求锁骰、重投、确认。
- 局部评分器：能力、出牌、交互、奖励骰、防御响应、状态、节奏、profile。
- 局部投影：出牌、卖牌、弃牌、阶段推进、选技能等启发式估值。

现有方向正确，但判断仍分散在多个 scorer 中。用户指出的“真人投出普攻，AI 仍改真人骰子”说明响应窗口缺少统一机会成本判断：AI 当前会因为“能压低对手骰面”而给改骰牌正分，却没有先证明这次改骰会阻止大招、关键技能、致命伤害、强状态或其他足够大的实际收益。

同时，DiceThrone 已存在两个相关未实施提案：

- `refactor-dicethrone-roll-context-unification`
- `refactor-dicethrone-extra-dice-unification`

它们处理“AI 和规则到底看见哪一组当前骰子”的真相源问题。本 change 处理 AI 如何评估与搜索；若统一掷骰上下文未完成，AI 必须对额外骰保持保守降级。

## Goals
- 保持 `legalActions` 为唯一动作根集合，继续通过 validate / execute / reduce / systems 执行。
- 建立 `evaluateDiceThroneBoardState()`，统一比较进攻、防守、资源、升级、状态/token 和骰面计划收益。
- 将可安全模拟动作升级为动作后局面差值，减少裸常数叠加。
- 为响应窗口建立“可阻止实际收益”门槛，避免普攻/低价值攻击稳定触发改骰。
- 在预算内搜索阶段内 2-3 步短线组合。
- 拆分 AI Module，提高 Locality，保留公共 AI 层 trace 和预算契约。
- 将英雄策略 profile 升级为战术权重，而不是只影响少量骰面追逐参数。

## Non-Goals
- 不实现完整 MCTS。
- 不实现 Minimax 全局对抗搜索。
- 不引入神经网络、强化学习或远程大模型实时落子。
- 不读取隐藏手牌、真实牌堆顺序或其他超出 `playerView` 的信息。
- 不预测真人玩家的隐藏意图或未来主观选择。
- 不把统一掷骰上下文提案合并进本 change 的交付范围。

## Decisions

### 1. 先拆深 Module，再替换评分口径
目标目录：

- `ai/legalActions.ts`：合法动作构建与保守兜底。
- `ai/dicePlanning.ts`：骰面需求、命中率、锁骰与重投计划。
- `ai/evaluation.ts`：统一局面价值函数。
- `ai/projection.ts`：安全模拟和动作后差值。
- `ai/search.ts`：阶段内短线搜索。
- `ai/profiles.ts`：英雄策略 profile。
- `ai/scorers.ts`：保留必要 scorer 组装。
- `ai.ts`：只保留 `GameAiRuntime` 适配和导出。

删除测试判断：如果删掉这些 Module 会导致复杂度重新散回 `ai.ts` 多处，它们就有足够 Depth。

### 2. 统一局面价值函数覆盖 DiceThrone 的真实决策维度
`evaluateDiceThroneBoardState(state, playerId, options)` 返回总分和 breakdown。首批维度：

- 生命安全：己方 HP、即将承伤、致命伤害、防御牌/token/护盾可用性。
- 伤害竞速：对手 HP、当前攻击伤害、斩杀窗口、攻击修正收益。
- 资源经济：CP、手牌、可卖牌转化、补牌价值、资源溢出。
- 升级引擎：已升级技能、可升级关键技能、升级后后续收益。
- 状态与 token：己方减益、敌方增益、可净化/可转移/可消耗 token。
- 骰面计划：当前技能线、命中率、缺失骰数、可用改骰资源。
- 节奏：当前阶段是否仍有可兑现收益，是否应确认或推进阶段。

### 3. 响应窗口先评估“可阻止收益”，再决定是否出牌
响应窗口的改骰牌、重掷牌、token 和防御牌必须先计算其能阻止或确保的实际收益：

- 阻止致命伤害或明显高伤害。
- 阻止大招、关键技能、强控制、强回血、强资源或关键 token。
- 把攻击从高价值技能降为普攻或无效攻击。
- 确保己方不死或保住关键资源。

如果真人当前只是普攻或低价值攻击，且改骰不能降低有效伤害档位、不能阻止关键效果、不能改变斩杀状态，则响应动作应被机会成本压到跳过响应之下。

### 4. 动作投影使用安全模拟优先
可模拟动作应在复制状态上走真实领域链：

1. `DiceThroneDomain.validate`
2. `DiceThroneDomain.execute`
3. `DiceThroneDomain.reduce`
4. 已有 systems / flow hooks 能安全执行时纳入

然后比较 `after.total - before.total`。无法安全模拟的动作必须返回保守 fallback，并在 trace 中说明原因，不能构造 AI 专用命令结果。

### 5. 阶段内短线搜索只做局部战术组合
首版搜索最多 2-3 步，按难度控制深度、shortlist 和预算：

- 掷骰阶段：锁骰 -> 改骰牌/被动重掷 -> 重投/确认 -> 选技能。
- 主阶段：卖牌 -> 出牌/升级 -> 继续出牌或推进阶段。
- 响应窗口：防御牌/token/改骰干扰 -> 伤害或技能收益变化 -> 是否跳过。
- 奖励骰：重掷或确认 -> 结算收益。

每一步必须基于模拟后的新状态重新生成 `legalActions`，不得复用旧候选。

### 6. 预测只基于可见状态和 AI 自身动作
本 change 中“预测”只表示：

- 当前公开骰面能带来什么公开技能或效果。
- AI 自己执行某个合法动作后，公开局面会如何变化。

AI 不预测真人隐藏意图，不读取隐藏手牌，不读取真实牌堆顺序，也不把真人未来选择当作确定事实。对于真人后续会怎么选，只允许用保守估计或当前公开最高威胁，不允许透视。

### 7. 与统一掷骰上下文提案的关系
本 change 不直接完成 roll context，但必须识别它的边界：

- 对主骰、目标掷骰、当前 `getActiveDice()` 能覆盖的骰子，执行完整评估。
- 对 `pendingBonusDiceSettlement` 做现有兼容。
- 对仍走 `displayOnly` 且规则上应可干预的额外骰，不在 AI 中伪造完整能力，只记录保守降级。
- 等 roll context 提案完成后，AI 通过活跃掷骰上下文扩展评估范围。

## Risks / Trade-offs
- 安全模拟可能触发过多 flow hooks，导致预算压力。缓解：只对 shortlist 投影，并限制深度。
- 统一局面价值权重过强可能压过特殊牌语义。缓解：保留 scorer contribution，trace 展示基础分、局面差值、响应收益门槛和 profile 贡献。
- 响应窗口若门槛过高，AI 可能错过少数低伤但关键状态的打断。缓解：测试覆盖普攻不改骰、关键技能必须改骰、致命伤害必须响应三类。
- 旧 roll context 未完成前，额外骰相关 AI 智能度仍有限。缓解：明确降级，不用假完成冒充完整预测。

## Validation Plan
- 单测：普攻/低价值攻击下，AI 不稳定浪费改骰牌。
- 单测：大招、斩杀、强状态或高伤害窗口下，AI 优先响应或改骰。
- 单测：统一局面价值覆盖生命、伤害、资源、升级、状态/token、骰面计划。
- 单测：动作后差值能让同一响应牌在“普攻”和“关键技能”下评分反转。
- 单测：短线搜索覆盖锁骰 -> 改骰牌 -> 确认技能，以及卖牌 -> 解锁出牌。
- 回归：现有 `ai-roll-strategy.test.ts`、`ai-main-phase-turn-gating.test.ts`、`basic-commands-coverage.test.ts` 代表性 AI 用例继续通过。
- 类型与静态检查：修改 `.ts` 文件后运行定向 `npx eslint`，大范围重构后运行 `npx tsc --noEmit --pretty false --skipLibCheck`。
