## ADDED Requirements

### Requirement: UGC Builder 草稿后端持久化
系统 SHALL 为已登录用户提供 UGC Builder 草稿的后端持久化能力，支持多项目管理与跨设备恢复。

#### Scenario: 保存草稿
- **WHEN** 登录用户在 UGC Builder 中触发保存或自动保存
- **THEN** 系统 MUST 将草稿数据写入后端并关联 ownerId

#### Scenario: 加载草稿
- **WHEN** 登录用户打开 UGC Builder
- **THEN** 系统 MUST 从后端加载该用户最近的草稿项目并恢复编辑状态

#### Scenario: 多项目列表
- **WHEN** 登录用户打开项目列表
- **THEN** 系统 MUST 返回该用户所有草稿项目及其更新时间

#### Scenario: 权限隔离
- **WHEN** 用户尝试访问他人的草稿项目
- **THEN** 系统 MUST 拒绝并返回权限错误
