## Context
当前 `ResourceFootprint` 主路径已能从 `SmashUpEvent` 与结构化 interaction 推导读写，但能力作者仍主要写普通 callback/program。排序系统需要 probe 执行能力，再从事件/交互反推 footprint。这个方案比手写读写合同好，但不是最干净：执行事实与 footprint 事实仍分散在“callback 生成事件”和“reactionResources 按事件类型解释”两层。

## Goals
- Effect primitive 是单一事实源：一个 primitive 同时提供执行与 footprint。
- 不新增“抽象桶”作为主语义；footprint 使用实际资源 ref（minion/base/playerHand/playerVp 等）。
- 保留现有 AbilityRuntime，新增 DSL 作为兼容层接入，避免一次性横扫全部卡牌。
- 反应排序优先读取 DSL footprint；只有非 DSL 能力才 probe 运行时产物。

## Non-Goals
- 本变更不一次性迁移所有 Smash Up 卡牌。
- 本变更不删除事件级 footprint 推导；它仍是非 DSL/旧能力的兼容与校验层。
- 本变更不改变用户可见 UI 流程：选择仍走现有 InteractionSystem。

## Decisions
1. **AbilityProgram metadata 扩展**：在 program 节点上新增可选 `deriveFootprint(context)`，sequence/branch 组合时递归合并。
2. **DSL primitives 编译为 AbilityProgram**：DSL 不绕过 runtime，也不新造 UI 弹窗系统；prompt primitive 仍生成标准 `InteractionDescriptor`。
3. **footprint 使用真实资源 ref**：例如移动随从写 `minion:<uid>`、来源/目标 `base:<index>`、`targetAvailability`；抽牌写 `playerHand/playerDeck`。
4. **probe 仍保留**：非 DSL 或 footprint derivation 抛错时保留现有 probe/fallback 机制。

## Risk / Mitigation
- 风险：sequence 中 prompt suspension 之后的剩余 program footprint 可能需要 context continuation。缓解：第一阶段 footprint 只用于 queue-time 排序，sequence 递归用当前 context 求上界 footprint；执行仍按 runtime continuation。
- 风险：primitive coverage 不足。缓解：先覆盖用户关注的移动/返回/抽牌/VP/交互选择/分支/optional；其他继续走旧路径。
