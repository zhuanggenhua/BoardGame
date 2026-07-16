## ADDED Requirements
### Requirement: 本地战术 AI SHALL 支持动作后局面差值评估
系统 SHALL 允许游戏本地 AI 在现有合法动作评分之外，基于“动作后局面价值 - 当前局面价值”评估候选动作，使 `projectAction` 类前瞻不再只依赖动作类型或局部 metadata。

#### Scenario: 动作投影使用前后差值
- **GIVEN** 某个本地 AI policy 已生成 `AiDecisionContext.legalActions`
- **WHEN** 游戏适配层能够安全投影某个候选动作
- **THEN** 系统 MUST 计算当前局面价值与动作后局面价值
- **AND** 搜索增量 MUST 以二者差值进入最终评分 trace

#### Scenario: 不可安全投影时保守降级
- **GIVEN** 某个候选动作无法在预算内安全投影
- **WHEN** 本地 AI 评估该动作
- **THEN** 系统 MUST 保守降级到 scorer-only 或既有 fallback
- **AND** 不得绕过 `legalActions` 或真实 validate / execute / reduce / systems 链构造专用结果

### Requirement: 本地战术 AI SHALL 支持阶段内短线序列搜索
系统 SHALL 允许游戏本地 AI 在同一阶段内执行受预算限制的短线候选序列搜索，每一步都必须基于动作执行后的新状态重新生成合法动作。

#### Scenario: 序列搜索每步重新生成合法动作
- **GIVEN** 本地 AI 正在搜索阶段内动作序列
- **WHEN** 搜索模拟执行了第一步候选动作
- **THEN** 系统 MUST 基于模拟后的状态重新生成 `legalActions`
- **AND** 不得继续使用旧状态上的候选动作列表作为后续步骤

#### Scenario: 序列搜索受预算和深度限制
- **GIVEN** 当前阶段存在大量合法动作
- **WHEN** 本地 AI 启用阶段内序列搜索
- **THEN** 系统 MUST 使用深度上限、候选 shortlist 和时间预算限制搜索
- **AND** 超出预算时 MUST 返回当前已知最佳动作或保守 fallback

#### Scenario: 序列搜索保持同一 trace 契约
- **GIVEN** 某个动作因序列搜索获得额外收益
- **WHEN** 系统输出 AI 决策 trace
- **THEN** trace MUST 包含序列路径、累计增益、剪枝或降级原因
- **AND** 不得另起一套与 scorer trace 不兼容的调试格式

### Requirement: 游戏 AI 策略 SHALL 支持 profile 化权重
系统 SHALL 允许游戏适配层为不同角色、阵营或策略类型提供 profile 化权重，使同一公共评分框架能够体现不同打法偏好，同时不改变规则合法性。

#### Scenario: Profile 只影响评分不影响合法性
- **GIVEN** 某个游戏为本地 AI 提供策略 profile
- **WHEN** AI 根据 profile 调整候选动作评分
- **THEN** profile MUST 只影响分数、排序和 trace
- **AND** 不得允许任何不在 `legalActions` 内的动作被执行

#### Scenario: Profile 贡献进入解释
- **GIVEN** 某个候选动作因策略 profile 获得加分或降权
- **WHEN** 系统输出 AI 决策 trace
- **THEN** trace MUST 记录对应 profile 维度和分数贡献
- **AND** 调试者应能区分基础局面价值、动作差值与 profile 权重

### Requirement: 完整 MCTS SHALL 作为独立可选扩展
系统 SHALL 将完整 MCTS 视为后续独立能力，而不是本地战术 AI 搜索升级的默认交付内容。任何 MCTS 实现都必须复用合法动作、可见信息、预算和 trace 边界。

#### Scenario: 战术搜索不要求 MCTS
- **GIVEN** 某个游戏接入局面价值函数、动作后差值和阶段内短线搜索
- **WHEN** 该游戏声明完成本地战术 AI 搜索升级
- **THEN** 系统 MUST NOT 要求其同时实现完整 MCTS
- **AND** 提案、任务和收口说明 MUST 明确 MCTS 是否属于本轮范围

#### Scenario: 未来 MCTS 复用既有边界
- **GIVEN** 后续 change 准备实现 MCTS
- **WHEN** 该 change 设计搜索树根节点和模拟执行
- **THEN** 搜索根节点 MUST 继续来自 `AiDecisionContext.legalActions`
- **AND** MCTS MUST 遵守 `playerView` 可见信息边界、预算限制和统一 trace 契约
