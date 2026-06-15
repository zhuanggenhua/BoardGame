## ADDED Requirements

### Requirement: Tag-Aware Effect Specifications
引擎 SHALL 在 `engine-primitives` 中提供统一的效果规格原语，用于把“效果定义”与“效果实例上下文”分开表达，而不是只传一个裸 `type` + params 对象。

#### Scenario: Game creates effect spec with source and target context
- **GIVEN** 某个游戏要施加一个效果
- **WHEN** 游戏层构造统一的 `EffectSpec`
- **THEN** 该 spec MUST 能同时表达效果定义、来源上下文、目标上下文与可选等级/元数据

#### Scenario: Spec remains game-agnostic
- **GIVEN** 不同游戏的效果语义不同
- **WHEN** 它们都使用共享 `EffectSpec`
- **THEN** 引擎 MUST 不要求所有游戏共享同一套业务效果类型枚举

### Requirement: Unified Tag-Aware Effect Application Gateway
引擎 SHALL 提供统一的效果应用网关，在进入具体 handler 前先做标签驱动的可应用判定与生命周期决策，而不是让每个游戏各自手写 required/immunity/block 逻辑。

#### Scenario: Required tags allow application
- **GIVEN** 一个效果声明了 required tags
- **AND** 目标当前满足这些 tags
- **WHEN** 游戏调用统一 apply gateway
- **THEN** gateway MUST 允许该效果继续进入具体 handler

#### Scenario: Immunity or blocked tags prevent application
- **GIVEN** 一个效果声明了 immunity tags 或 blocked tags
- **AND** 目标当前命中这些 tags
- **WHEN** 游戏调用统一 apply gateway
- **THEN** gateway MUST 阻止该效果应用
- **AND** 返回结构化的 blocked outcome，而不是要求游戏自行猜测失败原因

#### Scenario: Persistent effect grants tags during active lifecycle
- **GIVEN** 一个持续效果声明了 granted tags
- **WHEN** 该效果被应用并处于 active 状态
- **THEN** gateway MUST 让这些 granted tags 进入目标的 tag 生命周期

#### Scenario: Remove-with-tags ends active effect
- **GIVEN** 一个持续效果声明了 remove-with-tags 条件
- **WHEN** 目标后续获得这些 tags
- **THEN** gateway MUST 支持统一地将该效果移除或结束

### Requirement: Structured Effect Apply Outcomes
引擎 SHALL 为统一效果应用返回结构化结果，以显式区分成功应用、被阻止、已接受但当前 inactive 等不同状态。

#### Scenario: Blocked application returns machine-readable outcome
- **GIVEN** 一个效果因 tags 检查失败而不能应用
- **WHEN** apply gateway 返回结果
- **THEN** 结果 MUST 包含可机读的 outcome/reason

#### Scenario: Inactive persistent effect remains distinguishable from rejection
- **GIVEN** 一个持续效果已被接受，但因 ongoing 条件当前不生效
- **WHEN** apply gateway 返回结果
- **THEN** 结果 MUST 能与“完全被拒绝”区分开
