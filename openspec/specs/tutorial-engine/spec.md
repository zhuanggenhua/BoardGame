# tutorial-engine Specification

## Purpose
TBD - created by archiving change implement-tutorial-system. Update Purpose after archive.
## Requirements
### Requirement: 教程状态管理
系统**必须 (MUST)** 能够管理教程的当前步骤，并在满足条件时推进到下一步。

#### Scenario: 启动教程
当玩家通过 UI 按钮启动教程时，系统应初始化状态，加载第一步，并显示遮罩层。
- Given 教程未激活
- When 玩家点击"开始教程"
- Then `active` 变为 `true`，`currentStepIndex` 重置为 `0`
- And UI 显示第一步的提示内容

#### Scenario: 根据交互推进
当教程步骤要求特定交互（如点击棋盘区域）时，如果玩家执行了该交互，系统应自动进入下一步。
- Given 当前处于步骤 3 (需要 "clickCell")
- When 玩家点击了正确的高亮格子
- Then Move 成功执行
- And `currentStepIndex` 自动递增到 4

#### Scenario: 阻止非法交互
当教程激活时，玩家点击非高亮区域的操作应该被拦截或忽略。
- Given 教程激活且当前步骤高亮 `cell-4`
- When 玩家点击 `cell-0`
- Then 点击事件被拦截，游戏状态不改变
- And (Optional) 显示"请按照指示操作"的提示

### Requirement: 视觉高亮系统
系统**必须 (MUST)** 能根据步骤配置，在屏幕上高亮特定元素。

#### Scenario: 元素高亮
当进入具有 `highlight: 'cell-4'` 的步骤时，对应的 DOM 元素应视觉上突出。
- Given `currentStep` 包含 `highlight: 'cell-4'`
- And 页面上存在 `data-tutorial-id="cell-4"` 的元素
- When 步骤激活
- Then 遮罩层在 `cell-4` 的位置挖洞或显示高亮边框
- And 提示框 (Tooltip) 自动定位到高亮元素附近

### Requirement: 教程标注展示模式
系统 SHALL 支持对已标注组件显示教程描述，形成“标注展示”模式。

#### Scenario: 右键标注组件
- **WHEN** 用户右键组件并输入描述
- **THEN** 系统 MUST 保存标注内容并关联组件的 `data-ugc-id`

#### Scenario: 教程展示标注
- **WHEN** 用户进入教程模式
- **THEN** 系统 MUST 根据标注内容在对应组件旁展示描述

