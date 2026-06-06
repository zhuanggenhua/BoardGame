# Interaction System Specification

## Purpose
定义引擎层统一的阻塞式玩家交互模型，包括一次性选择交互，以及需要本地多步预览后再确认提交的 `multistep-choice` 交互。
## Requirements
### Requirement: Multistep Choice Interaction
InteractionSystem SHALL support a `multistep-choice` kind for interactions that require multiple local intermediate steps before final confirmation.

#### Scenario: Intermediate steps stay local
- **GIVEN** a `multistep-choice` interaction with a `localReducer`
- **WHEN** the player performs intermediate steps
- **THEN** the accumulated result is updated on the client side
- **AND** no intermediate step is required to go through the engine pipeline as a business command

#### Scenario: Confirmation dispatches generated commands
- **GIVEN** a `multistep-choice` interaction with a `toCommands` function
- **WHEN** the player confirms the interaction
- **THEN** the accumulated result is converted into engine command payloads
- **AND** those commands are dispatched to the engine
- **AND** the interaction emits `SYS_INTERACTION_CONFIRMED`

#### Scenario: Cancel drops local progress
- **GIVEN** a `multistep-choice` interaction with local progress already accumulated
- **WHEN** the player cancels the interaction
- **THEN** the interaction is resolved through the existing cancel flow
- **AND** no business commands derived from the local progress are dispatched

### Requirement: useMultistepInteraction Hook
The engine SHALL provide a `useMultistepInteraction` React Hook that manages local multistep interaction state for UI consumption.

#### Scenario: Hook exposes local interaction controls
- **GIVEN** the UI receives a `multistep-choice` interaction
- **WHEN** the UI calls `useMultistepInteraction`
- **THEN** the Hook exposes `result`, `stepCount`, `canConfirm`, `step()`, `confirm()`, and `cancel()`

#### Scenario: Hook resets when interaction changes
- **GIVEN** the current `multistep-choice` interaction has changed to a different interaction ID
- **WHEN** the Hook re-runs for the new interaction
- **THEN** local result and step count are reset to the new interaction's initial state

#### Scenario: Hook auto-confirms when maxSteps is reached
- **GIVEN** a `multistep-choice` interaction defines `maxSteps`
- **WHEN** the completed local progress reaches that threshold
- **THEN** the Hook automatically confirms the interaction without requiring a separate manual click

### Requirement: Card Interaction Multi-Target Player Selection
The engine SHALL support `dt:card-interaction` payloads whose `selectPlayer` descriptor allows selecting up to `selectCount` target players before a single confirmation dispatch.

#### Scenario: Player selection keeps local progress before confirmation
- **GIVEN** a `dt:card-interaction` whose descriptor type is `selectPlayer`
- **AND** the descriptor declares `selectCount` greater than `1`
- **WHEN** the acting player locally selects one or more valid target players
- **THEN** the interaction remains open until the player confirms or cancels
- **AND** the current local selection is preserved for UI rendering

#### Scenario: Confirmation dispatches all selected player ids at once
- **GIVEN** a `dt:card-interaction` whose descriptor type is `selectPlayer`
- **AND** the acting player has selected one or more valid target players
- **WHEN** the player confirms the interaction
- **THEN** the client dispatches a single `RESOLVE_INTERACTION` command
- **AND** the command payload contains every selected player id in `selectedPlayerIds`

#### Scenario: Command validation rejects invalid or excessive targets
- **GIVEN** a `dt:card-interaction` whose descriptor type is `selectPlayer`
- **WHEN** a `RESOLVE_INTERACTION` command includes targets outside `targetPlayerIds`
- **OR** the number of unique selected targets exceeds `selectCount`
- **THEN** the command is rejected before state mutation

### Requirement: Interaction Semantic Truth Boundaries
The engine SHALL require each blocking interaction kind to represent one stable business semantic, rather than multiplexing unrelated meanings behind the same kind or field shape.

#### Scenario: Generic choice does not encode defender targeting
- **GIVEN** a game has a generic branch choice interaction kind and a dedicated defender-targeting interaction
- **WHEN** the game requests defender targeting for an attack chain
- **THEN** the request MUST use the dedicated defender-targeting interaction semantic
- **AND** the generic choice interaction MUST remain reserved for true branch or option selection

#### Scenario: UI readers stay scoped to their own interaction semantic
- **GIVEN** the current interaction is a dedicated defender-targeting interaction
- **WHEN** generic choice UI helpers read the current interaction
- **THEN** they MUST NOT surface that interaction as a generic choice payload
- **AND** dedicated UI readers MAY expose a defender-targeting payload for game-specific UI

### Requirement: Dedicated Defender Choice Interaction
Games that need to choose the defender of an in-flight attack SHALL be able to model that step as a dedicated blocking interaction instead of reusing a generic player-choice branch.

#### Scenario: Targeting roll opens dedicated defender choice
- **GIVEN** a DiceThrone 4-player targeting roll result that requires manual defender selection
- **WHEN** the attack cannot auto-resolve its defender
- **THEN** the system MUST open a dedicated defender-choice interaction
- **AND** the interaction payload MUST describe valid defender candidates for the current pending attack

#### Scenario: Defender choice resolution writes back the authoritative defender
- **GIVEN** a dedicated defender-choice interaction is resolved with a valid defender
- **WHEN** the domain applies that resolution
- **THEN** the pending attack MUST write that defender into its authoritative state
- **AND** the interaction MUST be marked complete without going through generic simple-choice handlers

### Requirement: 交互 SHALL 绑定所属 resolution frame 而不是独立持有主续链
InteractionSystem SHALL 把每个阻塞式交互绑定到其所属的 resolution frame。交互可以阻塞或解锁该 frame，但不得自行拥有第二套主续链、deferred follow-up 或阶段推进权。

