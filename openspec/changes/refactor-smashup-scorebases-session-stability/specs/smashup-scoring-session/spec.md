## ADDED Requirements
### Requirement: SmashUp scoreBases session SHALL be the single settlement authority
SmashUp SHALL use a dedicated scoring session, stored as the metadata and step of its `smashup:score-bases` resolution frame, to drive the full `scoreBases` settlement chain, including locked eligible bases, current base, remaining bases, completion state, deferred post-scoring events, and re-entry after interactions or response windows.

#### Scenario: 多基地计分在同一 session 中推进
- **GIVEN** `scoreBases` 阶段有多个已锁定的达标基地
- **WHEN** 玩家选择一个基地开始计分并在其 `afterScoring` 链中产生交互
- **THEN** 当前结算进度 MUST 保存在同一 scoring session 中
- **AND** 交互解决后 MUST 从该 session 继续当前基地或后续基地的结算
- **AND** MUST NOT 通过重新拼接 `flowHalted`、`scoredBaseIndices`、`multi_base_scoring` 队列来猜测下一步

#### Scenario: 单基地计分不再依赖全局回跳补链
- **GIVEN** `scoreBases` 阶段仅有一个基地达标
- **WHEN** 该基地的 `beforeScoring`、`afterScoring`、响应窗口与延迟清场链路发生暂停与恢复
- **THEN** 恢复逻辑 MUST 由同一 scoring session 驱动
- **AND** MUST NOT 依赖多个系统各自决定是否再次进入 `onPhaseExit('scoreBases')`

### Requirement: Deferred post-scoring cleanup SHALL be emitted exactly once by the scoring session
SmashUp SHALL let the scoring session own deferred `BASE_CLEARED` / `BASE_REPLACED` style post-scoring events and emit them exactly once after the current base has completed all `afterScoring` interactions, response windows, and required re-scoring.

#### Scenario: 链式 afterScoring 交互结束后只补发一次延迟事件
- **GIVEN** 某个基地计分后产生多个链式 `afterScoring` 交互
- **WHEN** 最后一个交互解决完成
- **THEN** scoring session MUST 补发一次且仅一次该基地对应的 deferred post-scoring events
- **AND** MUST NOT 由具体交互 handler 自行判断“最后一个交互”后补发
- **AND** MUST NOT 由通用 `InteractionSystem` 自动传递或补发游戏专属 deferred payload

#### Scenario: afterScoring 响应窗口关闭后再执行 deferred cleanup
- **GIVEN** 某个基地在 `BASE_SCORED` 后打开了 afterScoring 响应窗口
- **WHEN** 响应窗口关闭且当前基地无需再重算
- **THEN** scoring session MUST 在窗口关闭之后再补发 deferred post-scoring cleanup
- **AND** MUST 保证清场/换基地不会早于该窗口结束

### Requirement: AfterScoring response and rescoring SHALL stay in the same current-base session
SmashUp SHALL keep the post-score response window, power snapshot comparison, rescoring, and final cleanup inside the same current-base scoring session.

#### Scenario: afterScoring 改变力量后在同一 session 中重算
- **GIVEN** afterScoring 响应窗口中的行动改变了当前计分基地的玩家力量
- **WHEN** 响应窗口关闭
- **THEN** scoring session MUST 重新计算同一基地的计分结果后再决定是否进入 deferred cleanup
- **AND** MUST NOT 将这次重算当作一个全新的 scoreBases 流程重新启动

#### Scenario: afterScoring 未改变力量时直接进入 cleanup
- **GIVEN** afterScoring 响应窗口关闭后，当前基地力量对比没有变化
- **WHEN** scoring session 继续推进
- **THEN** session MUST 直接进入当前基地的 deferred cleanup
- **AND** MUST NOT 再额外发出重复的 `BASE_SCORED`

### Requirement: SmashUp scoring session SHALL use stable base references across replacement
SmashUp SHALL track the current and remaining scoring targets with stable scoring references so that base replacement during settlement does not corrupt continuation logic.

