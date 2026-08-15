# Change: 收敛 SmashUp 计分结算链并稳定多重 afterScoring 场景

## Why
SmashUp 当前 `scoreBases` 结算链同时分散在 `scoreOneBase()`、`registerMultiBaseScoringInteractionHandler()`、`onPhaseExit('scoreBases')`、`onAutoContinueCheck()`、`SmashUpEventSystem.afterEvents()` 与 `InteractionSystem.resolveInteraction()` 中推进。多基地计分、afterScoring 响应窗口、链式交互与延迟 `BASE_CLEARED/BASE_REPLACED` 事件依赖多个隐式 flag（如 `_deferredPostScoringEvents`、`scoredBaseIndices`、`afterScoringInitialPowers`、`flowHalted`、`_waitForPostScoringReduce`）共同维持，已经反复引发重复计分、漏计分、交互链中断与“大副未触发”类回归。

继续在现结构上补点修复，无法稳定收敛计分链。需要把 SmashUp 计分阶段重构为单一的“计分会话（scoring session）”驱动器，消除跨系统分散推进和游戏专属逻辑侵入引擎层的问题。

## What Changes
- 新增 SmashUp 专用 `scoring session` 语义，作为 `scoreBases` 阶段唯一结算权威。
- 将“多基地顺序选择 / beforeScoring / BASE_SCORED / afterScoring 触发 / afterScoring 响应窗口 / 延迟清场与换基地 / 重算同一基地 / 继续下一个基地”统一收敛到同一状态机推进。
- 取消由 `InteractionSystem` 和通用交互 handler 传播、补发 `_deferredPostScoringEvents` 的做法；改为由 SmashUp session 驱动器统一决定何时补发且只补发一次。
- 收紧交互 handler 职责：交互 handler 只返回该步领域结果，不再自己判断“是否最后一个交互”、不再直接驱动多基地后续链路。
- 为多基地计分与 afterScoring 组合场景补齐领域测试与 E2E 证据，覆盖大副、侦察兵、母舰、托尔图加、刚柔流寺庙等代表性链路。

