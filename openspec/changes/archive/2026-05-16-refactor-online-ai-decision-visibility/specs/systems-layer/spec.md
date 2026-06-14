## MODIFIED Requirements

### Requirement: 系统层支持玩家视角过滤
系统 SHALL 允许系统层与领域层共同参与玩家视角过滤，以支持隐藏信息游戏，并为在线 AI 决策提供 authoritative shared 与 private overlay 的组合能力。

#### Scenario: 向不同玩家广播状态
- **GIVEN** 对局中存在不应公开的隐藏信息
- **WHEN** 服务端向某个玩家广播状态
- **THEN** 系统 MUST 返回该玩家可见的过滤后视图

#### Scenario: 在线 AI 解析决策视图时只叠加必要的私有信息
- **GIVEN** 在线 AI 需要同时消费公共状态与 seat 私有信息
- **WHEN** 系统解析该 AI 的决策视图
- **THEN** 系统 MUST 以当前 authoritative shared 作为公共真相
- **AND** 仅在决策确实依赖私有信息时叠加该 seat 的 private overlay
- **AND** 不得把独立同步的 seat 快照整体当作当前权威公共状态使用
