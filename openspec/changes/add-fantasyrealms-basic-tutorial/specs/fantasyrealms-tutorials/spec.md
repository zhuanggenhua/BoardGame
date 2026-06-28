## ADDED Requirements

### Requirement: 幻想国度提供最小基础教程
系统 SHALL 为 `fantasyrealms` 提供一套面向正式牌桌的基础教程，用于解释核心回合循环。

#### Scenario: 基础教程覆盖核心抓弃流程
- **GIVEN** 玩家进入 `fantasyrealms` 基础教程
- **WHEN** 教程逐步推进
- **THEN** 教程 MUST 至少覆盖从牌库抓牌、从中央公开弃牌拿牌、抓牌后必须弃牌这三个核心行为
- **AND** 玩家只能执行当前步骤允许的真实操作

#### Scenario: 基础教程解释回合与终局
- **GIVEN** 玩家处于基础教程后半段
- **WHEN** 教程进入说明步骤
- **THEN** 教程 MUST 说明正常回合的抓弃顺序
- **AND** MUST 说明公开弃牌达到阈值后游戏结束这一终局条件

### Requirement: 幻想国度牌桌必须提供真实教程锚点
系统 SHALL 在 `fantasyrealms` 当前正式牌桌中提供与基础教程步骤对应的真实高亮锚点，而不是只在教程 manifest 中声明目标名。

#### Scenario: 关键操作区具备教程锚点
- **GIVEN** 玩家进入 `fantasyrealms` 基础教程
- **WHEN** 教程需要高亮关键操作区
- **THEN** 牌库抓牌区 MUST 提供稳定的 `data-tutorial-id`
- **AND** 中央公开弃牌区 MUST 提供稳定的 `data-tutorial-id`
- **AND** 手牌区或弃牌承接区 MUST 提供稳定的 `data-tutorial-id`

#### Scenario: 教程锚点落在正式牌桌而非替身层
- **GIVEN** 教程步骤指向某个 `fantasyrealms` 教学目标
- **WHEN** UI 渲染高亮
- **THEN** 高亮目标 MUST 落在当前正式牌桌的真实交互元素上
- **AND** MUST NOT 仅通过教程覆盖层伪造一个脱离棋盘实现的占位目标
