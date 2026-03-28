## MODIFIED Requirements

### Requirement: 服务端注册派生
系统 SHALL 从自动生成的权威清单派生服务端可对局游戏列表。服务端注册使用自建 `GameEngine` 接口（包含 `domain`、`systems`、`systemsConfig`），不依赖外部框架。

#### Scenario: 注册可对局游戏
- **WHEN** 服务端启动并读取生成的游戏清单
- **THEN** 仅注册 `type=game` 且 `enabled=true` 的游戏

#### Scenario: 游戏引擎类型安全
- **WHEN** 游戏清单条目注册到服务端
- **THEN** 每个条目的 `engine` 字段 SHALL 符合 `GameEngine` 接口（包含 `domain`、`systems`、`commandTypes`）

## ADDED Requirements

### Requirement: 类型安全命令分发
系统 SHALL 提供泛型命令分发机制，使 Board 组件调用命令时在编译期验证命令名称和 payload 类型。

#### Scenario: 合法命令调用
- **WHEN** Board 组件调用 `dispatch(COMMANDS.MOVE_UNIT, { unitId, position })`
- **THEN** TypeScript 编译通过，命令被发送到服务端执行

#### Scenario: 非法命令名编译错误
- **WHEN** Board 组件调用 `dispatch('nonExistent', {})`
- **THEN** TypeScript 编译失败，报告类型错误

#### Scenario: 错误 payload 类型编译错误
- **WHEN** Board 组件调用 `dispatch(COMMANDS.MOVE_UNIT, { wrongField: 123 })`
- **THEN** TypeScript 编译失败，报告 payload 类型不匹配

### Requirement: 状态同步传输层
系统 SHALL 提供基于 socket.io 的状态同步传输层，支持在线对局的实时状态广播。

#### Scenario: 在线命令执行与状态同步
- **WHEN** 玩家发送命令到服务端
- **THEN** 服务端执行 pipeline，对每个玩家应用 playerView 过滤后广播各自可见的状态

#### Scenario: 客户端重连恢复
- **WHEN** 客户端断线后重新连接
- **THEN** 服务端发送当前最新状态（经 playerView 过滤），客户端恢复到最新状态

#### Scenario: 旁观者只读
- **WHEN** 旁观者连接到对局房间
- **THEN** 旁观者接收状态更新但无法发送命令

### Requirement: 本地模式引擎
系统 SHALL 提供本地模式引擎，在客户端直接执行 pipeline，无需网络连接。

#### Scenario: 本地模式命令执行
- **WHEN** 本地模式下玩家执行命令
- **THEN** 命令在客户端本地执行 pipeline，状态立即更新，无网络请求

#### Scenario: 本地模式种子确定性
- **WHEN** 本地模式使用相同种子创建游戏
- **THEN** 相同命令序列产生相同状态（确定性重放）
