# 大杀四方本地反馈收口：AI 错打“暴力攻击”

## 范围

- 口径：本地数据库反馈。
- 反馈 ID：`6a88ed51aacaa8f27ab58196`。
- 反馈时间：2026-08-22 00:29:05 +08:00。
- 反馈原文：`ai有问题吧，为什么在不能摧毁我的时候打出暴力摧毁`。
- 游戏：大杀四方（`smashup`）。
- 入口：`/play/smashup/match/FF7CWNQ9DYz?playerID=0`，本地开发版 `0.6.47`，提交前缀 `475515414a27`。

## 原始症状保真

玩家反馈的现实症状是：电脑玩家在没有可摧毁目标时，仍然打出“暴力攻击”，随后场上没有目标被摧毁。

本轮复盘到的更精确事实是：

- 行动记录（`humanReadableLog`）显示：AI 2 号位先“随从登场：黄骑士 → 训练营”，随后“战术卡施放：暴力攻击”，紧接着出现“场上没有符合条件的目标”。
- 状态快照（`stateSnapshot`）显示：AI 2 号位的“暴力攻击”（`c49 / mega_troopers_mega_attack`）已进入弃牌堆，说明它确实被打出。
- 训练营上 AI 2 号位只有一个黄骑士（`c58 / mega_troopers_yellow_trooper`），力量 4；“暴力攻击”的当前规则阈值是“本基地己方随从总力量”，也是 4。
- “暴力攻击”只能摧毁力量低于该阈值的随从；力量 4 不能摧毁力量 4，所以这个目标无效。

## 根因分层

- 现实故障现象：AI 打出了无法摧毁目标的“暴力攻击”，玩家看到“场上没有符合条件的目标”。
- 直接触发条件：AI 候选动作里包含“暴力攻击指向等力随从”的出牌动作。
- 原先为什么没有被拦住：通用出牌语义校验只确认“这张行动牌需要一个随从目标，且目标控制者允许为任意玩家”，没有继续校验“该目标力量必须低于本基地己方随从总力量”。
- 根本机制（修正后口径）：AI 评分层把“行动牌能打出 / 目标基地有压力 / 卡牌有策略标签”当成了收益来源；但执行结果如果只有“没有有效目标”反馈、没有状态收益、没有己方后续选择，就不应获得行动节奏或基地压力正分。单补“暴力攻击”目标合法性只能堵住这张牌的非法目标，不能解决同类“合法但零收益行动牌”被评分器误选的问题。

## 修复

- 在通用出牌校验 `validateActionPlaySemantics()` 中增加“暴力攻击”目标校验：
  - 目标必须在指定基地上。
  - 目标力量必须低于出牌玩家在该基地的己方随从总力量。
  - 目标力量等于或高于阈值时，命令直接被拒绝，牌不会被打出。
- AI 候选生成继续通过通用命令校验过滤动作；因此 AI 不再需要单独一套判断，也不会和真人入口分叉。
- `buildPlayActionCandidates()` 增加 `playerId` 参数，让候选构造在调用通用校验时保留当前行动者身份。
- 增加共享 AI outcome 收益门：
  - 在 `src/engine/ai/actionOutcome.ts` 抽出 `AiActionOutcome`、按决策上下文缓存的 outcome 投影、`isAiActionOutcomeNoBenefit()` 和通用零收益 scorer。
  - `GameAiRuntime.projectActionOutcome` 成为游戏向共享 AI 框架暴露“执行后结果分类”的标准入口。
  - 对 `play-action / response-play-action` 先用同一条执行管线做预演。
  - 如果预演结果只有“没有有效目标”反馈、没有实际效果事件、没有 AI 自己可收口的后续选择，则强降权，并且不再阻止阶段推进。
  - Smash Up 只实现 `projectSmashUpPlayableActionOutcome()` adapter；`projectSmashUpAction()`、阶段持有判断和 `playableActionOutcomeScorer` 共用同一 outcome，避免投影评分修好了但节奏基础分继续给假收益。
