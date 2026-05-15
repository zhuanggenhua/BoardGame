## ADDED Requirements

### Requirement: 测试必须按行为级分层
系统 SHALL 将测试明确分为逻辑测试、集成测试、E2E、审计测试与调试测试，并为每一层定义默认用途与禁区。

#### Scenario: 选择测试层
- **WHEN** 开发者要验证游戏规则、命令流或交互链
- **THEN** 应优先选择能覆盖公开行为的层，而不是直接选择最浅的内部函数测试

### Requirement: 测试不得默认锁实现细节
系统 SHALL 默认禁止以调用次数、内部 helper 名称、内部状态形状或私有字段作为行为真相源。

#### Scenario: 重构后测试仍应稳定
- **WHEN** 业务行为未变但内部结构变化
- **THEN** 相关测试应尽量保持稳定；若不稳定，则应先调整测试 seam 或断言方式

### Requirement: 系统-owned 模块不得被默认 mock
系统 SHALL 将 mock 限定在系统边界；对项目自有模块的 mock 仅在确有边界测试需要时使用。

#### Scenario: 测试外部依赖
- **WHEN** 测试网络、时间、随机数、文件系统或外部服务
- **THEN** 可以 mock 边界依赖

#### Scenario: 测试自家模块
- **WHEN** 测试项目内部模块协作
- **THEN** 不应默认 mock 对方模块来证明协作成立

### Requirement: 重构不得以批量改测试作为默认解
系统 SHALL 将“为了适配内部实现而批量修改测试”视为需要复查测试设计、测试 seam 或文件组织的信号。

#### Scenario: 大量测试需要同步改动
- **WHEN** 同一轮重构导致多个测试文件同时依赖内部实现修改
- **THEN** 应优先检查是否应引入更深的 seam、统一 helper 或拆分测试结构

### Requirement: 测试必须依赖稳定测试接口
系统 SHALL 为高频行为测试提供稳定测试接口或行为端口，避免业务测试直接依赖内部字段形状。

#### Scenario: 交互系统内部结构变化
- **WHEN** InteractionSystem 调整 prompt 存储、option 字段或响应命令细节
- **THEN** 游戏业务测试应优先只修改 prompt facade/helper
- **AND** 不应要求每个能力测试逐个改 `sys.interaction` 或 `data.options` 访问

#### Scenario: 新增交互能力测试
- **WHEN** 开发者新增需要选择 prompt option 的游戏能力测试
- **THEN** 测试应通过游戏专用测试接口读取 prompt、定位候选并响应
- **AND** 测试体应表达用户/规则行为，而不是底层 InteractionSystem 数据形状

### Requirement: 大测试文件必须可拆分
系统 SHALL 要求超大测试文件按能力簇、交互簇或页面行为簇拆分，避免继续承载无关场景。

#### Scenario: 测试文件持续增长
- **WHEN** 一个测试文件同时覆盖多个无关行为簇
- **THEN** 应新建更聚焦的测试文件或移动用例，而不是继续吸纳新场景

### Requirement: 测试文件必须按行为簇命名
系统 SHALL 要求新增或迁移的测试文件用测试对象与行为命名，并禁止继续创建可无限吸纳场景的泛名文件。

#### Scenario: 新增测试文件
- **WHEN** 开发者新增游戏行为、交互链、配置合同或页面行为测试
- **THEN** 文件名应表达行为簇
- **AND** 不应使用 `new*`、`misc`、`regression`、`feedback`、`fixes` 这类泛名

#### Scenario: 拆分巨型测试文件
- **WHEN** 开发者从巨型测试文件迁出用例
- **THEN** 新文件应落到对应主题目录
- **AND** 原巨型文件不应继续承载该主题的新用例

#### Scenario: 测试结构门禁
- **WHEN** 游戏测试文件发生改动
- **THEN** 自动门禁应阻止新增泛名测试文件
- **AND** 应阻止给旧泛名测试文件净增加内容
- **AND** 应阻止新增 `e2e/src/games/**/__tests__` 镜像测试

### Requirement: 游戏行为测试必须有单一权威来源
系统 SHALL 将 `src/games/**/__tests__` 作为游戏 Vitest 行为测试的权威来源，并避免把 `e2e/src/games/**/__tests__` 作为第二份手工维护入口。

#### Scenario: 新增游戏行为测试
- **WHEN** 开发者新增或重构游戏行为测试
- **THEN** 测试应落在 `src/games/**/__tests__`
- **AND** 不应在 `e2e/src/games/**/__tests__` 新增第二份同名测试

#### Scenario: 镜像目录发生变更
- **WHEN** 变更涉及 `e2e/src/games/**/__tests__`
- **THEN** 系统应将其视为历史镜像/质量门禁兼容债务
- **AND** 验证应映射回对应 `src/games/**/__tests__` 权威测试
