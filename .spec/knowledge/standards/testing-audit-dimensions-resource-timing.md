---
name: testing-audit-dimensions-resource-timing
description: 资源时机审计维度：资源变化、触发顺序和结算窗口——审计资源类能力时查
metadata:
  type: doc
  status: 已交付
---

# 测试审计 D 维度细则：资源与时序

本文档承载资源守恒、时序正确、幂等重入和元数据一致细则；正文可引用其他 D 编号作为交叉门禁。

**D7 子项：验证层有效性门控（强制）**（新增/修改有代价的技能或 `directExecute` 类型能力时触发）：有资源消耗的操作，验证层必须确保操作至少能产生一个有意义的效果，否则拒绝激活。**核心原则：禁止让玩家花费代价换取零效果。** 审查方法：
1. **识别有代价操作**：grep 所有资源消耗字段（如 `cost`、充能/魔力/增益点等游戏特定资源），以及 `customValidator` 中检查资源的技能
2. **追踪执行层前置条件**：executor 中在"消耗资源"之后、"产生效果"之前的所有条件判断（如遍历棋盘找目标、检查候选列表非空），这些条件在验证层是否也有对应检查
3. **判定标准**：执行层存在"找不到目标则产生零效果事件"的路径 → 验证层必须提前拒绝该路径。执行层的效果保证非空（如固定对自身生效）→ 无需额外验证
4. **同步检查 `quickCheck`**：`AbilityDef.ui.quickCheck` 必须与 `customValidator` 的前置条件对齐，否则按钮显示但点击被拒绝（体验差），或按钮不显示但实际可用（功能缺失）


**D2 子项：验证-执行前置条件对齐（强制）**（新增技能或修"激活了但没效果"时触发）：验证层（`customValidator`）和执行层（executor）对同一操作的前置条件必须语义一致。**核心原则：验证层允许通过的每条路径，执行层都必须能产生至少一个有意义的效果；执行层的每个"零效果"early return，验证层都必须提前拒绝。** 审查方法：
1. **提取执行层隐含前置条件**：executor 函数体中，在产生核心效果事件之前的所有 early return / 空结果路径，每条路径对应一个隐含前置条件
2. **逐条比对验证层**：每个隐含前置条件在 `customValidator` 中是否有对应检查
3. **判定标准**：执行层 early return 空事件 = 操作无效果 → 验证层必须拒绝；执行层 early return 但已产生部分有意义事件 → 可接受
4. **反向检查**：验证层允许通过的所有路径，执行层是否都能产生至少一个有意义的效果？
**D8 子项：引擎批处理时序与 UI 交互对齐（强制）**（新增/修改阶段结束技能、`onPhaseExit`/`onPhaseEnter` 副作用、或修"确认后验证失败"时触发）：引擎层在单次命令处理中同步完成"副作用事件 + 阶段推进"，但 UI 层异步消费事件后弹出交互（确认/跳过），此时阶段可能已推进，导致 `requiredPhase` 验证失败。**核心原则：需要玩家确认的阶段结束效果，必须在确认完成前阻止阶段推进。** 审查方法：
1. **识别阶段边界交互**：grep 所有 `onPhaseExit`/`onPhaseEnter` 中产生的事件，检查哪些事件会触发 UI 交互（确认/跳过/选择）。信号：事件类型在 UI 事件消费层中设置了交互模式状态
2. **追踪时序链**：`onPhaseExit` 产生通知事件 → FlowSystem 推进阶段 → UI 消费事件弹出交互 → 玩家确认 → dispatch 命令 → 验证层检查 `requiredPhase`。如果阶段已推进，验证必然失败
3. **判定标准**：
   - 阶段结束技能描述含"你可以"/"may" → 需要玩家确认 → `onPhaseExit` 必须返回 `{ halt: true }` 阻止推进
   - 阶段结束技能自动执行（无玩家选择）→ 无需 halt，直接在 `onPhaseExit` 事件中完成
   - halt 后的恢复路径：确认执行 → 消耗资源/产生效果 → `onAutoContinueCheck` 检测无更多可确认技能 → 自动推进；跳过 → UI dispatch 阶段推进命令 → `flowHalted=true` 时 `onPhaseExit` 不再 halt → 正常推进