- 更新项目 AI 策略 skill：把“收益必须来自结算结果，不能来自能打出或标签”沉淀到 `.spec/skills/game-ai-strategy-design/SKILL.md`，并把共享 outcome 合同写成后续 AI 策略重构入口。
- 更新 Smash Up 新派系 implementation skill：新增行动牌、可发动能力或其它会消耗手牌 / 次数 / 资源的对象，必须复用 `smashUpAiRuntime.projectActionOutcome`，不得再给单卡补“零收益 / 无目标”特例。

## 验证

### 红测

先加入 AI 回归测试后运行：

`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts --configLoader native`

首跑失败，失败点明确显示 AI legal actions 中仍存在：

`play-action:mega-attack-ai:base:0:minion:yellow-trooper-ai`

这证明测试命中了玩家反馈里的坏动作形态。

### 绿测

修复后通过：

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts --configLoader native`
  - 结果：15 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/mega-troopers.test.ts --configLoader native`
  - 结果：38 passed。
- `node scripts/infra/vitest-cli-safe.mjs run src/engine/ai/__tests__/actionOutcome.test.ts src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts --configLoader native`
  - 结果：20 passed。
- `npx eslint src/engine/ai/actionOutcome.ts src/engine/ai/types.ts src/engine/ai/index.ts src/engine/ai/__tests__/actionOutcome.test.ts src/games/smashup/ai.ts src/games/smashup/domain/timingOpportunities.ts src/games/smashup/__tests__/ai-interaction-choice-enumeration.test.ts`
  - 结果：0 errors。
- 全量 `tsc` 当前仍会被仓内既有类型债阻塞；过滤本轮目标文件后，`src/engine/ai/actionOutcome.ts`、`src/engine/ai/types.ts`、`src/games/smashup/ai.ts`、`src/games/smashup/domain/timingOpportunities.ts` 和 Smash Up AI 测试没有相关 TypeScript 报错。
- `npm run spec:lint`
  - 结果：OK。
- 本地 Mongo `boardgame.feedbacks` 反馈记录回查：
  - `status=closed`。
  - `closedReason / resolvedMethod` 已同步为“规则合法性 + 行动牌收益预演”两层口径。
- 本地状态镜像 `temp/feedback-closeout/status-board.json`：
  - `feedbackId=6a88ed51aacaa8f27ab58196` 仍为 `status=closed / lastFetchedStatus=closed`。
  - `closedReason / resolvedMethod` 已与本地 Mongo 口径一致。

新增覆盖：

- 没有可摧毁目标时，AI 不再把“暴力攻击指向等力随从”列为可打出的行动。
- 有低于阈值的目标时，AI 仍保留正确目标候选。
- 直接命令入口拒绝力量不低于阈值的“暴力攻击”目标，牌留在手牌中。
- `cowboys_high_noon` 这类命令合法、但执行后只有“没有有效目标”反馈的行动牌，会被 AI 预演识别为零收益，最终选择 `advance-phase` 而不是空打一张行动牌。

## 之前优化的复盘

当前 AI 代码里已经有这些优化方向：

- 行动种类评分：随从、行动、响应、阶段推进有不同基础倾向。
- 基地压力评估：会看基地总力量、临界点、是否接近计分。
- 派系画像 / 策略标签：卡牌和派系有节奏、爆发、控制等标签。
- 交互候选枚举：会枚举 simple-choice、响应窗口、出牌、天赋和阶段推进。
- 阻塞兜底：未知或无解交互会尝试取消 / 跳过，避免 AI 卡死。

这次暴露的问题是：这些优化主要解决“多个候选怎么排序、怎么更像会玩”，但行动牌评分没有先验证“执行后是否真的产生收益”。最初只把“暴力攻击”的非法等力目标补进通用出牌校验，属于必要的规则合法性补洞，但仍不够；用户指出的核心问题是 AI 收益预测来源错误。二次修复后，AI 会先看行动牌结算结果，只有真实状态收益、实际效果事件或可收口后续选择才会继续拿收益分。

## 收口结论

这条反馈属于真实 bug，已用反馈自带状态和行动记录复盘到原始坏动作，并在当前树修复。当前收口分两层：规则层拒绝“暴力攻击”的非法等力目标；AI 策略层不再把“能打出行动牌”当成收益，执行后只有“没有有效目标”的行动会让位于结束阶段 / pass / skip。真人入口和 AI 入口仍共用合法性判断，AI 额外负责收益预测。
