# Engine Primitives Specification

## Purpose
定义引擎层跨游戏复用的纯函数原语库。该层与运行时 `systems` 层并存，负责可组合的计算、容器、注册器与辅助工具，而不是承载整局运行时系统编排。
## Requirements
### Requirement: Shared Primitive Library
引擎 SHALL 提供 `src/engine/primitives/` 作为跨游戏共享原语入口，向游戏层暴露可复用的纯函数和工具模块。

#### Scenario: Game imports primitives from shared entry
- **GIVEN** 游戏需要使用表达式、条件、骰子或资源等底层能力
- **WHEN** 游戏从 `src/engine/primitives/` 或其子模块导入 API
- **THEN** 游戏可以直接复用引擎原语，而不需要依赖其他游戏的实现

#### Scenario: Primitive layer coexists with runtime systems
- **GIVEN** 引擎仍然保留 `src/engine/systems/` 运行时系统层
- **WHEN** 查看引擎分层职责
- **THEN** `systems` 负责运行时系统编排，`primitives` 负责纯函数原语与注册器，两者并存而不是互相替代

### Requirement: Game-Scoped Registry Primitives
引擎 SHALL 为可扩展原语提供按游戏实例化的注册器，而不是依赖全局单例。

#### Scenario: Condition registry is created per game
- **GIVEN** 某游戏需要自定义 condition handler
- **WHEN** 该游戏调用 `createConditionHandlerRegistry()` 并注册自己的 handler
- **THEN** handler 只作用于该 registry 实例，不污染其他游戏

#### Scenario: Ability registry remains game-scoped
- **GIVEN** 某游戏需要注册本游戏的 ability definition 或 executor
- **WHEN** 该游戏创建 `AbilityRegistry` 或 `AbilityExecutorRegistry`
- **THEN** 注册结果仅属于该游戏上下文，而不是写入全局共享状态

### Requirement: Immutable Value And State Primitives
引擎 SHALL 为数值、标签、属性、资源和区域操作提供不可变原语，调用后返回新容器或新结果，而不是原地修改输入。

#### Scenario: Modifier pipeline returns computed result without mutating container
- **GIVEN** 一个 `ModifierStack` 和基础数值
- **WHEN** 调用 `applyModifiers`
- **THEN** 系统返回计算结果与应用明细，且不要求原地修改原有 stack

#### Scenario: Tag and attribute containers evolve immutably
- **GIVEN** 一个 `TagContainer` 或 `AttributeSet`
- **WHEN** 调用 `addTag`、`removeTag`、`addAttributeModifier` 或类似 API
- **THEN** 系统返回更新后的容器，并保留原容器可供比较或回溯

### Requirement: Higher-Level Reusable Primitives
引擎 SHALL 在基础原语之上提供面向复用的高阶 primitives，用于能力执行、伤害计算、图集渲染、ActionLog 辅助、UI hints 等共享场景。

#### Scenario: Game composes reusable damage pipeline
- **GIVEN** 游戏需要统一伤害计算与 breakdown 生成
- **WHEN** 游戏调用 `damageCalculation` 相关 primitives
- **THEN** 游戏可以复用统一的伤害计算管线，而不必在每个游戏里重复实现一套底层计算器

#### Scenario: Game composes reusable presentation helpers
- **GIVEN** 游戏需要 sprite atlas、ActionLog 伤害来源标注或 UI hints
- **WHEN** 游戏使用对应的 primitives helper
- **THEN** 这些辅助能力可以在多个游戏之间共享，而不依赖单一游戏的私有 helper

### Requirement: Engine primitives provide runtime entity identity

The shared engine primitives layer MUST provide a reusable runtime entity identity model for games that need durable references to runtime objects.

The primitive MUST distinguish identity from coordinate and MUST be usable by cards, units, bases, board occupants, tokens, summons, rooms, or other game-defined runtime objects.

#### Scenario: Game defines an entity kind for replaceable objects