4. **防重复 halt 检查**：`onPhaseExit` 中 halt 条件必须检查 `!state.sys.flowHalted`，否则跳过后再次推进会无限 halt
5. **UI 跳过路径完整性**：跳过按钮的回调必须 dispatch 命令（如阶段推进命令），不能只清除 UI 状态，否则引擎层 `onAutoContinueCheck` 永远不会触发，游戏卡死
6. **事件产生门控普适性检查（强制）**：`onPhaseExit`/`onPhaseEnter` 中产生通知事件的循环逻辑，如果有 `canActivateAbility` 等门控函数，必须验证门控对循环中**所有技能**生效，禁止用 `abilityId === 'xxx'` 硬编码限定为特定技能。审查方法：
   - grep `onPhaseExit`/`onPhaseEnter`/`triggerPhaseAbilities` 等阶段触发函数中的 `abilityId ===` 或 `abilityId !==` 条件
   - 如果门控逻辑（如 `canActivateAbility`）被包裹在 `abilityId === 'specific_id'` 条件内，则该门控只对特定技能生效，其他技能绕过门控 = ❌
   - **正确模式**：门控函数直接应用于循环中的所有技能（`if (!canActivateAbility(...)) continue`），不附加 abilityId 限定
   - **错误模式**：`if (abilityId === 'feed_beast' && !canActivateAbility(...)) continue` — 只对 feed_beast 做门控，其他技能（如 ice_shards）绕过验证，产生无效事件
   - **缺陷链**：门控绕过 → 无效事件产生 → `hasConfirmablePhaseEndAbility` 正确判定无可确认技能（因为它调用了门控函数）→ 不 halt → 阶段推进 → UI 消费无效事件弹出确认框 → 玩家确认 → `requiredPhase` 校验失败（阶段已变）


**D8 子项：阶段退出真实推进链（强制）**（新增/修改 `trigger: 'onPhaseEnd'` 技能、`PHASE_END_ABILITIES`、`onPhaseExit`、`ADVANCE_PHASE`，或修“阶段结束技能定义存在但真实对局不触发 / 阶段结束后死亡替换没继续跑”时触发）：阶段结束技能不能只证明 `resolveAbilityEffects(...)` 会产出事件，必须证明真实阶段推进入口也会消费它。**核心原则：定义层触发、resolver 单测和真实 `ADVANCE_PHASE` 阶段退出是三层不同证据；缺少真实推进层时，玩家或 AI 结束阶段不会看到效果。** 审查方法：
1. **定义到阶段表**：所有 `trigger: 'onPhaseEnd'` 技能必须显式登记到 `PHASE_END_ABILITIES` 或等价阶段路由表；若不登记，必须在 evidence 写明它由哪条真实阶段退出链消费。
2. **真实入口验证**：至少补一条通过 `ADVANCE_PHASE` / FlowSystem / 真实阶段结束命令进入的行为测试，不能只直接调用 resolver、executor 或 handler。
3. **后处理验证**：阶段退出中产生的伤害、消灭、替换、充能等事件必须继续进入死亡后处理、被动触发、替换/召唤后续链；测试要断言最终棋盘/资源状态，而不是只断言事件数组里出现了前置事件。
4. **阶段推进收口**：强制/自动阶段结束效果不得残留 pending；可选阶段结束效果必须按 D8 的 halt/auto-continue 规则证明选择后能继续阶段推进。
5. **结构化守卫**：项目有阶段表时，建议加静态测试：所有 `onPhaseEnd` 定义都必须在阶段表中出现，防止新增技能“定义存在但阶段推进不消费”。
6. **典型缺陷链**：`AbilityDef.trigger = onPhaseEnd` → resolver 单测通过 → 未加入 `PHASE_END_ABILITIES` → 玩家点击结束阶段走 `ADVANCE_PHASE` 时没有任何事件；或阶段事件发出 `UNIT_DESTROYED` 后未跑死亡后处理，导致后续替换/被动不触发。


**D8 子项：写入-消费窗口对齐（强制）**（新增/修改在非常规阶段写入临时状态的机制，或修"写入了但从来没生效"时触发）：状态写入的时机是否在消费窗口内？写入后是否有机会被消费，还是会被回合/阶段清理逻辑先抹掉？**核心原则：写入正确 + 消费逻辑正确 ≠ 功能正确。如果写入发生在消费窗口之后（如攻击阶段后才写入 extraAttacks），状态会在下一个消费窗口到来之前被清理，功能永远不会生效但不报错。** 审查方法：
1. **画出阶段时间线**：列出完整的阶段顺序（如 `summon → move → build → attack → magic → draw → TURN_CHANGED`）
2. **标注写入时机**：状态在哪个阶段被写入？（如 extraAttacks 在 magic 阶段写入）
3. **标注消费窗口**：状态在哪个阶段被消费/检查？（如 extraAttacks 在 attack 阶段被 validate 检查）
4. **标注清理时机**：状态在哪个事件中被清理？（如 extraAttacks 在 `TURN_CHANGED` 中被重置为 0）
5. **判定**：写入时机 → 清理时机之间是否包含消费窗口？如果不包含 = ❌ 功能永远不会生效
6. **修复策略**：
   - **扩展消费窗口**（推荐）：允许在写入阶段也能消费（如允许 magic 阶段发起攻击）
   - **提前写入时机**：将写入移到消费窗口之前（如在 attack 阶段之前写入 extraAttacks）
   - **延迟清理时机**：将清理推迟到消费窗口之后（通常不推荐，容易引入状态泄漏）

