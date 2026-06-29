## ADDED Requirements

### Requirement: Betrayal 教程目录可通过标准教程路由与子教程深链启动
系统 SHALL 允许 `betrayal` 通过现有 `/play/:gameId/tutorial` 与 `/play/:gameId/tutorial/:tutorialId` 路由加载默认基础教程及后续子教程，而不要求额外定制教程页面。

#### Scenario: 默认基础教程进入山屋惊魂正式牌桌
- **GIVEN** `betrayal` 提供了教程目录且声明了默认教程
- **WHEN** 用户访问 `/play/betrayal/tutorial`
- **THEN** 系统 MUST 加载默认教程 manifest
- **AND** MUST 进入 `betrayal` 当前正式角色选择页或正式运行时页面，而不是教程专用假页面

#### Scenario: 子教程通过 tutorialId 深链进入
- **GIVEN** `betrayal` 教程目录中声明了某个 `tutorialId`
- **WHEN** 用户访问 `/play/betrayal/tutorial/:tutorialId`
- **THEN** 系统 MUST 加载对应子教程 manifest
- **AND** MUST 从该子教程自己的首步启动

### Requirement: Betrayal 教程步骤必须绑定真实命令链与真实页面状态
系统 SHALL 允许 `betrayal` 教程步骤对白名单外命令进行阻断，并基于真实领域事件或真实 runtime 状态推进，而不是通过前端手工伪推进。

#### Scenario: 教程只允许当前山屋惊魂步骤对应的真实动作
- **GIVEN** `betrayal` 教程当前步骤只允许执行某个真实命令，例如移动、探索、使用物品或驱魔
- **WHEN** 玩家尝试执行与当前步骤无关的其他命令
- **THEN** 系统 MUST 阻止该命令
- **AND** MUST 保持教程停留在当前步骤

#### Scenario: 教程根据真实领域事件或真实状态推进
- **GIVEN** `betrayal` 教程步骤声明了对应的推进事件或步骤校验条件
- **WHEN** 领域层产生匹配的真实事件，或当前正式 runtime 已满足下一步前置
- **THEN** 系统 MUST 推进到下一教程步骤
- **AND** MUST NOT 依赖前端手工改写教程进度
