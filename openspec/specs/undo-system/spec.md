# undo-system Specification

## Purpose
提供跨游戏统一的撤销能力，支持自动快照、多人撤销握手、历史回溯。

## Requirements

### Requirement: 自动快照
系统 SHALL 在 Command 执行前自动保存状态快照，无需游戏手动调用。

#### Scenario: Command 执行前快照
- **WHEN** 系统接收到一个会改变领域状态的 Command
- **THEN** 系统在执行前自动保存快照到 `G.sys.undo.history`

#### Scenario: 可配置快照策略
- **GIVEN** 游戏配置了快照策略（如仅在回合开始保存）
- **WHEN** Command 执行
- **THEN** 系统按配置策略决定是否保存快照

### Requirement: 撤销恢复
系统 SHALL 支持从历史快照恢复游戏状态。

#### Scenario: 单步撤销
- **GIVEN** 历史记录中存在至少一个快照
- **WHEN** 撤销操作被批准执行
- **THEN** 系统从最近快照恢复 `G.core`，并从历史中移除该快照

#### Scenario: 历史为空时撤销
- **GIVEN** 历史记录为空
- **WHEN** 尝试执行撤销
- **THEN** 系统返回错误或忽略，状态不变

### Requirement: 多人撤销握手
系统 SHALL 支持多人对局的撤销请求与审批流程。

#### Scenario: 发起撤销请求
- **WHEN** 玩家 A 发起撤销请求
- **THEN** 系统记录请求到 `G.sys.undo.request`，状态变为等待审批

#### Scenario: 对手批准撤销
- **GIVEN** 存在玩家 A 的撤销请求
- **WHEN** 对手批准请求
- **THEN** 系统执行撤销，清除请求状态

#### Scenario: 对手拒绝撤销
- **GIVEN** 存在玩家 A 的撤销请求
- **WHEN** 对手拒绝请求
- **THEN** 系统清除请求状态，不执行撤销

#### Scenario: 撤销请求超时
- **GIVEN** 存在撤销请求且超过配置的超时时间
- **WHEN** 系统检查请求状态
- **THEN** 系统自动拒绝请求并清除状态

### Requirement: 统一状态存储
系统 SHALL 将撤销相关状态存储在 `G.sys.undo`。

#### Scenario: 初始化撤销状态
- **WHEN** 对局初始化
- **THEN** `G.sys.undo` 包含 `history: []` 和 `request: null`

### Requirement: 历史记录限制
系统 SHALL 支持配置历史记录的最大数量。

#### Scenario: 超出历史限制
- **GIVEN** 配置的历史上限为 N
- **WHEN** 保存第 N+1 个快照
- **THEN** 系统移除最早的快照，保持历史数量不超过 N

### Requirement: 与 Systems 层集成
撤销功能 SHALL 作为 Systems 层的 `UndoSystem` 实现。

#### Scenario: 系统 hooks 调用
- **WHEN** 系统处理 Command
- **THEN** `UndoSystem.beforeCommand` 在 Command 执行前被调用

## 与现有代码的关系

当前撤销能力由 `src/engine/systems/UndoSystem.ts` 实现并通过 `beforeCommand` 自动快照。
旧的 `src/core/UndoManager.ts` 已移除，撤销逻辑不再由游戏手动触发。
