## ADDED Requirements
### Requirement: 训练样本必须标注执行座位控制类型
系统 MUST 在每条训练决策样本中记录执行该命令的座位控制类型，以便离线区分真人、局部 AI 与远程 AI 决策来源。

#### Scenario: 记录真人座位命令
- **WHEN** 服务端采集一条由 human seat 执行的成功命令
- **THEN** 训练样本 MUST 包含该座位的控制类型为 `human`

#### Scenario: 记录 AI 座位命令
- **WHEN** 服务端采集一条由 local-ai 或 remote-ai seat 执行的成功命令
- **THEN** 训练样本 MUST 包含对应的控制类型

### Requirement: 在线训练采集默认优先记录真人决策
系统 MUST 默认只记录 human seat 的在线训练决策样本，避免 AI 自动命令污染真人学习数据。

#### Scenario: 真人对 AI 对局默认只记录真人
- **GIVEN** 某个在线对局同时包含 human 与 local-ai seat
- **WHEN** AI seat 自动提交成功命令
- **THEN** 服务端 MUST 跳过该条训练样本采集
- **AND** 当 human seat 提交成功命令时，服务端 MUST 继续记录样本

### Requirement: 游戏可显式放开全座位采集
系统 MUST 允许游戏 manifest 显式声明训练采集策略，以便在需要时保留 AI seat 样本。

#### Scenario: manifest 声明 all-seats
- **GIVEN** 某个游戏 manifest 显式声明训练采集策略为 `all-seats`
- **WHEN** human 或 AI seat 提交成功命令
- **THEN** 服务端 MUST 记录对应训练样本
- **AND** 样本 MUST 保留执行座位的控制类型元数据