**排查信号**：

**D8 子项：交互解决后的流程恢复（强制）**（新增/修改 `onPhaseExit` 返回 halt 的逻辑，或修"交互解决后仍需手动推进"/"需要点击两次"时触发）：当 `onPhaseExit` 返回 `{ halt: true }` 阻止阶段推进时，交互解决后必须通过 `onAutoContinueCheck` 自动恢复流程推进。**核心原则：halt 是临时阻塞，不是永久停止。交互解决后如果不自动推进，用户需要重复操作（如点击两次"结束回合"），体验极差。** 审查方法：
1. **识别 halt 场景**：grep 所有 `onPhaseExit` 中返回 `{ halt: true }` 的代码路径
2. **追踪 flowHalted 标志**：
   - `onPhaseExit` 返回 `{ halt: true }` → FlowSystem 设置 `state.sys.flowHalted = true`
   - 交互解决后 → `onAutoContinueCheck` 被调用
   - `onAutoContinueCheck` 必须检测 `flowHalted=true` 且无交互 → 返回 `{ autoContinue: true }`
   - FlowSystem 自动推进阶段 → 清除 `flowHalted` 标志
3. **检查 onAutoContinueCheck 的条件覆盖**：
   - ✅ 正确：`if (flowHalted && !interaction.current) return { autoContinue: true }`
   - ❌ 错误：无条件返回 `undefined`（交互解决后不自动推进）
   - ❌ 错误：只检查 `!interaction.current` 不检查 `flowHalted`（可能误触发）
4. **E2E 测试必须覆盖**：
   - 触发需要交互的阶段结束效果
   - 解决交互
   - 验证自动推进到下一阶段（不需要再次点击）
5. **反模式清单**：
   - ❌ 紧急修复时无条件禁止自动推进（如 `if (phase === 'xxx') return undefined`）
   - ❌ 只测试"交互创建"不测试"交互解决后的流程"
   - ❌ `flowHalted` 标志未被清理（导致后续阶段也被阻塞）

**典型缺陷链**：
1. 原始 Bug：某个交互导致无限循环
2. 紧急修复：完全禁止该阶段的自动推进
3. 副作用 Bug：交互解决后也不自动推进 → 需要点击两次
4. 测试盲区：单元测试只验证"交互创建"，E2E 测试缺失"交互解决后的流程"

**修复模板**：
```typescript
onAutoContinueCheck({ state }) {
    const phase = state.sys.phase;

    // 通用守卫：有交互时不自动推进
    if (state.sys.interaction?.current) {
        return undefined;
    }

    // 阶段特定逻辑
    if (phase === 'scoreBases') {
        // 情况1：flowHalted=true 且交互已解决 → 自动推进（恢复流程）
        if (state.sys.flowHalted) {
            return { autoContinue: true, playerId };
        }

        // 情况2：没有需要处理的内容 → 自动推进
        if (noWorkToDo(state)) {
            return { autoContinue: true, playerId };
        }

        // 情况3：有工作但未开始 → 不自动推进（等待用户触发）
        return undefined;
    }
}
```

**D8 子项：多系统 afterEvents 优先级竞争（强制）**（新增/修改引擎系统的 afterEvents 逻辑，或修"功能在测试中正常但实际无效"时触发）：多个引擎系统按 priority 顺序处理同一批事件时，低优先级系统的"状态驱动检查"可能在高优先级系统执行前误触发。**核心原则：系统 A（priority=15）在 afterEvents 中设置 `pendingInteractionId` 后，立即检查 `sys.interaction.current` 是否为空来决定是否解锁——但系统 B（priority=22）尚未执行 `queueInteraction`，`sys.interaction.current` 确实为空，导致系统 A 误判"交互已完成"并解锁/关闭窗口。** 审查方法：
1. **识别状态驱动检查**：grep 所有系统的 `afterEvents` 中读取其他系统管理的状态字段（如 `sys.interaction.current`、`sys.responseWindow.current`）的逻辑
2. **检查 priority 顺序**：读取方的 priority 是否低于写入方？如果是，同一轮 afterEvents 中读取方先执行，读到的是旧值
3. **检查前瞻守卫**：读取方是否有"同批事件中是否包含写入方的触发事件"的前瞻检查？没有 = ❌ 可能误触发
4. **测试必须断言所有相关系统的状态**：测试只断言 `sys.interaction.current` 存在但不断言 `sys.responseWindow.current` 仍打开 = ❌ 无法发现窗口被提前关闭的 bug

