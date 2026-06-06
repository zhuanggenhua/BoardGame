## ADDED Requirements

### Requirement: Smash Up ongoing/static effects SHALL use a unified authoring surface
Smash Up 的持续/静态数值效果 authoring SHALL 提供统一入口，覆盖 `power modifier`、`base power modifier` 与 `breakpoint modifier`，而不是继续把标准规则散落成业务文件里的 ad hoc imperative 函数。

#### Scenario: Standard attached ongoing rule uses structured definition
- **GIVEN** 一条规则语义属于“按附着或基地 ongoing 数量为目标提供固定数值修正”的标准持续效果
- **WHEN** 作者新增或迁移该规则
- **THEN** 该规则 SHALL 通过统一 authoring surface 声明来源、目标范围、数值与 variant policy
- **AND** 业务文件 SHALL NOT 再为这类标准规则单独手写 raw `_pod` / controller 判断。

### Requirement: POD variant semantics SHALL be inherit-or-override, never additive backflow
Smash Up ongoing/static effect runtime SHALL 将 POD 语义限制为 `inherit`、`override` 或 `baseOnly`，并且 `_pod` 规则 MUST NOT 反向影响基础版语义。

#### Scenario: POD override replaces base semantics without double counting
- **GIVEN** 某条持续效果在基础版与 `_pod` 版存在不同语义
- **WHEN** runtime 为 `_pod` 目标计算持续修正
- **THEN** 系统 SHALL 只应用 `_pod` 变体当前有效的那一份语义
- **AND** SHALL NOT 再把基础版规则额外叠加回 `_pod` 目标上。

#### Scenario: Base version remains isolated from POD-only semantics
- **GIVEN** 某条持续效果只在 `_pod` 变体上存在额外或覆盖语义
- **WHEN** runtime 为基础版目标计算持续修正
- **THEN** 基础版 SHALL 继续只使用自己的规则语义
- **AND** `_pod` 变体的补充规则 MUST NOT 回流污染基础版。

### Requirement: Copied and borrowed ongoing semantics SHALL use shared runtime identity helpers
Smash Up 的 copied / borrowed 持续效果语义 SHALL 通过共享 runtime identity helper 读取 POD 归一、controller lens 与 copied source，而不是要求业务规则直接硬比 raw `defId` 或重复拼接 `sourceControllerId ?? ownerId`。

#### Scenario: Copycat recognizes copied POD ongoing identity
- **GIVEN** 模仿者复制到一条 `_pod` 版持续力量语义
- **WHEN** runtime 计算这张模仿者的 copied power
- **THEN** 系统 SHALL 将该 copied source 归一到对应规则家族
- **AND** SHALL 生成与复制基础版同等的持续力量结果。

#### Scenario: Borrowed ongoing uses shared controller lens
- **GIVEN** 一张 borrowed ongoing 行动保留真实 owner，但由另一名玩家控制
- **WHEN** runtime 计算依赖持续效果控制者的数值规则
- **THEN** 系统 SHALL 通过共享 controller lens 判定该规则的实际控制方
- **AND** 业务规则 SHALL NOT 再重复实现 owner/controller/sourceControllerId 的局部拼接逻辑。

### Requirement: Legacy self-managed modifiers SHALL remain as audited exceptions only
无法被当前 unified surface 表达的持续效果 MAY 暂时保留 legacy `selfManaged` 实现，但它们 MUST 被视为受审计的例外路径，而不是新增标准规则的默认 authoring 方式。

#### Scenario: New standard rule cannot silently reintroduce legacy self-managed authoring
- **GIVEN** 一条新规则的持续效果语义已经能被 unified authoring surface 表达
- **WHEN** 作者为它实现持续数值效果
- **THEN** 该规则 MUST 优先使用 unified surface
- **AND** MUST NOT 在没有额外例外说明的情况下新增 legacy `selfManaged` 规则函数。

#### Scenario: Legacy exception keeps compatibility until migrated
- **GIVEN** 一条历史持续效果仍依赖当前 surface 尚未覆盖的复杂自定义算法
- **WHEN** 它继续通过 legacy `selfManaged` 路径运行
- **THEN** runtime SHALL 保持当前兼容行为
- **AND** 该规则 MUST 通过 focused tests 证明其 POD / copied / borrowed 语义边界。
