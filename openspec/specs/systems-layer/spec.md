# systems-layer Specification

## Purpose
TBD - created by archiving change implement-domain-core-and-systems. Update Purpose after archive.
## Requirements
### Requirement: 系统层以可插拔方式承载跨游戏能力
系统 SHALL 提供可插拔的系统层，用于承载跨游戏复用的平台能力。

#### Scenario: 游戏启用系统列表
- **GIVEN** 某个游戏声明启用的系统列表
- **WHEN** 游戏运行
- **THEN** 已启用系统 MUST 参与命令执行与事件处理链路

### Requirement: 系统通过统一生命周期参与执行
系统 SHALL 通过统一生命周期 hook 观察并影响执行过程。

#### Scenario: 命令执行生命周期
- **WHEN** 系统处理一条命令
- **THEN** 引擎 MUST 按约定调用系统生命周期
- **AND** 系统 MUST 可以在领域执行前后参与处理

### Requirement: 交互与选择是系统层的一等能力
系统 SHALL 提供统一的交互能力来承接需要玩家做出选择的状态。

#### Scenario: 领域规则请求玩家选择
- **WHEN** 领域规则需要玩家从若干选项中做出选择
- **THEN** 系统 MUST 能创建统一的交互状态
- **AND** 共享 UI MUST 能消费该状态进行渲染和提交

### Requirement: 撤回由系统层统一实现
系统 SHALL 由系统层统一实现撤回，而不是依赖每个游戏手动保存快照。

#### Scenario: 命令改变状态后可进入撤回历史
- **WHEN** 一条会改变对局状态的命令执行成功
- **THEN** 撤回系统 MUST 按配置记录可恢复的历史状态

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

### Requirement: 系统层 SHALL 围绕统一控制流权威协作
系统层 SHALL 允许 Modal、Interaction、ResponseWindow、Flow 等复用系统围绕统一控制流权威协作。跨游戏系统可以拥有各自的局部状态，但 MUST 通过统一 owner/frame 关系接入，而不是各自维护互不相认的主恢复栈。

#### Scenario: 复用系统共享同一 owner/frame 关系
- **GIVEN** 一个复杂游戏链路先后打开了 interaction、response window 与 blocking modal
- **WHEN** 这些系统共同参与同一笔业务链
- **THEN** 它们 MUST 能映射到同一个 owner/frame 主链
- **AND** 不得出现每个系统都各自判断“我才是当前主链”的情况

#### Scenario: 游戏私有缓存只能是派生视图
- **GIVEN** 游戏仍保留某些私有候选列表、展示文案或调试 session
- **WHEN** 系统层需要判断当前业务链该恢复到哪里
- **THEN** 系统 MUST 以统一控制流权威为准
- **AND** 游戏私有缓存 MUST 只作为派生视图或兼容过渡数据

### Requirement: 历史反模式 SHALL 被隔离而不是继续扩散
系统层 SHALL 允许暂时保留已在线上稳定运行的历史桥接实现，但这些实现 MUST 被隔离为兼容层 / 迁移债务，MUST NOT 继续定义框架默认形态。

#### Scenario: Deferred migration 不参与本轮强制验收矩阵
- **GIVEN** 某个游戏当前没有现实 bug，但内部仍保留 route / adapter 式桥接主链
- **WHEN** 本轮统一控制流重构只覆盖必要实现面
- **THEN** 该游戏 MAY 仅被登记为 deferred migration
- **AND** 本轮强制验收矩阵 SHOULD 聚焦真实有问题的接入样本
- **AND** 后续扩展到第 100 个游戏时，框架默认实现 MUST 以统一 frame 主链为准

### Requirement: 系统层 SHALL 允许游戏声明式运行时作为系统所有权内的执行器
系统层 SHALL 允许像 Smash Up 这样的游戏在系统所有权边界内定义声明式能力运行时，但该运行时必须通过 resolution frame、interaction 和其他系统桥协作，不能绕过系统层直接拥有并行主链。

#### Scenario: 游戏 runtime 使用系统桥而不绕过系统所有权
- **GIVEN** 一个 Smash Up ability program 需要创建 prompt、补发 deferred follow-up 或进入 response-style bridge
- **WHEN** 运行时解释该 ability program
- **THEN** 它 MUST 通过系统层既有的 resolution frame / interaction / response 协议完成这些动作
- **AND** 游戏 runtime MUST NOT 直接创造脱离系统层 owner 的第二条业务主链

### Requirement: 响应窗口具备语义去重与冷却能力
系统层 ResponseWindowSystem MUST 在收到重复的响应窗口 OPENED 事件时进行语义去重，避免在短时间内反复 reopen 同一语义窗口导致交互循环。

#### Scenario: 重复 OPENED 在无进展时被抑制
- **GIVEN** 当前已存在语义等价的响应窗口
- **WHEN** 再次收到同一语义窗口的 OPENED 事件
- **THEN** 系统 MUST 忽略该 OPENED 事件并保持当前窗口不变

#### Scenario: 新语义窗口仍可打开
- **GIVEN** 当前响应窗口与新 OPENED 事件语义不等价
- **WHEN** 收到 OPENED 事件
- **THEN** 系统 MUST 正常打开新的响应窗口

### Requirement: 在线 AI 兜底使用稳定语义指纹判断进展
在线 AI watchdog MUST 使用稳定的语义指纹（不依赖 timestamp 派生 id）来判断进展与循环，避免响应窗口 id 变化造成误判。

#### Scenario: 响应窗口 id 变化不视为进展
- **GIVEN** 响应窗口重复 reopen 但语义指纹不变
- **WHEN** watchdog 评估进展
- **THEN** watchdog MUST 将其视为“无进展”并进入兜底处理

#### Scenario: 真人响应不被兜底干预
- **GIVEN** 当前响应窗口的 responder 为 human seat
- **WHEN** watchdog 评估兜底方案
- **THEN** watchdog MUST 不对该响应窗口执行自动跳过

### Requirement: 在线 AI watchdog 不依赖 enableAi 标记启动
在线 AI watchdog MUST 以 setupData.seatControllers 为准识别 AI seat，不得依赖 enableAi 标记是否存在。

#### Scenario: 缺少 enableAi 但 seatControllers 标记了 AI
- **GIVEN** setupData.enableAi 未设置或为 false
- **AND** setupData.seatControllers 存在并标记了 local-ai/remote-ai
- **WHEN** watchdog 执行兜底检测
- **THEN** watchdog MUST 仍然对 AI seat 启动兜底流程

#### Scenario: seatControllers 未包含 AI 时不触发 watchdog
- **GIVEN** setupData.seatControllers 未标记任何 AI seat
- **WHEN** watchdog 执行兜底检测
- **THEN** watchdog MUST 不触发任何自动推进

