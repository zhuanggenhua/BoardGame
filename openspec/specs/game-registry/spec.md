# game-registry Specification

## Purpose
定义游戏注册与发现机制，统一游戏清单的生成、服务端注册与前端展示来源，确保新增游戏时只需维护单目录约定并保持实现映射与启用状态的一致性。
## Requirements
### Requirement: 单一权威游戏清单
系统 SHALL 从 `src/games/<gameId>/manifest.ts` 自动发现并生成权威清单，作为所有游戏 ID 与启用状态的唯一来源。

#### Scenario: 自动发现权威清单
- **WHEN** 系统执行清单生成脚本
- **THEN** 输出的清单包含所有目录内的 `manifest.ts` 条目

### Requirement: 服务端注册派生
系统 SHALL 从自动生成的权威清单派生服务端可对局游戏列表。服务端注册使用自建 `GameEngine` 接口（包含 `domain`、`systems`、`systemsConfig`），不依赖外部框架。

#### Scenario: 注册可对局游戏
- **WHEN** 服务端启动并读取生成的游戏清单
- **THEN** 仅注册 `type=game` 且 `enabled=true` 的游戏

#### Scenario: 游戏引擎类型安全
- **WHEN** 游戏清单条目注册到服务端
- **THEN** 每个条目的 `engine` 字段 SHALL 符合 `GameEngine` 接口（包含 `domain`、`systems`、`commandTypes`）

### Requirement: 前端展示派生
系统 SHALL 使用自动生成的权威清单作为前端展示的 ID 集合来源。

#### Scenario: 渲染大厅列表
- **WHEN** 前端渲染游戏大厅列表
- **THEN** 仅展示清单中存在且 `enabled=true` 的游戏条目

### Requirement: 实现映射一致性校验
系统 SHALL 在开发环境校验权威清单中的 `game` 条目是否具有对应实现映射。

#### Scenario: 缺失实现映射
- **WHEN** 权威清单包含未提供实现映射的游戏
- **THEN** 启动时抛出错误并阻止继续运行

### Requirement: 单目录新增游戏
系统 SHALL 支持通过新增 `src/games/<gameId>/` 目录完成新游戏接入，且无需修改其他文件。

#### Scenario: 新增游戏目录
- **WHEN** 新增游戏目录并补齐约定文件
- **THEN** 运行生成脚本后自动出现在大厅与服务端注册列表

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

### Requirement: 游戏作者名称元数据暴露
系统 SHALL 允许游戏注册表暴露轻量作者名称字段 `authorName`，供前台详情弹窗直接使用。

#### Scenario: manifest 声明作者名称
- **WHEN** 某个游戏的 `manifest.ts` 声明 `authorName`
- **THEN** 自动生成或消费后的前端游戏注册表 MUST 暴露该字段
- **AND** 游戏详情弹窗 MUST 可以直接读取该名称

#### Scenario: 未声明作者名称
- **WHEN** 某个游戏没有声明 `authorName`
- **THEN** 注册表生成与消费流程 MUST 继续正常工作
- **AND** 前台 MUST 可以回退到默认作者名称

#### Scenario: UGC 条目带出作者名称
- **WHEN** UGC 包元数据中包含 `author`
- **THEN** UGC 游戏注册条目 MUST 将其映射为 `authorName`

### Requirement: 游戏注册表显式暴露移动端元数据
系统 SHALL 要求启用中的游戏 manifest 显式声明移动端支持元数据，并在注册表消费链路中保留这些字段。

#### Scenario: 启用中的游戏声明移动端支持信息
- **GIVEN** 某个启用中的游戏 manifest 被纳入自动生成的注册表
- **WHEN** 运行时消费该注册表条目
- **THEN** 条目 MUST 暴露 `mobileProfile`
- **AND** 条目 MUST 暴露 `shellTargets`
- **AND** 当 `mobileProfile` 为 `landscape-adapted` 或 `portrait-adapted` 时，条目 MUST 可提供匹配的 `preferredOrientation` 与 `mobileLayoutPreset`

#### Scenario: UGC 或未额外声明的条目使用安全默认值
- **GIVEN** 某个注册表条目没有单独提供完整移动支持字段
- **WHEN** 运行时归一化该条目
- **THEN** 系统 MUST 为其补齐安全默认值
- **AND** 默认值 MUST 不把该条目误判为已完成移动端适配

