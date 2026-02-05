# ugc-prototype-builder Spec Delta

## ADDED Requirements

### Requirement: 需求持久化
系统 SHALL 在 UGC Builder 状态中持久化需求描述（包含编辑器内填写的测试流程），并在保存/导入/导出时保持一致。

#### Scenario: 保存需求
- **WHEN** 用户在 Builder 中录入需求
- **THEN** 系统 MUST 将需求写入存储并随保存动作一并持久化

#### Scenario: 导入需求
- **WHEN** 用户导入 UGC 配置
- **THEN** 系统 MUST 恢复需求描述与结构化拆解

### Requirement: 需求输入面板
系统 SHALL 提供需求输入面板，用于承载用户原始需求文本及结构化拆解。

#### Scenario: 录入需求
- **WHEN** 用户填写需求文本
- **THEN** 系统 MUST 保存原始文本并允许结构化编辑

### Requirement: 区域级背面渲染模式
系统 SHALL 支持区域组件配置 `renderFaceMode`，用于控制正/背面渲染策略。

#### Scenario: 背面渲染区域
- **WHEN** 用户将区域设置为 `renderFaceMode=back`
- **THEN** 系统 MUST 强制该区域使用背面渲染

### Requirement: 手牌区动作钩子
系统 SHALL 支持手牌区配置通用动作钩子，并允许限制为“仅当前玩家生效”。

#### Scenario: 当前玩家按钮
- **WHEN** 动作钩子 scope 为 `current-player`
- **THEN** 系统 MUST 仅在当前玩家可见/可用

### Requirement: 出牌区钩子禁用
系统 SHALL 支持出牌区禁用动作钩子或规则钩子。

#### Scenario: 禁止钩子
- **WHEN** 出牌区设置 allowActionHooks=false
- **THEN** 系统 MUST 不显示动作钩子入口

### Requirement: 玩家数量推导
系统 SHALL 根据玩家信息组件数量推导玩家数量并注入上下文（+1 自己）。

#### Scenario: 推导玩家数
- **WHEN** 画布包含 N 个玩家信息组件
- **THEN** 系统 MUST 推导玩家数为 N+1 并写入上下文

### Requirement: 需求驱动数据生成
系统 SHALL 支持基于需求输入生成结构化数据集（非游戏特化字段）。

#### Scenario: 数据生成
- **WHEN** 用户触发数据生成并提供需求
- **THEN** 系统 MUST 生成结构化实例数据并写入实例列表
