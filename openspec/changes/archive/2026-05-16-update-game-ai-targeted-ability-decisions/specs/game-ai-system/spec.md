## ADDED Requirements

### Requirement: 目标型 activated ability SHALL 展开为目标候选动作
当能力声明需要目标选择时，系统 SHALL 生成按目标展开的候选动作，并在通用合法性校验通过后进入 AI 评分。

#### Scenario: 支持的单目标能力生成多条候选动作
- **GIVEN** 某能力 requiresTargetSelection 且 count=1，目标类型为 unit 或 position
- **WHEN** AI 构建 activated ability 的合法动作候选
- **THEN** 系统 MUST 按可选目标展开为多条动作
- **AND** 每条动作 MUST 通过合法性校验后才进入评分

#### Scenario: 不支持的目标类型保持保守跳过
- **GIVEN** 目标类型为 card 或 count != 1
- **WHEN** AI 构建 activated ability 的合法动作候选
- **THEN** 系统 MUST 跳过该能力的目标展开

### Requirement: 目标语义 SHALL 影响评分并引导选择高价值目标
系统 SHALL 使用目标语义（归属、类型、关键距离、生命等）对候选目标进行评分，引导选择更符合战术意图的目标。

#### Scenario: 敌方目标优先压制
- **GIVEN** 目标候选包含敌方与友方单位
- **WHEN** AI 评估目标型 activated ability
- **THEN** 系统 MUST 将敌方目标标记为压制/进攻语义并提升其评分权重

#### Scenario: 友方目标优先保护或强化
- **GIVEN** 目标候选包含友方召唤师或冠军单位
- **WHEN** AI 评估目标型 activated ability
- **THEN** 系统 MUST 将友方关键单位标记为防守/增益语义并提升其评分权重
