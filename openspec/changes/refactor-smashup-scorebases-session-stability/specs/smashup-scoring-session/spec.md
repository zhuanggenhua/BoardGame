## ADDED Requirements
### Requirement: SmashUp scoreBases session SHALL own settlement and semantic progression
SmashUp SHALL use a dedicated scoring session, stored as the metadata and step of its `smashup:score-bases` resolution frame, to own locked eligible bases, the current base, completion state, deferred post-scoring events, and re-entry after interactions or response windows. The session SHALL represent the current game-rule step authoritatively. Temporary blockers or waits SHALL explain why that semantic rule step cannot currently advance, but SHALL NOT become a second independently writable progression authority.

#### Scenario: interaction blocks but does not advance the semantic rule step
- **GIVEN** the current scoring base is in the `after-scoring` semantic rule step
- **AND** an after-scoring interaction is opened for that same base
- **WHEN** the interaction is resolved
- **THEN** the scoring blocker/wait state MUST be cleared or updated
- **AND** the semantic rule step MUST remain `after-scoring` until the scoring driver explicitly advances it

#### Scenario: response window blocks but does not advance the semantic rule step
- **GIVEN** the current scoring base is in the `after-scoring` semantic rule step
- **AND** an after-scoring response window is open
- **WHEN** all responders pass and the response window closes
- **THEN** the response-window blocker/wait state MUST be cleared or updated
- **AND** the semantic rule step MUST remain `after-scoring` until the scoring driver explicitly advances it

### Requirement: SmashUp scoring driver SHALL be the only semantic rule-step advancer
SmashUp SHALL centralize semantic scoring rule-step advancement in the scoring driver. Child operations such as interaction resolution, ReactionSession completion, ResponseWindow close/pass handling, and EventSystem after-events handling MAY signal that a blocker is gone, but SHALL NOT independently advance from one semantic scoring rule step to the next unless that operation is explicitly part of the scoring driver.

#### Scenario: child operation resolves before driver advances
- **GIVEN** a child interaction, reaction, or response window was blocking the current scoring rule step
- **WHEN** the child operation completes
- **THEN** it MAY clear or report the blocker
- **AND** it MUST NOT independently decide that scoring has moved to the next semantic rule step
- **AND** the next semantic transition MUST be made by the scoring driver

### Requirement: Local scoring step executors SHALL receive explicit inputs
SmashUp local scoring step executors, including `scoreOneBase()` while it remains in use, SHALL NOT read global `ScoringSession` state to discover which base is current, which semantic rule step is current, or how the overall `scoreBases` transaction should continue. The scoring driver SHALL pass required local inputs explicitly and receive an explicit local result.

#### Scenario: executor is invoked for a requested local step
- **GIVEN** the scoring driver has read the current scoring session
- **AND** it has selected a current base reference and semantic rule step
- **WHEN** it invokes a local scoring executor
- **THEN** the executor MUST receive those inputs explicitly
- **AND** the executor MUST NOT independently consult global scoring-session state to decide global continuation

### Requirement: Deferred post-scoring cleanup SHALL be emitted exactly once by the scoring driver path
SmashUp SHALL keep deferred `BASE_CLEARED` / `BASE_REPLACED` style post-scoring events in the scoring resolution frame and emit them exactly once through the scoring driver / Flow finalization path after the current base is ready to finalize.

#### Scenario: deferred payload is consumed once
- **GIVEN** a scoring frame contains deferred `BASE_CLEARED` and `BASE_REPLACED` payloads for the current base
- **WHEN** the scoring driver finalizes that base
- **THEN** those deferred events MUST be emitted once
- **AND** the payload MUST be consumed so a later scoreBases resume cannot replay the same cleanup

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

#### Scenario: 计分规划不得把预演 core 写回比赛状态
- **GIVEN** 当前计分步骤需要发出一个或多个领域事件
- **WHEN** driver 需要等待这些事件改变基地、手牌、弃牌堆或力量后才能决定下一步
- **THEN** driver MUST 发出事件并在正式归约后继续对应 frame step
- **AND** MUST NOT 把临时 reduce 的结果保存进权威 `MatchState.core` 后再恢复快照
- **AND** MUST NOT 手工合并 interaction handler 前后 core 的部分字段来避免双重结算

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
