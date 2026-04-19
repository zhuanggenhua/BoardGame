## ADDED Requirements

### Requirement: 在线 AI 决策必须使用“公共真相 + 私有增量”视图
系统 SHALL 以 authoritative shared 作为在线 AI 决策的公共真相，并按需叠加 seat 私有 overlay，而不是在整份 sharedState 与整份 seat 快照之间二选一。

#### Scenario: 公开字段始终取当前 authoritative shared
- **GIVEN** 在线房当前 authoritative shared 已推进到新的 `phase / turn / currentPlayer`
- **AND** 某个 AI seat 的 `latestState` 仍停在上一拍
- **WHEN** 系统解析该 AI 的决策视图
- **THEN** 公共字段 MUST 以当前 authoritative shared 为准
- **AND** 不得直接信任 seat 快照里的旧公共字段作为当前权威真相

#### Scenario: 私有决策仍可读取 seat 专属信息
- **GIVEN** 某个 AI seat 拥有只对自己可见的 interaction options 或私有手牌信息
- **WHEN** 系统解析该 AI 的决策视图
- **THEN** 系统 MUST 允许从 private overlay 读取这些 seat 专属数据
- **AND** 不得要求 sharedState 承载本不应公开的私有信息

### Requirement: 框架必须默认自动推断决策是否需要 private overlay
系统 SHALL 默认根据当前决策输入来源自动推断本次 AI 决策是 `shared` 还是 `private-required`，并只允许少量特殊场景覆盖该默认规则。

#### Scenario: 公开 setup / 公开决策默认走 shared
- **GIVEN** 某个 AI 当前可执行动作只依赖公共 setup 状态、公共棋盘或公共资源
- **WHEN** 框架解析决策可见性
- **THEN** 框架 MUST 将其视为 `shared`
- **AND** 不得因为 seat overlay 缺失或 stale 就整体阻止该 AI 决策

#### Scenario: 隐藏交互 / 响应窗口默认需要 private overlay
- **GIVEN** 某个 AI 当前决策依赖 hidden interaction、response window 或 seat 专属 option 列表
- **WHEN** 框架解析决策可见性
- **THEN** 框架 MUST 将其视为 `private-required`
- **AND** seat overlay 未与当前 authoritative shared 对齐时，系统 MUST 阻止该 AI 基于过期私有视图出手

### Requirement: 客户端桥接层与服务端 recovery 必须使用同一套决策视图语义
系统 SHALL 让客户端 `OnlineAiSeatBridge`、`resolveNextAiAction` 调用链以及服务端 watchdog / legal-action recovery 复用同一套在线 AI 决策视图解析语义。

#### Scenario: 同一公开 setup 场景客户端与服务端结论一致
- **GIVEN** 某个在线 AI 处于公开 setup 决策场景
- **WHEN** 客户端桥接层与服务端 recovery 分别解析该 AI 决策视图
- **THEN** 双方 MUST 一致认为该场景可基于 authoritative shared 决策
- **AND** 不得出现一端能生成合法动作、另一端直接把该 AI seat 视为不可决策的分叉

#### Scenario: 同一私有决策场景客户端与服务端结论一致
- **GIVEN** 某个在线 AI 当前依赖 private overlay 才能看到合法候选项
- **WHEN** 客户端桥接层与服务端 recovery 分别解析该 AI 决策视图
- **THEN** 双方 MUST 一致要求 private overlay 与当前 authoritative shared 对齐
- **AND** overlay stale 时双方都不得基于过期私有视图提交动作