- **GIVEN** a game has replaceable board objects
- **WHEN** the game registers or constructs those objects through the entity identity primitive
- **THEN** each runtime object receives a deterministic entity id
- **AND** the object can still expose its current coordinate separately

### Requirement: Entity ref resolution validates kind and lifecycle

The shared resolver for entity references MUST validate entity id, entity kind, and lifecycle validity before returning a target object.

If a compatibility fallback is present, it MUST be treated as diagnostic or migration data unless a game-specific compatibility adapter explicitly permits fallback resolution.

#### Scenario: Kind mismatch is rejected

- **GIVEN** an entity ref says it points to a base
- **WHEN** the id resolves to a card, token, or another non-base entity
- **THEN** the resolver rejects the reference
- **AND** the operation cannot continue against the wrong object kind

#### Scenario: Compatibility fallback does not silently retarget

- **GIVEN** an old saved state contains a fallback coordinate for an entity ref
- **WHEN** the primary entity id is missing
- **THEN** the resolver does not automatically use the current occupant of that coordinate
- **AND** fallback resolution only occurs through an explicit compatibility adapter with definition and lifecycle checks

### Requirement: Coordinate primitives remain available but non-authoritative

The engine primitives layer MUST continue to support coordinates for board traversal, UI layout, hit testing, sorting, and immediate command targeting.

The primitive documentation MUST state that coordinates are current locations, not durable runtime identity.

#### Scenario: UI renders by coordinate after identity resolution

- **GIVEN** a UI needs to render bases left-to-right
- **WHEN** the domain provides current base entities and their coordinates
- **THEN** the UI may sort and render by coordinate
- **AND** any long-lived modifier shown on a base is read from state bound to that base's entity identity

### Requirement: Engine primitives SHALL avoid unproven generic value frameworks
Engine primitives SHALL NOT introduce a cross-game authoritative value framework unless at least two real games need the same reusable helper shape after local DomainCore boundaries have been audited.

Shared helpers MAY be added for read-only selectors, assertions, deterministic dice utilities, or provenance formatting when those helpers remove repeated local code. Shared helpers MUST NOT become a second write path for game rules.

#### Scenario: One-game issue stays local
- **GIVEN** only DiceThrone has a proven damage summary overreach
- **WHEN** the issue can be fixed by DiceThrone-local domain helpers and tests
- **THEN** the engine MUST NOT add a cross-game value framework
- **AND** the fix MUST stay in the DiceThrone domain or UI selector boundary

#### Scenario: Two games share the same selector assertion need
- **GIVEN** DiceThrone damage and Betrayal dice both need the same assertion that view selectors cannot consume AI hints
- **WHEN** the helper would remove repeated local guard code
- **THEN** engine primitives MAY provide a read-only assertion or test helper
- **AND** it MUST NOT own or mutate game state

### Requirement: Engine primitives SHALL mark heuristic and visual values as non-authoritative
Any shared primitive or helper used for AI scoring, unavailable-action preview, animation, hover text, or rough evaluation MUST be explicitly separated from rule state.

#### Scenario: AI estimates before committed rule state exists
- **GIVEN** an AI evaluates a candidate action before a damage, dice, resource, or score result has been committed by rules
- **WHEN** it uses a heuristic value
- **THEN** that value MAY influence AI scoring
- **AND** it MUST NOT be used as player-visible formal value, rule-gating input, or final settlement value

#### Scenario: Animation dice cannot feed a rule branch
- **GIVEN** a dice animation shows intermediate or decorative dice faces
- **WHEN** a rule branch needs the committed dice result
- **THEN** the rule MUST read game domain state or committed event result
- **AND** it MUST NOT read animation-local dice faces

## Design Decisions

### Parallel To Systems Layer
`engine-primitives` 是与 `engine/systems` 并存的引擎层能力，不是对 systems 层的删除或替换。

### Pure Functions And Containers
原语层优先提供纯函数、不可变容器和显式 registry，避免跨游戏共享可变单例。

### Domain Semantics Stay In Games
原语层提供“怎么计算、怎么组织”的通用能力；具体效果语义和游戏规则仍由各游戏 domain 层定义。
