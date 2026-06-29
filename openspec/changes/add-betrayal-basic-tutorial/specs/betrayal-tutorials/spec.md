## ADDED Requirements

### Requirement: 山屋惊魂提供多章节基础教程
系统 SHALL 为 `betrayal` 提供建立在当前正式牌桌之上的多章节基础教程，用于讲清角色选择、恶兆前主循环、第一剧本触发和第一剧本英雄线收尾。

#### Scenario: 默认教程覆盖基础主循环与第一剧本英雄线
- **GIVEN** 玩家进入 `betrayal` 默认基础教程
- **WHEN** 教程逐步推进
- **THEN** 教程 MUST 至少覆盖角色选择与确认进入对局
- **AND** MUST 覆盖恶兆前主循环中的移动、探索、使用物品或结束回合等真实动作入口
- **AND** MUST 覆盖第一剧本 `Crimson Jack Returns` 的英雄目标与英雄线收尾

#### Scenario: 默认教程不强行冒充完整规则书
- **GIVEN** 当前首轮基础教程只承诺基础主循环与第一剧本英雄线
- **WHEN** 玩家完成默认教程
- **THEN** 教程 MUST 明确让玩家知道基本目标、主要入口和第一剧本英雄线完成方式
- **AND** MAY 将叛徒视角、更多剧本或更复杂规则面留给后续子教程

### Requirement: 山屋惊魂正式页面必须提供真实教程锚点
系统 SHALL 在 `betrayal` 当前正式角色选择页、正式运行时和正式终局页中提供与教程步骤对应的真实高亮锚点，而不是只在教程 manifest 中声明目标名。

#### Scenario: 基础主循环关键对象具备教程锚点
- **GIVEN** 玩家进入 `betrayal` 基础教程
- **WHEN** 教程需要高亮关键操作区
- **THEN** 角色选择确认入口 MUST 提供稳定的 `data-tutorial-id`
- **AND** 恶兆前主动作区 MUST 提供稳定的 `data-tutorial-id`
- **AND** 左下持有区或放大入口 MUST 提供稳定的 `data-tutorial-id`
- **AND** 中央房间主视区或移动目标 MUST 提供稳定的 `data-tutorial-id`

#### Scenario: 第一剧本关键动作具备教程锚点
- **GIVEN** 教程进入第一剧本 haunt 章节
- **WHEN** 教程需要引导调查杰克、研究法阵、驱魔、攻击或帮助入口
- **THEN** 对应真实交互对象 MUST 提供稳定的 `data-tutorial-id`
- **AND** 高亮 MUST 落在当前正式页面的真实对象上，而不是教程覆盖层伪造的替身目标
