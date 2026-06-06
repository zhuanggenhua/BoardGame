## Context

Smash Up 当前的 modifier 注册由 `src/games/smashup/domain/ongoingModifiers.ts` 维护三套 registry：

- `registerPowerModifier`
- `registerBreakpointModifier`
- `registerBasePowerModifier`

其中 `_pod` alias 生成器默认假设“基础版规则应自动复用到 POD”，再由个别调用点用 `handlesPodInternally` 这类布尔补丁阻止重复 alias。这个模型的问题是：

- 调用接口表达的是“怎么避免框架出错”，而不是“这条规则的变体语义是什么”
- 自管变体规则和仅基础版规则都要靠调用者记忆一颗布尔位
- alias 生成、运行时计算、审计可见性三处都在间接解释同一个布尔语义
- 当规则本身带有“原版 / POD 不同牌面能力”时，很容易出现重复 alias 或错误暴露

极地突击队员暴露的就是这类结构性问题：它的规则函数已经自己区分原版 / POD，但 registry 仍把它当作默认可 alias 的基础版规则，再额外生成一份 `_pod` 注册，最终导致原版目标被重复计算。

## Goals / Non-Goals

- Goals:
  - 让 modifier registry 的变体复用策略成为显式 interface，而不是布尔补丁
  - 保持 Smash Up 当前规则语义与审计口径不变
  - 用最小改动收敛 power / breakpoint / base power 三类 registry 的同类 footgun
  - 让声明式 helper 与自定义 modifier 注册都能稳定表达“共享 / 自管 / 仅基础版”三种意图
  - 让 `ongoing_modifiers.ts` 的 authoring 入口收敛为“结构化定义 + 少量自定义回调”，不再把标准化持续牌分散成一堆单条 imperative 注册
- Non-Goals:
  - 不重写 Smash Up 全部持续效果为新的 DSL
  - 不把这套 seam 立即上升到跨游戏通用引擎层
  - 不在本次变更里清洗所有 POD 历史数据或文案差异

## Decisions

### Decision: 用显式变体注册模式替代外露布尔补丁

modifier registry 不再要求调用者传入 `handlesPodInternally: true/false` 这类低语义布尔位，而是提供显式的变体注册模式 / helper，稳定表达三种意图：

1. **shared alias**
   - 基础版规则自动复用到 POD
   - 适用于“原版与 POD 规则完全一致，调用点不自己分 variant”的规则

2. **self-managed variant**
   - 规则函数内部自行处理原版 / POD 差异
   - alias 生成器不得再补一份 `_pod`
   - 适用于 `defId.replace(/_pod$/, '')`、`matchesDefId(...)`、或显式区分 POD 行为的规则

3. **base-only**
   - 规则只属于基础版
   - 不为 `_pod` 生成 alias，也不在审计 registry 中暴露 `_pod`
   - 适用于“原版有此 modifier、POD 明确没有对应 modifier”的规则

接口命名在实现期可微调，但语义必须显式落在 interface 上，而不是继续由调用点塞一个布尔位解释。

### Decision: 保持默认路径最短，把显式 seam 留给特殊规则

为了满足“最小变化”，保留当前最常见的默认路径：

- 普通共享规则仍可通过最短 API 注册
- 只有自管变体或仅基础版规则需要显式选择不同 seam

这意味着实现不需要把所有调用点都改成冗长配置对象；但至少要让“自管变体”与“仅基础版”不再伪装成普通 shared alias 注册。

### Decision: 让声明式 helper 自带稳定模式，而不是把内部细节泄漏给调用点

像 `registerOngoingPowerModifier(...)` 这类 helper，本身已经在内部统一处理基础版 / `_pod` 卡实例；因此它应当直接绑定到稳定的变体模式，而不是再把“要不要生成 alias”泄漏给 helper 调用者。

同理，如果后续有其他注册 helper 天然只表达某一种变体策略，也应由 helper 内部固定，而不是要求业务卡牌调用点记住额外参数。

### Decision: 结构化 modifier 定义成为 Smash Up ongoing authoring 的首选 seam

除了 runtime registry 的显式变体策略外，业务 authoring 还需要单一入口。否则即使 runtime seam 正确，调用层仍然会继续在每个派系函数里散写：

- `registerOngoingPowerModifier(...)`
- `registerPowerModifier(...)`
- `registerBasePowerModifier(...)`
- `registerBreakpointModifier(...)`

这会让“规则本身”和“用哪种注册方式”继续分离，下一次仍可能因为调用点写法不同而出现结构性偏差。

因此本次进一步约束：

1. **标准 attached/base ongoing 规则**  
   - 优先写成结构化定义列表（如 `defId/location/target/delta/condition`）
   - 再由单一 helper 批量注册

2. **需要自定义算法的 modifier**  
   - 仍允许保留 callback
   - 但要把 `sourceDefId` 与 `podStrategy` 放进同一份 definition object，再由批量 helper 注册

3. **不要求一次性 effect DSL 化**  
   - 这一步只收 ongoing/static modifier authoring
   - trigger / interaction / ability runtime 仍沿现有渐进迁移路线

### Decision: 三类 registry 共享同一套变体语义

这次变更不仅收 power modifier，还同时收：

- `registerBreakpointModifier`
- `registerBasePowerModifier`

原因不是它们都已经出 bug，而是这三类 registry 当前都处在同一套 alias / audit 解释链上；如果只修 `registerPowerModifier`，未来同类 footgun 仍会在另外两处重复出现。

## Risks / Trade-offs

- 风险：如果只做表面重命名，仍然会把“共享 / 自管 / 仅基础版”的判断留给调用点猜。
  - Mitigation: 实现必须体现为独立 seam 或独立模式，而不是简单把 `handlesPodInternally` 改名。
- 风险：审计测试可能依赖现有 `_pod` 可见性口径，迁移时容易误改。
  - Mitigation: 将 audit 暴露规则作为显式回归场景保留，不把“运行时不 alias”和“审计里不可见”混成一个隐式副作用。
- 风险：迁移时若误把 base-only 注册改成 self-managed，可能在未来又被错误共享给 POD。
  - Mitigation: 为 base-only 增加独立测试场景，不只靠极地突击队员单例验证。

## Migration Plan

1. 在 `ongoingModifiers.ts` 定义显式变体注册 seam。
2. 让 alias 生成与注册表审计统一读取新 seam。
3. 让 `registerOngoingPowerModifier` 内部绑定稳定模式。
4. 迁移 `abilities/ongoing_modifiers.ts` 中当前依赖 `handlesPodInternally` 的自定义规则。
5. 将标准化 attached/base ongoing 规则收敛到结构化定义表，将批量自定义 modifier 改走 definition helper。
6. 补 registry 级与黑熊骑兵回归测试。

## Open Questions

- 最终 interface 更适合做成“命名 helper”还是“单一 API + 显式 mode”？
  - 本次偏向最小变化，优先选择对现有调用点扰动更小、但语义仍显式的方案。
- `base-only` 是否需要在运行时和 audit 层分别建独立可见性策略？
  - 默认倾向保持两者一致，除非现有审计口径已经证明需要分离。
