## ADDED Requirements

### Requirement: 每个游戏提供领域内核模块
系统 SHALL 允许每个游戏以“运行时无关”的领域内核模块来定义规则。

#### Scenario: 发现领域内核
- **GIVEN** 存在游戏目录 `src/games/<gameId>/`
- **WHEN** 该游戏在约定位置提供领域内核模块（例如 `src/games/<gameId>/domain/`）
- **THEN** 平台可以通过适配层构建可运行的游戏，而无需在 Boardgame.io moves 中编写规则主体

### Requirement: Command 与 Event 必须可序列化
系统 SHALL 将 Command 与 Event 定义为可序列化的纯数据结构。

#### Scenario: 序列化 Command
- **WHEN** 玩家发出一个 Command
- **THEN** 该 Command 可以被 JSON 序列化（不包含函数、不可序列化对象或循环引用）

#### Scenario: 序列化 Event
- **WHEN** 领域内核产出 Event
- **THEN** 该 Event 可以被 JSON 序列化（不包含函数、不可序列化对象或循环引用）

### Requirement: Reduce 必须确定性
系统 SHALL 保证领域状态变更在“初始状态 + Event 流”条件下是确定性的。

#### Scenario: 回放确定性
- **GIVEN** 一个初始领域状态与一段已记录的 Event 流
- **WHEN** 系统按顺序回放并通过 reducer 应用这些 Events
- **THEN** 得到的最终领域状态与原始对局结束时的最终领域状态一致

### Requirement: 领域状态版本管理
系统 SHALL 支持领域状态的 schema 版本管理。

#### Scenario: 旧 schema 升级
- **GIVEN** 一个使用旧 schemaVersion 存储的对局
- **WHEN** 该对局被加载
- **THEN** 系统按该游戏提供的迁移规则升级领域状态，或以明确可执行的错误拒绝加载
