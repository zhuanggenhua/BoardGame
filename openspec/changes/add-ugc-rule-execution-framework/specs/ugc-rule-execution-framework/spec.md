## ADDED Requirements

### Requirement: 规则执行框架（无游戏特化）
系统 SHALL 仅提供 DomainCore 规则执行框架，不内置任何游戏规则、牌型、比较逻辑或胜负条件。

#### Scenario: 执行入口
- **WHEN** 系统加载用户粘贴导入的规则代码
- **THEN** 系统 MUST 只以 DomainCore 契约执行并禁止访问宿主资源

#### Scenario: 禁止内置规则
- **WHEN** 系统提供规则执行框架
- **THEN** 该框架 MUST 不包含任何游戏规则或牌型比较逻辑

### Requirement: 规则代码来源约束
系统 SHALL 仅支持“需求 → 提示词 → 外部 AI → 粘贴导入”的规则代码来源，不提供手动代码编辑器。

#### Scenario: 粘贴导入
- **WHEN** 用户需要提供规则代码
- **THEN** 系统 MUST 提供粘贴导入入口并禁止手动编辑器

### Requirement: 通用组件骨架与动作钩子
系统 SHALL 提供通用组件骨架与动作钩子协议，但不得绑定任何具体规则。

#### Scenario: 动作钩子
- **WHEN** 用户配置组件动作
- **THEN** 系统 MUST 以通用 Command 结构传递给规则执行框架

#### Scenario: 钩子禁用
- **WHEN** 区域组件配置为禁用动作钩子
- **THEN** 系统 MUST 禁止该区域触发任何规则动作

### Requirement: 预览与运行执行一致
系统 SHALL 保证预览与运行使用同一执行链路与规则代码。

#### Scenario: 预览执行
- **WHEN** 用户在 Builder 中预览
- **THEN** 系统 MUST 与运行时一致地执行同一规则代码

### Requirement: 确定性与序列化
系统 SHALL 保证规则执行的确定性与状态序列化要求。

#### Scenario: 确定性随机
- **WHEN** 规则需要随机数
- **THEN** 系统 MUST 仅允许使用传入的确定性随机函数
