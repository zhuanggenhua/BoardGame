## ADDED Requirements

> 本 change 只收口 DiceThrone 4 人 / 2v2 玩家目标交互 Batch 2 中剩余的共享风险：self-only 交互分支与 enemy-set / `allOpponents` 语义，不重复 Batch 1 已完成的多人玩家目标 handler。

### Requirement: Batch 2 自目标状态交互兼容
系统 SHALL 在 4 人 / 2v2 模式下，正确支持 Batch 2 范围内仅限自身的状态交互；共享 UI、验证层与执行层 MUST 共同按真实 self-only 约束工作，不得因为多人模式扩张出额外候选玩家。

#### Scenario: Steadfast II 在 4 人模式下仍只允许移除自己的状态
- **GIVEN** 4 人 / 2v2 对局中狂战士触发 `Steadfast II`
- **WHEN** 系统打开 `remove-status-self` 对应的状态选择交互
- **THEN** 面板只展示狂战士自己的可移除状态 / token
- **AND** 客户端不得提交其他玩家作为 `targetPlayerId`

### Requirement: Batch 2 对手集合效果兼容
系统 SHALL 在 4 人 / 2v2 模式下，按真实敌方集合解析 `allOpponents` 与同类对手集合效果；执行层 MUST 区分“所有对手”与“所有非自己玩家”，不得把 ally 一并纳入。

#### Scenario: Meteor 的 collateral 只命中两名敌方玩家
- **GIVEN** 4 人 / 2v2 对局中炎术士触发 `Meteor`
- **WHEN** 系统结算 `collateral damage`
- **THEN** collateral 只会命中两名敌方玩家
- **AND** 不会误伤施放者本人或其队友

#### Scenario: Ultimate Inferno 的 collateral 在 2v2 下不会退化成“除自己外所有玩家”
- **GIVEN** 4 人 / 2v2 对局中炎术士触发 `Ultimate Inferno`
- **WHEN** 系统同时结算主目标效果与 `collateral damage`
- **THEN** 主目标效果仍按真实 defender 结算
- **AND** collateral 只会命中敌方集合，不会把 ally 一并纳入
