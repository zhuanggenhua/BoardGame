## ADDED Requirements

### Requirement: FantasyRealms 必须支持官方基础版 3~6 人开局
系统 SHALL 在玩家人数为 3~6 时按官方基础版初始化对局。

#### Scenario: 创建 4 人基础版对局
- **WHEN** 系统创建一个 4 人 `fantasyrealms` 对局
- **THEN** 每位玩家 MUST 起始拥有 7 张手牌
- **AND** 弃牌堆 MUST 初始为空
- **AND** 当前玩家 MUST 从已发牌后的剩余牌库开始行动

### Requirement: FantasyRealms 必须按人数切换回合流程
系统 SHALL 在 2 人与 3~6 人时使用不同的官方回合规则。

#### Scenario: 2 人双人变体
- **WHEN** 对局玩家数为 2
- **THEN** 系统 MUST 使用双人变体的“未满 7 张前摸 2 弃 1或拿 1 张弃牌”的规则

#### Scenario: 3~6 人基础版
- **WHEN** 对局玩家数为 3~6
- **THEN** 系统 MUST 使用基础版的“抽 1 弃 1”规则
- **AND** 若弃牌堆为空，当前玩家 MUST 只能从牌库摸牌

### Requirement: FantasyRealms 必须按模式切换结束阈值
系统 SHALL 根据当前模式切换结束条件。

#### Scenario: 基础版结束阈值
- **WHEN** 对局玩家数为 3~6 且弃牌堆达到 10 张
- **THEN** 系统 MUST 将对局标记为结束态
- **AND** 系统 MUST 使用正式计分裁定胜者或平局

#### Scenario: 双人变体结束阈值
- **WHEN** 对局玩家数为 2 且双方都满 7 张手牌并且弃牌堆达到 12 张
- **THEN** 系统 MUST 继续保持双人变体结束条件不变

### Requirement: FantasyRealms 运行时配置必须暴露 2~6 人边界
系统 SHALL 在运行时配置中暴露 2~6 人的 `fantasyrealms` 玩家数能力。

#### Scenario: 检查 manifest 与 engineConfig
- **WHEN** 团队检查 `fantasyrealms` 的 manifest 与 engine config
- **THEN** `manifest.playerOptions` MUST 覆盖 `2~6`
- **AND** engine 的 `minPlayers / maxPlayers` MUST 覆盖 `2~6`
- **AND** `manifest.enabled` MUST 仍保持 `false`