**典型缺陷模式**：
**修复策略**：
- **前瞻守卫（推荐）**：在状态驱动检查前，检查同批事件中是否包含会触发高优先级系统写入的事件（如 `hasInteractionLockRequest`），如果有则跳过本轮检查，等下一轮 afterEvents
- **延迟检查**：发出内部驱动事件（如 `_CHECK_UNLOCK`），在下一轮 afterEvents 中再检查
- **提升 priority**：将读取方的 priority 调整到写入方之后（通常不推荐，会影响其他逻辑）


**测试规范（强制）**：涉及多系统协作的功能（如响应窗口+交互系统），测试必须同时断言所有相关系统的状态：




**D8 子项：Trigger ctx.playerId 语义审计（强制）**（新增/修改 `afterScoring`/`beforeScoring` 等 ongoing trigger，或修"ongoing 卡效果不触发"时触发）：`fireTriggers` 对每个注册的 trigger **只调用一次**，`ctx.playerId` 固定为当前回合玩家。如果 trigger 用 `ctx.playerId` 来判断效果受益者（如卡牌 owner），则非当前回合玩家拥有的卡永远不触发。**核心原则：ongoing trigger 的受益者是卡牌的 `ownerId`/`controller`，不是 `ctx.playerId`。trigger 内部必须自行遍历所有来源实例的 owner，禁止直接使用 `ctx.playerId` 作为效果受益者。** 审查方法：
1. **识别受影响 trigger**：grep 所有 `registerTrigger` 调用，筛选 `afterScoring`/`beforeScoring`/`onMinionDestroyed` 等全局时机的 trigger
2. **检查 playerId 使用**：trigger 回调中是否用 `ctx.playerId` 来判断"谁拥有这张卡"或"谁是受益者"？如果是 = ❌ 误用
3. **正确模式**：遍历 `state.bases` 上所有同名 ongoing 实例，用每个实例的 `ownerId` 独立判断（如海盗副官遍历所有 first_mate 的 controller）
4. **例外**：`onTurnStart`/`onTurnEnd` 的 `playerId` 确实是当前回合玩家，且卡牌描述含"你的回合开始时"时可以合法使用

**典型缺陷模式**：

**D8 子项：回调函数 post-reduce 计数器时序（强制）**（新增/修改 onPlay/onMinionPlayed/onCardPlayed 等回调中的"首次"判定，或修"首次触发能力从不生效/每次都触发"时触发）：回调函数（如 `fireMinionPlayedTriggers`）接收的 `core` 状态是 reduce 之后的，计数器已递增。用 pre-reduce 假设（如 `minionsPlayed === 0` 表示首次）会导致条件永远不满足，能力静默失效。**核心原则：onPlay/onMinionPlayed 等回调在 pipeline 中位于 reduce 之后执行（`pipeline.ts` 先 reduce 事件再调用 triggers），因此回调中读到的计数器值已包含本次操作的递增。判定"首次"必须用 `=== 1`（post-reduce 值），而非 `=== 0`（pre-reduce 假设）。** 审查方法：

1. **确认回调时序**：追踪 pipeline 中回调的调用位置——是在 `reduce(core, event)` 之前还是之后？大多数 trigger 回调（`fireMinionPlayedTriggers`、`fireCardPlayedTriggers` 等）在 reduce 之后执行
2. **列出回调中的计数器检查**：grep 回调函数中所有读取 `minionsPlayed`、`minionsPlayedPerBase`、`cardsPlayed` 等计数器的条件表达式
3. **验证阈值正确性**：
   - post-reduce 回调中：首次 = `counter === 1`（reduce 已将 0→1）
   - post-reduce 回调中：非首次 = `counter > 1`
   - ❌ `counter === 0` 在 post-reduce 回调中永远不可能（至少本次操作已递增为 1）
   - ❌ `counter > 0` 在 post-reduce 回调中永远为 true（至少为 1），无法区分首次/非首次
4. **检查派生状态 vs 权威计数器**：
   - ❌ 用派生状态（如"基地上的随从数量"）判定"首次打出"——随从可能被消灭/移走后重新打出，数量=1 不等于首次
   - ✅ 用权威计数器（如 `minionsPlayedPerBase[baseIndex]`）判定——每回合重置，只递增不递减，语义精确

**典型缺陷模式**：
**修复策略**：
- 将 `=== 0` 改为 `=== 1`，将 `> 0` 改为 `> 1`（适用于 post-reduce 回调）
- 将派生状态判定替换为权威计数器（如 `minionsPlayedPerBase`、`minionsMovedToBaseThisTurn`）
- 如果权威计数器不存在，在 reducer 中新增（每回合重置，事件触发时递增）



**关联维度**：
- D1（语义保真）："首次"语义是否被正确实现？
- D3（数据流闭环）：计数器的写入（reduce）和读取（回调）是否在同一数据流中？
- D14（回合清理）：计数器是否在回合结束时正确重置？
