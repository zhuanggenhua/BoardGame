## ADDED Requirements

### Requirement: 回合制 AI SHALL 使用显式语义 hints 描述动作含义
系统 SHALL 允许 `legalActions` 及其来源候选携带 AI-only 语义 hints，用于表达目标关系、效果意图、收益风险与必要的特例覆盖，而不是只依赖动作类型或选项顺序推断。

#### Scenario: 友军与敌军目标语义被显式表达
- **GIVEN** 某个合法动作会指向玩家、单位、基地或卡牌目标
- **WHEN** 游戏为该动作或其候选目标生成 AI 语义信息
- **THEN** 语义 hints MUST 能表达该目标相对行动者是 `self`、`ally`、`enemy` 或 `neutral`
- **AND** 语义 hints MUST 能表达该动作更接近 `buff`、`debuff`、`destroy`、`move`、`inspect`、`resource` 或其他明确意图

#### Scenario: 通用语义不足时使用受控 override
- **GIVEN** 某个动作的真实语义不能仅靠目标关系与效果意图表达
- **WHEN** 游戏提供额外的 AI 语义信息
- **THEN** 游戏 MAY 提供如 `priorityHint`、`forcedTargetPolicy` 等受控 override
- **AND** 不得退化为散落在各处、无法复用的裸 `sourceId` if-else 体系

### Requirement: 公共 AI 层与游戏适配层 SHALL 明确分工
系统 SHALL 将回合制 AI 的通用框架能力收敛到公共层，并要求游戏层通过统一适配边界接入，而不是重复实现评分、搜索、预算与 trace 管理。

#### Scenario: 公共层统一管理框架能力
- **GIVEN** 任意游戏接入回合制 AI 框架
- **WHEN** 系统执行动作评分、搜索、预算控制、稳定 tie-break 或 trace 记录
- **THEN** 这些能力 MUST 由公共 AI 层统一提供
- **AND** 游戏层不得各自维护第二套同职能框架实现

#### Scenario: 游戏层专注提供语义与评估
- **GIVEN** 某个游戏实现自己的 AI 适配器
- **WHEN** 该适配器接入公共 AI 层
- **THEN** 适配器 MUST 至少能够提供合法动作、语义 hints、局面评估或动作估值能力
- **AND** 适配器 MAY 提供动作剪枝、隐藏信息采样和少量 rollout hook

### Requirement: AI 决策 trace SHALL 保持结构化且可解释
系统 SHALL 为本地回合制 AI 输出统一的结构化决策 trace，使调试者能够看见候选动作、语义 hints、评分贡献、搜索增量和最终 tie-break 结果。

#### Scenario: 评分式决策输出可解释 trace
- **GIVEN** 本地 AI 通过 scorer 对多个合法动作逐个打分
- **WHEN** 系统输出最终 `AiActionDecision`
- **THEN** 系统 MUST 能同时输出结构化 trace
- **AND** trace MUST 至少包含候选动作列表、每个动作的分数贡献和最终选中原因

#### Scenario: 搜索增强继续复用同一 trace 契约
- **GIVEN** 某个动作在基础评分之外还叠加了 lookahead、rollout 或其他搜索增量
- **WHEN** 系统记录该动作的决策过程
- **THEN** 搜索增量 MUST 作为同一 trace 契约中的一部分记录下来
- **AND** 不得另起一套与基础 scorer 互不兼容的调试输出格式
