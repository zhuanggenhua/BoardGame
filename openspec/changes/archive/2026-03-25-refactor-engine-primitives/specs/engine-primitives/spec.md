# engine-primitives Specification

## Purpose
定义引擎层跨游戏复用的纯函数原语库。该层与运行时 `systems` 层并存，负责可组合的计算、容器、注册器与辅助工具，而不是承载整局运行时系统编排。

## ADDED Requirements

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
- **GIVEN** 一个 TagContainer 或 AttributeSet
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

## Design Decisions

### Parallel To Systems Layer
`engine-primitives` 是与 `engine/systems` 并存的引擎层能力，不是对 systems 层的删除或替换。

### Pure Functions And Containers
原语层优先提供纯函数、不可变容器和显式 registry，避免跨游戏共享可变单例。

### Domain Semantics Stay In Games
原语层提供“怎么计算、怎么组织”的通用能力；具体效果语义和游戏规则仍由各游戏 domain 层定义。
