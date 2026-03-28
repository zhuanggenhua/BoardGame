## MODIFIED Requirements

### Requirement: 教程状态管理
系统**必须 (MUST)** 将教程状态存放在引擎系统层（`G.sys.tutorial`）作为唯一权威来源，并通过系统管线推进步骤。

#### Scenario: 事件驱动推进
- Given 教程激活且当前步骤配置了 `advanceOnEvents`
- When 领域事件序列中出现匹配的事件
- Then `stepIndex` 自动递增
- And `currentStep` 更新为下一步

#### Scenario: 命令拦截
- Given 教程激活且当前步骤设置 `allowedCommands`
- When 玩家尝试执行不在允许列表中的命令
- Then 系统阻止命令执行
- And 返回错误提示（可由 UI 显示）

## ADDED Requirements

### Requirement: 教程随机策略
系统**必须 (MUST)** 支持在教程激活时覆盖随机数结果，用于固定骰子/抽牌等。

#### Scenario: 固定骰子
- Given 教程激活且随机策略为 fixed（values=[1,1,1,1,1]）
- When 玩家执行掷骰
- Then 随机结果始终为固定序列
- And 领域事件记录该结果

### Requirement: 教程 AI 行动
系统**必须 (MUST)** 支持在步骤进入时触发预设的 AI 行动，并在完成后推进。

#### Scenario: AI 行动执行
- Given 当前步骤配置了 `aiActions`
- When 系统进入该步骤
- Then UI 执行对应命令
- And 系统标记 AI 行动已消费（避免重复）

### Requirement: 教程视觉高亮
系统**必须 (MUST)** 向 UI 暴露当前步骤的高亮目标与提示配置。

#### Scenario: 高亮渲染
- Given 当前步骤包含 `highlightTarget`
- When UI 渲染教程遮罩层
- Then 对应元素被高亮
- And 提示框定位在目标附近
