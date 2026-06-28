## ADDED Requirements

### Requirement: FantasyRealms 基础教程可通过标准教程路由启动
系统 SHALL 允许 `fantasyrealms` 通过现有 `/play/:gameId/tutorial` 教程路由启动基础教程，而不要求额外定制教程入口。

#### Scenario: 教程路由加载幻想国度基础教程
- **GIVEN** `fantasyrealms` 提供了教程 manifest
- **WHEN** 用户访问 `/play/fantasyrealms/tutorial`
- **THEN** 系统 MUST 解析并启动该教程 manifest
- **AND** MUST 进入 `fantasyrealms` 当前正式牌桌运行时

### Requirement: FantasyRealms 教程步骤必须能拦截正式回合命令
系统 SHALL 允许 `fantasyrealms` 的教程步骤对白名单外命令进行阻断，并基于真实领域事件推进步骤。

#### Scenario: 教程只允许当前教学动作
- **GIVEN** `fantasyrealms` 教程当前步骤只允许执行抓牌命令
- **WHEN** 玩家尝试执行与当前步骤无关的弃牌或其他命令
- **THEN** 系统 MUST 阻止该命令
- **AND** MUST 保持教程停留在当前步骤

#### Scenario: 教程根据真实抓牌或弃牌事件推进
- **GIVEN** `fantasyrealms` 教程步骤声明了对应的推进事件
- **WHEN** 领域层产生匹配的真实事件
- **THEN** 系统 MUST 推进到下一教程步骤
- **AND** MUST 不依赖前端手工改写教程进度