#### Scenario: 当前基地替换后仍能继续正确处理 replacement 后动作
- **GIVEN** 当前计分基地在 cleanup 中被 `BASE_REPLACED`
- **WHEN** 后续动作需要引用“当前计分槽位”或“替换后的新基地”
- **THEN** scoring session MUST 通过稳定引用区分原计分目标与替换结果
- **AND** MUST NOT 仅依赖裸 `baseIndex` 猜测当前目标语义

#### Scenario: 多基地剩余列表不会因为中途换基地而误新增目标
- **GIVEN** 多基地计分流程中，某个已计分基地已经完成 cleanup 并被新基地替换
- **WHEN** session 继续检查剩余待计分基地
- **THEN** 已完成的计分槽位 MUST NOT 被重新当作新的待计分目标
- **AND** 只允许继续推进原 session 锁定的剩余目标

### Requirement: AfterScoring interaction handlers SHALL remain local to their own business step
SmashUp `afterScoring` interaction handlers SHALL only emit the domain outcome for their own business step and SHALL NOT drive global scoring continuation decisions.

#### Scenario: 大副 handler 不再负责全局计分续链
- **GIVEN** `pirate_first_mate_choose_base` 交互被解决
- **WHEN** 玩家选择移动或跳过
- **THEN** handler MUST 只返回“大副移动/跳过”对应的本步领域结果
- **AND** MUST NOT 自行补发 deferred cleanup
- **AND** MUST NOT 自行判断剩余基地是否继续计分

#### Scenario: 基地能力 handler 不再自行判定是否最后一个交互
- **GIVEN** 任一基地 afterScoring handler 解决后仍有其它 afterScoring 交互或响应窗口待处理
- **WHEN** handler 返回结果
- **THEN** 全局续链决定 MUST 由 scoring session 统一处理
- **AND** handler 只关心当前能力自己的业务结果

### Requirement: Scoring transaction SHALL advance only from formally reduced domain events
SmashUp SHALL let the pipeline formally reduce every domain event that changes the authoritative core exactly once. The scoring frame SHALL decide later steps only from that formally reduced core and its own frame metadata.

#### Scenario: BASE_SCORED commits before After Scoring collection
- **GIVEN** a scoreBases session is resolving a selected base
- **WHEN** the scoring driver emits `BASE_SCORED` or Munchkin treasure reward reveal events
- **THEN** the session MUST suspend before collecting After Scoring triggers or options
- **AND** After Scoring MUST resume only after those scoring events have been formally reduced into the authoritative core

#### Scenario: Before Scoring commits before Me First window
- **GIVEN** a scoreBases session is resolving a selected base
- **WHEN** the scoring driver queues ordinary beforeScoring triggers, beforeScoring base ability triggers, and `BEFORE_SCORING_TRIGGERED`
- **THEN** the session MUST suspend before opening the Me First response window or calculating VP
- **AND** Me First and later scoring steps MUST resume only after those beforeScoring events have been formally reduced into the authoritative core

#### Scenario: When Scoring commits before BASE_SCORED
- **GIVEN** a scoreBases session has completed Before Scoring for a selected base
- **WHEN** the scoring driver queues whenScoring base ability triggers and `WHEN_SCORING_TRIGGERED`
- **THEN** the session MUST suspend before emitting `BASE_SCORED`
- **AND** `BASE_SCORED` MUST be computed only after whenScoring events and any events produced by resolving that frame have been formally reduced into the authoritative core

#### Scenario: After Scoring trigger marker commits before response and cleanup
- **GIVEN** a scoreBases session has formally reduced `BASE_SCORED` for a selected base
- **WHEN** the scoring driver queues afterScoring triggers, records the afterScoring marker, and registers the current base cleanup payload
- **THEN** the session MUST suspend before opening After Scoring response options or emitting cleanup events
- **AND** After Scoring interactions and response windows MUST resume from the committed session frame instead of causing another `BASE_SCORED`
- **AND** the current base cleanup payload MUST remain available to those interactions without reconstructing it from a projected future core

#### Scenario: BASE_REPLACED commits before reveal reactions
- **GIVEN** a scored base is cleared and replaced
- **WHEN** the scoring driver emits `BASE_REPLACED`
- **THEN** reveal reactions for the new base MUST be collected only after `BASE_REPLACED` has been formally reduced into the authoritative core
- **AND** deferred post-scoring payloads MUST NOT pre-populate reveal trigger queue events from a projected future core

