## ADDED Requirements

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
