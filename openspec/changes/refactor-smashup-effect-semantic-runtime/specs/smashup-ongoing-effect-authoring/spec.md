## MODIFIED Requirements

### Requirement: Legacy self-managed modifiers SHALL remain arithmetic-only audited exceptions
无法被当前 unified surface 直接表达的持续效果 MAY 暂时保留 legacy `selfManaged` 实现，但它们 MUST 被限制为“自定义数值公式”的受审计例外；目标合法性、material 判定、controller lens、copied / borrowed / variant 归一与 protection/suppression 语义 MUST 通过共享 semantic runtime 读取，而不是继续在业务层各写各的。

#### Scenario: Legacy self-managed modifier keeps custom arithmetic but reuses shared semantic queries
- **GIVEN** 一条历史持续效果仍依赖复杂的自定义数值算法
- **WHEN** 它继续通过 legacy `selfManaged` 路径运行
- **THEN** 该实现 MAY 保留自己的 arithmetic 逻辑
- **AND** 它 MUST 通过共享 semantic selector / helper 获取对象身份、controller 与 material 查询结果

#### Scenario: New self-managed modifier cannot hand-roll protection or target semantics
- **GIVEN** 一条新规则的特殊持续效果暂时还不能完全落到 unified surface
- **WHEN** 开发者为它新增 `selfManaged` modifier
- **THEN** 该实现 MUST NOT 在 modifier 函数里手写 protection、action/affect、controller lens 或 variant 语义
- **AND** 这些共享语义 MUST 继续由 semantic runtime 提供