#### Scenario: Current-base completion does not create a pipeline-round wait state
- **GIVEN** the scoring session has emitted the current base's cleanup and replacement events
- **WHEN** the current base is marked completed
- **THEN** the scoring session step MUST return to `idle`
- **AND** it MUST NOT create an `awaiting-post-reduce` or equivalent rule step whose only meaning is waiting for the next pipeline round
- **AND** the next base MUST be selected only after the emitted events have been formally reduced and remaining base refs are refreshed from authoritative core

#### Scenario: 计分规划不得把预演 core 写回比赛状态
- **GIVEN** 当前计分步骤需要发出一个或多个领域事件
- **WHEN** driver 需要等待这些事件改变基地、手牌、弃牌堆或力量后才能决定下一步
- **THEN** driver MUST 发出事件并在正式归约后继续对应 frame step
- **AND** MUST NOT 把临时 reduce 的结果保存进权威 `MatchState.core` 后再恢复快照
- **AND** MUST NOT 手工合并 interaction handler 前后 core 的部分字段来避免双重结算

### Requirement: Settlement projections SHALL remain read-only and non-authoritative
SmashUp MAY use local projection/query views for UI hints, AI scoring, legality probes, animation previews, and ordered batch-event derivation. Such views MUST remain local to the current call stack and MUST NOT be written into authoritative match state, scoring session continuation targets, real interactions, real reactions, trigger consumption, response closure, or Flow continuation.

#### Scenario: cleanup batch view does not choose the next scoring base
- **GIVEN** a scoring finalizer emits deferred cleanup events for the current base
- **AND** it builds a local batch view to materialize actions that depend on the cleanup result
- **WHEN** the scoring session needs to find the next eligible base
- **THEN** it MUST wait until cleanup events have been formally reduced
- **AND** it MUST refresh remaining base refs from the authoritative core rather than from the local batch view

#### Scenario: legality probe cannot create real settlement state
- **GIVEN** UI, AI, or response option code probes whether a card can be played
- **WHEN** that probe constructs a temporary state for validation
- **THEN** the temporary state MUST NOT create or consume a real trigger, interaction, reaction frame, response pass, deferred event, or scoring continuation
- **AND** any result that should affect the game MUST be emitted later through the normal command/event pipeline

### Requirement: Clearing reactions SHALL originate from actual base clearing
SmashUp SHALL create discard and leave-play reactions only after `BASE_CLEARED` has formally moved the relevant object out of the scored base.

#### Scenario: After Scoring 移走的随从不会产生弃牌反应
- **GIVEN** 一个随从在 `BASE_SCORED` 后仍留在基地
- **AND** After Scoring 效果将它移到另一个基地
- **WHEN** 原基地随后正式清场
- **THEN** system MUST NOT create `onMinionDiscardedFromBase` reaction for that moved minion

#### Scenario: 真正清场后的触发看到更新后的区域
- **GIVEN** 一个随从实际因 `BASE_CLEARED` 进入弃牌堆
- **WHEN** 其弃牌触发需要洗牌或抽牌
- **THEN** trigger MUST observe the card already in its discard zone

### Requirement: SmashUp reaction frame SHALL be the sole responder authority
For SmashUp Me First and After Scoring windows, one reaction frame/session SHALL own responder order, current responder, passes, action-reset behavior, and closure. Generic ResponseWindow state SHALL NOT mirror or drive the same window.

#### Scenario: 可响应判断与实际选项共用一个入口
- **GIVEN** SmashUp needs to decide whether the current responder can act
- **WHEN** it evaluates Me First or After Scoring options
- **THEN** the same option builder and legality rules MUST determine both availability and the displayed options
- **AND** system MUST NOT auto-skip a player when that builder can produce a legal option

#### Scenario: 通用窗口事件不会反向推进 SmashUp pass
- **GIVEN** 一个 SmashUp reaction frame 正在等待响应
- **WHEN** generic `ResponseWindowSystem` processes unrelated state or events
- **THEN** it MUST NOT translate them into a SmashUp pass or close that reaction frame
