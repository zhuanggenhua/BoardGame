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

