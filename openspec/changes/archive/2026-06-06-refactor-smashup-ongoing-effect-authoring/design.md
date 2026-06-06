## Context
这轮极地突击队员、Copycat、细胞结合与若干 `selfManaged` 规则排查后，当前结论已经比较清楚：

- `_pod` alias 注册层的问题已被单独收口；
- 当前剩余风险主要集中在 `ongoing_modifiers.ts` 里的手写持续效果；
- 风险点不是“每条规则都错”，而是 authoring 模式本身仍然允许作者在局部重新发明 POD / copied / borrowed 语义。

项目已经有两条相关提案：

- `refactor-smashup-modifier-variant-registration`
- `refactor-smashup-effect-dsl-primitives`

但这两条分别解决的是：

- modifier registry 如何显式表达 POD 变体策略；
- effect primitive 如何成为执行与 footprint 的单一事实源。

它们还没有正式定义“Smash Up 持续/静态效果在业务层应该怎么写”。本提案补的就是这层 authoring contract。

## Goals
- 让 ongoing/static modifiers 有明确的一层 authoring surface，而不是继续靠散落的 `selfManaged` 函数。
- 把 POD 语义固定成“继承或覆盖”，禁止再出现补充后回流污染基础版的模型。
- 把 copied / borrowed / sourceControllerId / POD runtime identity 的常见判断沉到底层 helper，而不是每张卡自己判断。
- 支持渐进迁移，先收口高风险持续效果，不要求一次性改完整个 Smash Up 能力系统。

## Non-Goals
- 本提案不重写全部 onPlay / talent / trigger / reaction abilities。
- 本提案不要求一次性删除所有 legacy `selfManaged` 规则。
- 本提案不替代引擎级 provenance 重构；在那条提案落地前，仍复用现有 `sourceControllerId` 等运行时语义。
- 本提案不改变现有用户可见规则结果；目标是收口 authoring 与边界语义，不是改玩法。

## Decisions
1. **范围限定在持续/静态数值效果**
   - 只覆盖 `power modifier`、`base power modifier`、`breakpoint modifier` 与 copied-power 这类“持续计算型”规则。
   - 不把一次性行动、复杂 trigger、完整 interaction orchestration 一起拉进来。

2. **采用“两层 surface + 一个逃生舱”**
   - 第一层：结构化标准 surface，覆盖常见的 attached/base ongoing 数值规则、controller/owner 过滤、基础/敌方/己方目标范围、基础 metadata gate。
   - 第二层：显式 custom definition object，允许自定义算法，但必须通过统一 helper 读取 runtime identity、variant policy 与 controller lens。
   - 第三层：legacy `selfManaged` 逃生舱，仅用于当前 surface 表达不了的规则，并要求留审计与 focused test。

3. **POD 语义在 authoring surface 中变成一等字段**
   - `inherit`：基础版规则自动复用到 `_pod`
   - `override`：`_pod` 规则覆盖基础版语义，不得叠加回流
   - `baseOnly`：只属于基础版
   - 业务层不再通过 scattered boolean、raw `_pod` 判断或“顺手补一份 alias”表达这些语义。

4. **copied / borrowed 统一走 runtime helper**
   - copied ability / copied action 的识别必须支持基础版与 `_pod` 运行时 identity 归一。
   - borrowed ongoing 的控制者判定必须优先通过统一 controller lens，而不是在业务规则中重复写 `(sourceControllerId ?? ownerId)`。
   - 这层 helper 是 authoring surface 的组成部分，不允许只在个别规则里局部复用。

5. **先收口高风险规则，再阻止新债务**
   - 第一批迁移目标优先覆盖：
     - `steampunk_steam_man`
     - `fairies_daisy_chain`
     - `fairies_enchantment`
     - `cyborg_apes_juiced_up`
     - `base_monkey_lab`
     - `shapeshifters_copycat_copied_power`
     - `shapeshifters_cellular_bonding_copied_power`
   - 迁完第一批后，再把“标准规则不得新增 legacy `selfManaged`”变成正式门禁。

## Risks / Trade-offs
- 风险：短期内会出现“新旧两套 authoring 并存”。
  - Mitigation: 通过 capability 文档明确新规则入口，并把 legacy 路径标记为例外而不是默认。

- 风险：部分规则表面上是持续效果，实际还依赖复杂 runtime 状态，结构化 surface 不一定一步覆盖。
  - Mitigation: 保留 custom definition object 与 legacy escape hatch，避免为追求统一而过度抽象。

- 风险：与未来 engine-level provenance proposal 的边界可能重叠。
  - Mitigation: 本提案只消费当前 Smash Up 已存在的 runtime identity 语义，不自行扩成跨游戏 lifecycle 重构。

## Migration Plan
1. 先定义 authoring surface 与 shared helper。
2. 用最小改动迁移一批高风险持续效果规则。
3. 补 focused tests，证明 copied / borrowed / POD override 语义被统一承接。
4. 将新规则 authoring 门禁升级为“优先结构化 surface，legacy 需说明理由”。
5. 后续再逐批迁移低风险 legacy `selfManaged` 规则。

## Open Questions
- 第一版结构化 surface 是否需要直接覆盖 copied-power family，还是先让 copied-power 走 custom definition object？
- `override` 是否需要显式 `_pod` 定义存在时才生效，还是允许同一 rule family 在 definition list 内直接声明 base/pod 双变体？