#### Scenario: 交互阻塞并解锁所属 frame
- **GIVEN** 一个 resolution frame 在执行途中创建了交互
- **WHEN** 该交互进入 `sys.interaction.current`
- **THEN** 所属 frame MUST 进入 blocked 状态
- **AND** 当交互被解决后，系统 MUST 恢复同一 frame 继续推进

#### Scenario: 交互切换时不再由通用系统拼接游戏私有 continuation
- **GIVEN** 一个交互解决后队列中的下一个交互成为 current
- **WHEN** InteractionSystem 切换 current / queue
- **THEN** 它 MAY 刷新候选与更新通用元数据
- **BUT** 它 MUST NOT 代表游戏拼接第二套私有主续链或决定 deferred follow-up 的补发时机

### Requirement: 历史桥接式交互适配 SHALL 被标记为 deferred anti-pattern
系统 MAY 暂时保留少量历史桥接式交互适配器以兼容既有游戏，但这些适配器 MUST 被明确标记为 deferred migration / anti-pattern，且 MUST NOT 作为新游戏或新重构的参考范式。

#### Scenario: SummonerWars route adapter 只保留为历史兼容事实
- **GIVEN** 某个既有游戏仍通过 route / adapter 把系统交互投影到本地 UI 模式
- **WHEN** 本轮任务并未修复该游戏的现实 bug
- **THEN** 该桥接 MAY 暂时保留而不立即重写
- **AND** spec / design MUST 明确它是 deferred migration
- **AND** 新游戏或新重构 MUST NOT 继续复制这种桥接主链

### Requirement: Smash Up ability prompt SHALL 绑定所属 resolution frame
当 Smash Up 能力运行时产出 prompt 时，InteractionSystem SHALL 把该 prompt 绑定到其所属 resolution frame，而不是允许游戏能力层自行持有第二套 continuation 主链。

#### Scenario: Prompt 恢复回同一 frame
- **GIVEN** Smash Up ability runtime 在某个 resolution frame 中产出了 prompt
- **WHEN** 该 prompt 进入 `sys.interaction.current` 并在之后被解决
- **THEN** InteractionSystem MUST 把结果回传给同一 resolution frame
- **AND** 后续继续执行 MUST 由该 frame 对应的 ability runtime 驱动

#### Scenario: Prompt 不得借 continuationContext 逃逸出 runtime owner
- **GIVEN** 一个 Smash Up prompt 需要多步上下文
- **WHEN** runtime 保存上下文供下一步使用
- **THEN** 该上下文 MUST 作为 ability runtime / frame owned data 存在
- **AND** InteractionSystem MUST NOT 要求能力层再维护第二条私有 continuation 主链

### Requirement: Simple Choice Ordered Multi-Selection
InteractionSystem SHALL support ordered multi-selection for `simple-choice` interactions whose semantics require preserving player-selected option order.

#### Scenario: UI response preserves selected order
- **GIVEN** a `simple-choice` interaction declares ordered multi-selection
- **WHEN** the player selects option `A` and then option `B`
- **THEN** the response payload SHALL preserve `optionIds` as `[A, B]`
- **AND** the interaction contract SHALL distinguish this from `[B, A]`

#### Scenario: Refresh does not erase ordering semantics
- **GIVEN** a `simple-choice` interaction declares ordered multi-selection
- **WHEN** the interaction options are refreshed from live state
- **THEN** the system MAY remove invalid options
- **BUT** the system SHALL preserve ordered-selection semantics for the response contract

### Requirement: Interaction 选项 SHALL 支持 AI-only hints 且不得污染业务 payload
交互系统 SHALL 允许选项携带仅供 AI 使用的语义 hints，并要求这些 hints 与真实业务 `value` 隔离，避免交互处理器把 AI 辅助字段误当成规则输入。

#### Scenario: 交互选项保留 AI-only hints
- **GIVEN** 某个 `simple-choice` 或等效交互的选项包含 AI-only hints
- **WHEN** 系统将该交互暴露给 AI 或从交互生成 `legalActions`
- **THEN** 系统 MUST 保留这些 hints 供 AI 评分与搜索使用
- **AND** 不得因为序列化或 legal action 映射丢失这些 hints

#### Scenario: 业务 payload 与 AI hints 保持隔离
- **GIVEN** 某个交互选项既包含真实业务 `value` 又包含 AI-only hints
- **WHEN** 玩家或 AI 最终提交交互响应
- **THEN** 交互处理器消费的业务 payload MUST 仅包含规则所需字段
- **AND** AI-only hints MUST 不改变既有 handler 的业务契约

### Requirement: 交互驱动的 AI 评估 SHALL 不依赖候选顺序
交互系统与 AI 框架的组合 SHALL 允许 AI 基于交互选项语义做决策，而不是在缺少语义时稳定依赖候选数组顺序。

#### Scenario: 多个交互候选存在不同语义收益
- **GIVEN** 某个交互存在多个都合法的候选选项
- **WHEN** AI 基于这些候选生成 `interaction-choice` 动作
- **THEN** AI 框架 MUST 能读取这些候选的语义 hints 进行区分
- **AND** 不得仅因为候选排在第一个就稳定被选中

#### Scenario: 多选交互聚合多个候选语义
- **GIVEN** 某个交互允许一次选择多个候选
- **WHEN** AI 评估不同组合的 `interaction-choice`
- **THEN** 系统 MUST 允许组合动作聚合其包含候选的语义 hints
- **AND** 使评分与搜索能够比较不同组合的累计收益或风险
