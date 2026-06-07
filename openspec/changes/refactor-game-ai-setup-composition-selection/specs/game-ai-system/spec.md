## ADDED Requirements

### Requirement: AI 准备阶段单选角色或阵营必须无倾向随机
系统 SHALL 要求所有游戏的本地 AI 在准备阶段选择单个角色、英雄或阵营时，从已完整可玩的合法候选池中进行可复现随机选择，不得按强度、打法、克制关系或角色风格制造固定倾向。

#### Scenario: 固定优先级不得主导选择
- **GIVEN** 某游戏处于准备阶段且存在多个合法角色或派系候选
- **WHEN** AI 为候选动作评分
- **THEN** 评分中不得存在静态优先级、角色强度、打法风格或克制关系权重
- **AND** 最终结果只能由合法候选池内的可复现随机扰动决定

#### Scenario: 选择理由必须可解释
- **GIVEN** AI 完成准备阶段角色或派系选择
- **WHEN** 系统生成决策 trace 或 reasoning summary
- **THEN** 决策理由 MUST 说明该选择来自已完成合法候选池内的可复现随机
- **AND** 不得说明“稳定”“高价值”“优先级更高”“克制对手”或“角色风格更适合”

### Requirement: AI 准备阶段必须保留受控随机
系统 SHALL 在准备阶段从合理候选集合中进行可复现的受控随机选择，避免专家难度或固定 seed 下长期集中到同一小集合。

#### Scenario: 多个合理候选之间产生变化
- **GIVEN** 多个候选的适配评分接近
- **WHEN** 使用不同 matchId 或等价 seed 进行准备阶段决策
- **THEN** AI MUST 在这些合理候选之间产生可复现但有变化的结果
- **AND** 不得永远选择同一个固定候选

#### Scenario: 单选游戏不得引入适配差距
- **GIVEN** 某游戏准备阶段只要求玩家选择一个角色或一个阵营
- **WHEN** AI 进行准备阶段选择
- **THEN** 候选之间不得因打法、对手、队友或攻略 profile 产生适配分差
- **AND** 已被其他玩家占用或未完整可玩的候选仍必须被排除

### Requirement: 只有组合选择阶段才允许使用 setup selection profile
存在同一玩家多次选择以形成组合的游戏 SHALL 维护本地 setup selection profile，用于第二次或后续选择时描述候选对象的组合协同；单选角色或单选阵营游戏不得使用 profile 给准备阶段选择制造倾向。

#### Scenario: SmashUp 第二派系使用派系组合 profile
- **GIVEN** SmashUp AI 处于派系选择阶段
- **WHEN** 当前玩家已经选过第一个派系，AI 评估第二个候选派系
- **THEN** 评分 MAY 使用派系 profile 与已选派系进行组合适配评估
- **AND** 机器人/巫师等派系只能因具体组合适配得分领先，而不能因固定列表领先

#### Scenario: Summoner Wars 单阵营选择保持随机
- **GIVEN** Summoner Wars AI 处于阵营选择阶段
- **WHEN** AI 评估候选阵营
- **THEN** 评分不得使用阵营 profile、对手已选阵营、先后手或风险偏好进行适配评估
- **AND** AI MUST 在 `selectable` 阵营池中可复现随机选择

#### Scenario: DiceThrone 单角色选择保持随机
- **GIVEN** DiceThrone AI 处于选角阶段
- **WHEN** AI 评估候选角色
- **THEN** 评分不得使用角色 profile、对手角色、队友角色或角色风格进行适配评估
- **AND** AI MUST 在不含施工中角色的已完成角色池中可复现随机选择
