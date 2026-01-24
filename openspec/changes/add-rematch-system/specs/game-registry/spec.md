## ADDED Requirements

### Requirement: RematchSystem 引擎系统
引擎层 MUST 提供 RematchSystem 系统，管理对局结束后的"再来一局"投票与重开逻辑。

#### Scenario: 双方投票后重开
- **WHEN** 对局结束（`ctx.gameover` 存在）
- **AND** 双方玩家均调用 `VOTE_REMATCH` 命令
- **THEN** 系统 SHALL 将 `G.sys.rematch.ready` 设为 `true`
- **AND** 房主（playerID '0'）触发 `reset()` 重置对局

#### Scenario: 单方投票等待
- **WHEN** 对局结束
- **AND** 仅一方玩家调用 `VOTE_REMATCH`
- **THEN** 系统 SHALL 将该玩家的投票状态记录到 `G.sys.rematch.votes`
- **AND** `G.sys.rematch.ready` SHALL 保持 `false`

#### Scenario: 取消投票
- **WHEN** 玩家已投票
- **AND** 该玩家再次调用 `VOTE_REMATCH`
- **THEN** 系统 SHALL 取消该玩家的投票（toggle 行为）

### Requirement: RematchState 状态结构
`G.sys.rematch` MUST 包含以下字段：
- `votes: Record<PlayerId, boolean>` — 各玩家投票状态
- `ready: boolean` — 双方是否都已投票

#### Scenario: 初始状态
- **WHEN** 对局开始（setup）
- **THEN** `G.sys.rematch` SHALL 初始化为 `{ votes: {}, ready: false }`

#### Scenario: 重开后状态重置
- **WHEN** 调用 `reset()` 重开对局
- **THEN** `G.sys.rematch` SHALL 重置为初始状态

### Requirement: RematchActions 通用组件
平台 MUST 提供 `RematchActions` 通用 UI 组件，供各游戏 Board 使用。

#### Scenario: 显示投票按钮
- **WHEN** 对局结束
- **THEN** 组件 SHALL 显示"再来一局"投票按钮

#### Scenario: 显示等待状态
- **WHEN** 当前玩家已投票但对方未投票
- **THEN** 组件 SHALL 显示"等待对手确认"提示

#### Scenario: 显示重开中状态
- **WHEN** `G.sys.rematch.ready` 为 `true`
- **THEN** 组件 SHALL 显示"双方已确认，重开中…"

## REMOVED Requirements

### Requirement: 基于 playAgain 的再来一局
**Reason**: 该方式创建新 match 并删除旧 match，导致另一方玩家 404 退出
**Migration**: 所有游戏改用 RematchSystem + `reset()` 方式
