## ADDED Requirements

### Requirement: 反馈管理应显示来源信息
管理端反馈列表 SHALL 显示反馈来源，并支持按来源筛选。

#### Scenario: 列表展示来源
- **WHEN** 管理员查看反馈列表
- **THEN** 每条反馈显示来源标识（用户/系统）
- **AND** 系统反馈显示具体来源（例如 online-ai-watchdog）

#### Scenario: 筛选系统反馈
- **WHEN** 管理员选择来源筛选条件
- **THEN** 列表仅展示匹配的反馈

#### Scenario: 详情展示来源信息
- **WHEN** 管理员打开某条反馈详情
- **THEN** 详情区展示 `reporterType/source/autoReportKind/incidentKey`（如有）
