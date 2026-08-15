## ADDED Requirements

### Requirement: 法术能力目录执行器同步
系统 SHALL 让 Mage Wars 预设法术能力目录、GameConfig-compatible ability catalog 和法术能力执行器注册表保持同步，并继续复用引擎 `AbilityRegistry` / `AbilityExecutorRegistry`。

#### Scenario: 每个预设法术能力都有执行入口
- **WHEN** 运行时加载 Mage Wars 首批预设法术能力目录
- **THEN** 每个能力 ID MUST 同时出现在法术能力定义注册表和配置 ability catalog 中
- **AND** 每个能力 ID MUST 能通过法术能力执行器注册表按 `spell-cast` 标签找到执行入口
- **AND** 标记为 `needs-code` 的法术 MUST 保持显式缺口，不能静默冒充完整实现

### Requirement: 对象能力注册表运行时
系统 SHALL 通过 Mage Wars 游戏层能力注册表管理场上对象主动能力，并继续复用引擎 `AbilityRegistry` / `AbilityExecutorRegistry`。

#### Scenario: 当前对象能力全部可枚举
- **WHEN** 运行时加载 Mage Wars 对象能力目录
- **THEN** 当前 `MAGE_WARS_OBJECT_ABILITY_IDS` 中的每一个能力 ID MUST 出现在对象能力定义注册表中
- **AND** 每个定义 MUST 声明来源类型、行动速度、费用规则、目标模式和实现状态
- **AND** 未注册能力 MUST 在验证阶段 fail-close，不能静默当成无效果成功

### Requirement: 对象能力执行器分发
系统 SHALL 通过 Mage Wars 对象能力执行器分发 `USE_ARENA_OBJECT_ABILITY`，而不是在命令执行入口继续按能力 ID 堆叠独立结算分支。

#### Scenario: 已迁移对象能力保持行为不变
- **WHEN** 玩家使用已迁移的对象主动能力
- **THEN** 验证层 MUST 通过能力定义和对应验证器确认阶段、来源、费用、目标和使用次数
- **AND** 执行层 MUST 通过执行器注册表生成与迁移前等价的领域事件
- **AND** 现有两法师标准竞技场流程 MUST NOT 因能力入口重构回退

### Requirement: 状态原语迁移边界
系统 MUST 明确区分本 change 的对象能力入口重构与后续状态原语迁移，不得把旧字段半迁移成第二套真相。

#### Scenario: 旧状态字段仍未迁移
- **WHEN** 对象能力继续写入 `statusTokens`、`temporaryTraits` 或 `abilityUseRoundNumbers`
- **THEN** 本 change MUST 将这些字段标记为后续 TagContainer / ModifierStack 迁移债务
- **AND** 本 change MUST NOT 同时维护一套并行 buff 真相源
