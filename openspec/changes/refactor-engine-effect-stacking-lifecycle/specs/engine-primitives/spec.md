## ADDED Requirements

### Requirement: Persistent Effect Stacking Policies
引擎 SHALL 为持续效果提供统一的 stacking policy 原语与应用结果，而不是要求每个游戏自己在 apply gateway 外部决定如何叠加。

#### Scenario: Aggregate by target reuses existing target-owned instance
- **GIVEN** 某个持续效果声明按 target 聚合
- **AND** 目标上已经存在同类 effect instance
- **WHEN** 游戏再次应用该效果
- **THEN** 引擎 MUST 复用或刷新该 target-owned instance
- **AND** 返回结构化结果说明这是 refresh/stack，而不是新的独立 instance

#### Scenario: Aggregate by source keeps independent source-owned instances
- **GIVEN** 某个持续效果声明按 source 聚合
- **AND** 两个不同 source 对同一 target 应用该效果
- **WHEN** 第二个 source 进入 apply gateway
- **THEN** 引擎 MUST 区分这两个 source 的 instance ownership
- **AND** 不得把第二个 source 误并到第一个 source 的 instance 上

### Requirement: Instance-Owned Granted Tag Lifecycle
引擎 SHALL 让持续效果授予的 tags 具备明确的 instance/source ownership，以保证多个效果并存时可精确回收。

#### Scenario: Removing one instance does not tear down tags still granted by another instance
- **GIVEN** 两个不同 effect instance 都授予同一个 tag
- **WHEN** 其中一个 instance 被移除
- **THEN** 引擎 MUST 只移除该 instance 自己拥有的授予关系
- **AND** 仍被另一个 instance 维持的 tag MUST 保持存在

#### Scenario: Deactivating and reactivating an instance preserves ownership semantics
- **GIVEN** 一个持续效果因条件不满足而 inactive
- **WHEN** 其 ongoing 条件后续重新满足
- **THEN** 引擎 MUST 重新激活该 instance 的 granted tags
- **AND** 该过程 MUST 继续保持 instance-owned lifecycle，而不是退化成裸 tag 增减

### Requirement: Structured Stacking And Lifecycle Outcomes
引擎 SHALL 在 stacking / refresh / remove / deactivate 这些路径上返回可机读结果，便于游戏、日志与测试直接消费。

#### Scenario: Refresh result is distinguishable from fresh application
- **GIVEN** 某个 effect 命中了已存在 instance 的 stacking policy
- **WHEN** apply gateway 返回结果
- **THEN** 结果 MUST 能区分“新建 instance”和“刷新既有 instance”

#### Scenario: Removal outcome includes ownership-aware reason
- **GIVEN** 某个 effect instance 因生命周期变化被移除
- **WHEN** reconciliation 返回结果
- **THEN** 结果 MUST 提供可机读原因
- **AND** 该原因 MUST 足以区分 tag-triggered removal、stack refresh replacement 或显式 teardown
