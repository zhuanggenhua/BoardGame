# domain-core Specification

## Purpose
TBD - created by archiving change implement-domain-core-and-systems. Update Purpose after archive.
## Requirements
### Requirement: 每个游戏提供独立的领域内核模块
系统 SHALL 允许每个游戏通过独立的领域内核模块定义规则主体，而不是把规则逻辑散落在 UI 或传输入口中。

#### Scenario: 游戏以 `domain/` 目录提供规则主体
- **GIVEN** 某个游戏目录位于 `src/games/<gameId>/`
- **WHEN** 该游戏接入自研引擎
- **THEN** 游戏 MUST 可以通过 `src/games/<gameId>/domain/` 提供自己的领域内核实现

### Requirement: Command 与 Event 必须可序列化
系统 SHALL 要求领域命令与领域事件是可序列化的纯数据。

#### Scenario: 命令进入传输与执行链
- **WHEN** 玩家发出一个领域命令
- **THEN** 该命令 MUST 可以被 JSON 序列化

#### Scenario: 领域内核产出事件
- **WHEN** 领域内核执行后产出事件
- **THEN** 该事件 MUST 可以被 JSON 序列化

### Requirement: 领域归约必须保持确定性
系统 SHALL 保证在相同初始状态与相同事件序列下，领域归约结果是确定的。

#### Scenario: 重放事件流
- **GIVEN** 一份初始领域状态和一段已记录的事件序列
- **WHEN** 系统按顺序回放这些事件
- **THEN** 最终得到的领域状态 MUST 与原执行结果一致

### Requirement: 对局状态统一拆分为 `sys` 与 `core`
系统 SHALL 使用统一的 `MatchState` 形状保存平台状态与领域状态。

#### Scenario: 初始化对局状态
- **WHEN** 系统创建一个新的对局
- **THEN** 状态 MUST 同时包含 `sys` 与 `core`
- **AND** 平台状态与领域状态 MUST 分别存放

### Requirement: New or migrated durable domain references use runtime entity identity

Domain state introduced by new games or newly migrated state families that can survive beyond the immediate command or reducer branch MUST reference runtime objects by entity identity rather than by current coordinate.

Coordinates such as slot index, base index, row, column, hand index, or array position MAY be used for current-state lookup, UI targeting, sorting, and immediate command validation, but MUST NOT be the sole durable identity for state that can outlive replacement, movement, removal, delayed resolution, saved-game restore, or replay.

#### Scenario: Replacement object does not inherit old durable state

- **GIVEN** an entity in a board slot has a temporary modifier attached to its runtime identity
- **WHEN** that entity leaves play and a replacement entity enters the same slot
- **THEN** the temporary modifier is not applied to the replacement entity
- **AND** resolving the old modifier by slot alone is not allowed

#### Scenario: Immediate command may still use a coordinate

- **GIVEN** a player selects the current object in slot 2
- **WHEN** the command is validated immediately against current domain state
- **THEN** the coordinate can be resolved to the current entity
- **AND** any deferred state created from that command stores the resolved entity identity, not only slot 2

### Requirement: Entity references remain deterministic and serializable

Runtime entity references used by domain events, reducer state, saved games, tests, and replay MUST be serializable and deterministic.

Entity ids MUST be allocated by deterministic domain progression. They MUST NOT rely on random UUIDs, wall-clock time, process-local object identity, or non-replayable side effects.

#### Scenario: Replay allocates matching ids

- **GIVEN** a saved event sequence creates three runtime entities
- **WHEN** the sequence is replayed from the same initial state
- **THEN** the resulting entity ids match the original run
- **AND** entity-bound effects resolve to the same entities after replay

### Requirement: Stale entity references fail closed

When domain logic resolves an entity reference, it MUST confirm that the entity exists, has the expected kind, and is still valid for the requested operation. If the reference is stale or kind-mismatched, the operation MUST reject, skip, or clean up according to the owning rule; it MUST NOT silently retarget to another object occupying the same coordinate.

#### Scenario: Stale delayed effect is cleaned instead of retargeted

- **GIVEN** a delayed effect references an entity that has left play
- **WHEN** the delayed effect attempts to resolve
- **THEN** the resolver reports the reference as stale
- **AND** the effect is cleaned, rejected, or skipped according to its declared lifecycle policy
- **AND** no replacement entity at the old coordinate receives the effect

### Requirement: Domain rule state MUST be written only by rule paths
Domain values that affect validation, response-window settlement, final reducers, or player-visible formal results MUST be written through the game's rule path: command execution, domain events, reducers, or explicit domain helpers called by those paths.

UI selectors, player views, animation state, AI heuristics, debug snapshots, and test-only labels MUST NOT write or synthesize rule state.

#### Scenario: Dice roll crosses UI and rule branch
- **GIVEN** a game creates a dice roll that is shown to players and later selects an event branch
- **WHEN** the roll result is committed
- **THEN** the committed dice values and total MUST come from command/event/reducer state or a domain helper called by that path
- **AND** the event branch MUST NOT read UI animation state or preview text

#### Scenario: Damage crosses response and final settlement
- **GIVEN** a game creates damage that can be modified by a response window before HP changes
- **WHEN** responses complete
- **THEN** final HP loss MUST be resolved from the game's pending rule state or final damage event
- **AND** the visible damage summary MUST remain read-only

### Requirement: Domain views and estimates MUST NOT feed authoritative rules
Domain views, UI summaries, animation state, AI heuristics, debug snapshots, and test-only labels MUST NOT be used as authoritative inputs for validation, response-window settlement, final reducers, or player-visible formal values.

If a value is intended to influence rules, it MUST be produced through the domain command/event/reducer path or through an explicit domain helper called from that path.

#### Scenario: UI summary cannot become rule input
- **GIVEN** a UI summary displays a current damage, dice total, resource cost, or score value
- **WHEN** a rule checks whether an action is legal or what final event should be emitted
- **THEN** the rule MUST read domain rule state or committed event results
- **AND** it MUST NOT read the UI summary or its intermediate formatting fields

#### Scenario: AI hint cannot become player-visible formal value
- **GIVEN** an AI hint estimates expected damage, dice value, resource gain, or score
- **WHEN** a player-visible formal value or final settlement is needed
- **THEN** the system MUST use domain rule state or committed event results
- **AND** it MUST NOT expose the AI hint as the formal value

### Requirement: Domain readers MUST fail closed instead of reconstructing missing rule state from views
When validation, response windows, final reducers, or formal player-visible summaries require rule state, the reader MUST fail closed, reject, or use an explicitly declared domain fallback if that state is missing.

The reader MUST NOT silently reconstruct missing rule state from UI state, AI estimates, animation values, debug snapshots, default definitions, or stale coordinates.

#### Scenario: Missing dice rule state is rejected
- **GIVEN** an event branch requires the committed result of a prior dice roll
- **WHEN** no committed roll exists in domain rule state or events
- **THEN** the branch resolution MUST fail closed or reject according to the owning rule
- **AND** it MUST NOT infer the dice result from animation state or display text

#### Scenario: Missing damage rule state is rejected
- **GIVEN** a response window attempts to modify incoming damage
- **WHEN** no matching pending damage exists in domain rule state or events
- **THEN** the system MUST fail closed or reject according to the owning rule
- **AND** it MUST NOT patch unrelated pending fields to continue