## Current Migration Status
- 已完成第一段权威提交屏障：`BASE_SCORED` / Munchkin 宝藏 reveal 发出后，scoring session 进入 `awaiting-score-award-reduce`，After Scoring 只从已正式归约的 core 继续。
- 已完成 Before Scoring 入队提交屏障：普通 beforeScoring 触发与基地 beforeScoring 能力进入同一个 `score-before` frame，`BEFORE_SCORING_TRIGGERED` 只在正式归约后再继续 Me First/后续计分。
- 已完成 When Scoring 入队提交屏障：whenScoring 基地能力与 `WHEN_SCORING_TRIGGERED` 正式归约后才继续发 `BASE_SCORED`；whenScoring 触发产出的事件也会先提交再继续。
- 已完成 After Scoring 入队提交屏障：afterScoring trigger/marker 与当前基地 cleanup payload 先登记到 scoring frame；强制 afterScoring 交互、可选 afterScoring 响应窗口和 replacement-base follow-up 均从该 frame 继续，不再靠重复 `BASE_SCORED` 补链。
- 已删除 `scoreOneBase()` 外层 `preScoreCore` 回退契约：权威 scoreBases 路径中的 reaction queue 产出领域事件后会暂停并等待 pipeline 正式归约，不再把预演 core 交给外层再回滚。
- 已完成清场事实触发切片：`onMinionDiscardedFromBase` 不再在 `BASE_SCORED` 后预测性生成，而是从正式 `BASE_CLEARED` 后的实际弃牌事实产生。
- 已完成换基地 reveal 事实触发切片：`BASE_REPLACED` 的新基地 reveal 触发不再预塞进 deferred payload，而是在 `BASE_REPLACED` 正式归约后由事件后处理产生。
- 已同步旧测试 helper 的两轮 pipeline 语义，避免测试继续固化“计分和 After Scoring 必须同轮同步完成”的旧口径。
- 已删除 `SmashUpEventSystem.afterEvents()` 的 interaction pending-events preview：交互 handler 产出领域事件后不再临时归约未来 core 来继续 reaction queue，而是等待 pipeline 正式归约后再续链。
- 已删除 `mergePromptResultCoreWithPreEventState()`：交互 handler 发出领域事件时不得再同时改写权威 core，`smashup_reaction_choose` 改为领域事件后暂停并等待 pipeline 正式归约。`postProcessSystemEvents()` 也不再通过 sys 私有字段 `_ppseInputEventsReduced` 判断 pipeline 轮次，改由 pipeline 显式传入 `inputEventsAlreadyReduced`。reaction session 的 stale trigger pruning、optional 全让过、reaction trigger 执行与 reaction command 后处理在暂停路径下只发领域事件并跳过递归 reaction queue resolution，等待 pipeline 正式归约后再续链。
- 已清理局部卡牌/基地投影：桌游桌抽牌后弃牌候选由 `CARDS_DRAWN` payload 派生；Geeks Min Maxing / Non-Infinite Loop 只用显式临时校验态模拟“手牌可见 + 额外行动额度”，不再通过 `grantExtraAction` / `CARD_TRANSFERRED` 事件 reduce 来校验或执行；Min Maxing 查看手牌、Mulligan reveal 和 Banned List 多对手续链不再把事件预演进下一 prompt 上下文。
- 已删除 Geeks Griefer 多对手续链的 `simulateMatchState()`：ability runtime 在“领域事件 + 后续 program”之间发出内部 continuation 事件，等待 pipeline 正式归约后再恢复下一段 program；Griefer 只记录下一位对手起点，恢复后用已落地 core 重新生成候选。
- 已扩展 ability runtime continuation：continuation context 可声明恢复时需要 pipeline 当前随机源；Marvel / Avengers / Marvel Villains 的剩余 runtime 卡牌级投影已迁为“先提交领域事件，正式归约后恢复 program/prompt”，覆盖 Cosmic Knowledge、Shield Rescue Mission、Hawkeye’s Arrows、Hawkeye、J.A.R.V.I.S.、Red Skull、Hail Hydra、Baron Strucker 和 Kree Prepare to Engage。
- 已迁移 Anansi / Russian Fairy Tales 的手写 interaction 卡牌级投影：抽牌后 prompt、destroy 后 search、transformation 后 attach、赠牌后抽牌/标记、加指示物/移动/洗回后赠牌等链路均改为“先提交领域事件，正式归约后恢复 continuation/prompt”；`src/games/smashup/abilities` 与 `src/games/smashup/domain` 当前已无 `simulateMatchState()` 同名残留。
- 已删除 Flow 自动推进对 Smash Up 私有 pipeline 轮次 flag 的依赖：`_waitForPostScoringReduce`、`_waitForScoreBasesInteractionReduce`、`_waitForStartTurnInteractionReduce` 不再作为规则续链职责；共享 FlowSystem 通过 pipeline 显式 pending-after-events 上下文等待正式归约。
- 已把 post-scoring reveal 的两秒视觉 delay 移出规则状态：生产代码不再写入 `_smashupPostScoringBaseRevealDelayUntil` 或 `awaiting-post-scoring-delay`，AI recovery / domain flow 不再读取该视觉 deadline。
- 已收口 Me First / After Scoring 的“是否有可响应内容”判断：`game.ts` 与 `MeFirstOverlay` 复用 ReactionSession 的真实选项生成入口，UI 点击手牌/基地/目标时优先走 `smashup_reaction_choose` live option，不再在通用 ResponseWindow 配置或 UI 文案层保留第二套手牌/基地/限制判断。
- 已将通用 ResponseWindow 事件到 SmashUp reaction pass 的兼容逻辑集中成薄 adapter：AI recovery 和共享传输仍可发 `RESPONSE_PASS`，但该桥只翻译到 ReactionSession，不再持有响应规则或候选判断。
- 已让 reaction presentation、Smash Up AI 的结束阶段与相对效用判断直接尊重 live ReactionSession：镜像 responseWindow 丢失时，不再因为展示壳缺失而误暴露 `advance-phase`。
- 已将真人 UI 与 Smash Up AI 的正常 reaction pass 迁到 `su:reaction_pass`：live pass 请求只由 live optional ReactionSession 当前响应者发起和消费，`REACTION_PASS_REQUESTED` 不参与通用 post-process 派生链；手动 pass 后只推进一名响应者，不再由空 afterEvents 轮继续自动代 pass。旧 `RESPONSE_PASS` 仍保留为恢复/共享传输/legacy adapter。
- 已删除 live ReactionSession 写入通用 ResponseWindow 镜像的生产路径：`setSmashUpReactionSession()` 只维护 reaction frame/session，并清掉旧的 `smashup_reaction_choose` 镜像壳；UI/AI 展示从 live session 读取当前响应者。
- 尚未完成彻底迁移：非暂停执行路径仍允许 reaction trigger / reaction command 后处理按旧方式立即应用事件，`postProcessSystemEvents()` 内部仍有局部 tempCore 构造用于触发收集；外部 `RESPONSE_PASS` 兼容桥和 legacy responseWindow fallback 仍存在，但已被收窄，后续需按消费者矩阵迁出。

## Impact
- Affected specs:
  - `smashup-scoring-session`（新增）
  - `interaction-system`（新增 opaque continuation context 约束）
- Affected code:
  - `src/engine/types.ts`
  - `src/engine/pipeline.ts`
  - `src/engine/systems/FlowSystem.ts`
  - `src/games/smashup/domain/index.ts`
  - `src/games/smashup/domain/systems.ts`
  - `src/games/smashup/domain/reactionSession.ts`
  - `src/games/smashup/game.ts`
  - `src/games/smashup/Board.tsx`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `src/games/smashup/abilities/pirates.ts`
  - `src/games/summonerwars/domain/index.ts`
  - `src/engine/systems/InteractionSystem.ts`
  - SmashUp 相关 scoring / afterScoring 测试与 E2E 证据文件
