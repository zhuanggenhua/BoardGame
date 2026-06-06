## ADDED Requirements
### Requirement: 游戏注册表可声明 AI 训练采集策略
系统 MUST 允许游戏 manifest 的 AI 配置显式声明训练采集策略，并在注册表消费链路中保留该字段。

#### Scenario: manifest 声明训练采集策略
- **WHEN** 游戏 manifest 的 `ai` 配置声明 `capturePolicy`
- **THEN** 自动生成或运行时消费后的注册表条目 MUST 保留该字段
- **AND** 服务端训练采集链路 MUST 可读取该策略
