## ADDED Requirements
### Requirement: 幻想国度房间 setup SHALL 显式表达规则模式与扩展内容
系统 MUST 为 `fantasyrealms` 提供可持久化的房间 setup，用于表达当前对局是基础版多人、双人变体，还是启用新花色扩展的基础版/双人局。

#### Scenario: 建房时选择双人变体
- **GIVEN** 用户在幻想国度建房页选择 `规则模式 = 双人变体`
- **WHEN** 系统计算可选人数并提交建房参数
- **THEN** 可选人数 MUST 只剩 `2`
- **AND** 提交到服务端的 setup 数据 MUST 能明确读出这是双人变体

#### Scenario: 建房时选择新花色扩展
- **GIVEN** 用户在幻想国度建房页选择 `扩展内容 = 新花色扩展`
- **WHEN** 系统保存 setup 选择
- **THEN** 本地页、测试页、服务端与领域层 MUST 从同一份 setup 数据读出该扩展已启用

### Requirement: 幻想国度公开房间摘要 SHALL 暴露已启用扩展
系统 MUST 为大厅房间摘要提供可公开的幻想国度 setup 摘要，至少用于显示已启用的新花色扩展。

#### Scenario: 大厅展示新花色扩展房间
- **GIVEN** 某个幻想国度房间启用了新花色扩展
- **WHEN** 大厅构建公开房间摘要
- **THEN** `publicSetupSummary` MUST 标记该房间启用了扩展
