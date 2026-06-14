## ADDED Requirements

### Requirement: Interaction 选项 SHALL 支持 AI-only hints 且不得污染业务 payload
交互系统 SHALL 允许选项携带仅供 AI 使用的语义 hints，并要求这些 hints 与真实业务 `value` 隔离，避免交互处理器把 AI 辅助字段误当成规则输入。

#### Scenario: 交互选项保留 AI-only hints
- **GIVEN** 某个 `simple-choice` 或等效交互的选项包含 AI-only hints
- **WHEN** 系统将该交互暴露给 AI 或从交互生成 `legalActions`
- **THEN** 系统 MUST 保留这些 hints 供 AI 评分与搜索使用
- **AND** 不得因为序列化或 legal action 映射丢失这些 hints

#### Scenario: 业务 payload 与 AI hints 保持隔离
- **GIVEN** 某个交互选项既包含真实业务 `value` 又包含 AI-only hints
- **WHEN** 玩家或 AI 最终提交交互响应
- **THEN** 交互处理器消费的业务 payload MUST 仅包含规则所需字段
- **AND** AI-only hints MUST 不改变既有 handler 的业务契约

### Requirement: 交互驱动的 AI 评估 SHALL 不依赖候选顺序
交互系统与 AI 框架的组合 SHALL 允许 AI 基于交互选项语义做决策，而不是在缺少语义时稳定依赖候选数组顺序。

#### Scenario: 多个交互候选存在不同语义收益
- **GIVEN** 某个交互存在多个都合法的候选选项
- **WHEN** AI 基于这些候选生成 `interaction-choice` 动作
- **THEN** AI 框架 MUST 能读取这些候选的语义 hints 进行区分
- **AND** 不得仅因为候选排在第一个就稳定被选中

#### Scenario: 多选交互聚合多个候选语义
- **GIVEN** 某个交互允许一次选择多个候选
- **WHEN** AI 评估不同组合的 `interaction-choice`
- **THEN** 系统 MUST 允许组合动作聚合其包含候选的语义 hints
- **AND** 使评分与搜索能够比较不同组合的累计收益或风险
