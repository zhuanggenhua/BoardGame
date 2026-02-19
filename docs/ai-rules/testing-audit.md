# 测试与审计规范

> **触发条件**：新增功能/技能/API、修复 bug、审查实现完整性时阅读。

---

## 核心原则

- **数据驱动优先，禁止硬编码（强制）**：实现任何游戏机制时，优先将规则/配置/效果做成可枚举数据，由引擎解析执行。禁止用 switch-case/if-else 逐个硬编码技能/效果/卡牌逻辑。新增同类机制时应提取抽象（通用 handler/executor/模板），而非复制粘贴再改参数。
- **测试用固定值代替随机（强制）**：测试中涉及随机数（骰子、抽牌、洗牌等）时，必须使用固定值或可控的伪随机序列，禁止依赖真随机。做法：① GameTestRunner 的 `random` 参数传入返回固定值的函数 ② 使用 `applyDiceValues` 等调试面板 API 注入预设值 ③ 测试 setup 中直接构造确定性初始状态。目的：确保测试结果可重复、可调试、不因随机波动导致偶发失败。
- **GameTestRunner 行为测试最优先**，审计工具是补充。
- **同类测试去重**：多个实体共享同一 handler/executor/reducer 分支时，只需一个代表性行为测试，其余用契约测试覆盖数据定义。≥5 个同类用 `test.each`。仅当条件分支/交互路径/边界行为/交叉影响不同时才需独立测试。
- **事件发射 ≠ 状态生效**：必须断言 reduce 后的最终状态，禁止只测注册/写入就判定"已实现"。
- **多系统协作必须断言所有相关系统状态（强制）**：涉及多个引擎系统协作的功能（如响应窗口+交互系统、流程系统+交互系统），测试必须同时断言所有相关系统的状态字段，不能只断言其中一个。典型：测试只断言 `sys.interaction.current` 存在但不断言 `sys.responseWindow.current` 仍打开 → 测试通过但功能实际无效。

## 测试工具选型

| 工具 | 适用场景 |
|------|---------|
| GameTestRunner | 命令序列+状态断言（首选） |
| entityIntegritySuite | 数据定义契约（≥20 实体时必选） |
| referenceValidator | 实体引用链验证 |
| interactionChainAudit | UI 状态机 payload 覆盖（多步 UI 交互时必选） |
| interactionCompletenessAudit | Interaction handler 注册覆盖（有 InteractionSystem 时必选） |

## 效果数据契约测试（强制）

新增游戏/英雄/卡牌/Token 定义时必须同步编写。职责：结构完整性 + 语义正确性。数据定义必须包含所有执行所需字段，禁止执行层"猜测"。

- `createEffectContractSuite`：接受 getSources/getSourceId/extractEffects/rules/minSourceCount
- `createI18nContractSuite`：验证 i18n key 格式和存在性
- 新增游戏 → 创建 `entity-chain-integrity.test.ts`；所有有 action 的效果必须声明 timing

## 交互链完整性审计

**模式 A（UI 状态机）**：多步交互必须声明 `interactionChain`。检查：声明完整性、steps ⊇ required、定义层与执行器 payloadContract 双向一致。

**模式 B（Interaction 链）**：检查 handler 注册覆盖、链式完整性、孤儿 handler。审计输入从源码自动抽取，禁止维护手工列表。

## CI 质量门禁

PR 必跑：`typecheck` → `test:games` → `i18n:check` → `test:e2e:critical`。

---

## E2E 测试选择器一致性检查（强制）

> **重构 UI 交互模式后必须执行**。UI 组件的渲染方式变更（如从弹窗改为内联横幅）时，所有引用旧选择器的 E2E 测试必须同步更新。

### 检查清单

1. **选择器来源验证**：E2E 测试中的 `data-testid`/CSS 选择器/文本匹配，必须对应实际渲染的组件。重构后用 `grep` 搜索旧选择器，确认所有 E2E 文件已更新。
2. **交互路径验证**：测试中的点击/输入序列必须与实际 UI 交互路径一致。例如：手牌选择在 HandArea 中直接点击 vs 在弹窗 overlay 中选择，两者选择器完全不同。
3. **按钮文本验证**：按钮文本来自 i18n，测试中的正则匹配必须覆盖中英文两种 locale（`/Confirm Discard|确认弃牌/i`）。
4. **状态验证**：测试必须验证 UI 状态变更（如 `data-selected="true"`），不能只验证"点击了按钮"。

### 典型反模式

- ❌ 重构了交互模式（弹窗→横幅），E2E 测试仍查找旧弹窗选择器 → 测试超时/skip，从未真正执行
- ❌ 测试中硬编码了组件内部 CSS 类名（如 `.card-selector-overlay`）→ 样式重构后测试失效
- ✅ 使用 `data-testid` + 按钮文本匹配，与实际渲染组件对齐

---

## 通用实现缺陷检查维度（D1-D24）

> 所有审查/审计/新增功能验证时按维度检查。D1-D10 为原有维度（已扩展），D11-D24 为新增维度。

| # | 维度 | 核心问题 |
|---|------|---------|
| D1 | 语义保真 | 实现是否忠实于权威描述？（多做/少做/做错）。**特别注意**：伤害/debuff 的作用目标是否与描述一致？custom action handler 中 targetId 来源是否正确？ |
| D2 | 边界完整 | 所有限定条件是否全程约束？ |
| D3 | 数据流闭环 | 定义→注册→执行→状态→验证→UI→i18n→测试 是否闭环？**写入→读取 ID 一致性**、**引擎 API 调用契约** |
| D4 | 查询一致性 | 可被 buff/光环动态修改的属性是否走统一入口？ |
| D5 | 交互完整 | 玩家决策点都有对应 UI？**交互模式与描述语义匹配？** **UI 组件是否复用唯一来源？** |
| D6 | 副作用传播 | 新增效果是否触发已有机制的连锁？ |
| D7 | 资源守恒 | 代价/消耗/限制正确扣除和恢复？**有代价操作的验证层是否拒绝必然无效果的激活？** |
| D8 | 时序正确 | 触发顺序和生命周期正确？**引擎批处理时序与 UI 异步交互是否对齐？阶段结束副作用与阶段推进的执行顺序是否导致验证层状态不一致？事件产生门控是否对所有同类技能普适生效（禁止硬编码特定 abilityId）？状态写入时机是否在消费窗口内（写入后是否有机会被消费，还是会被清理逻辑先抹掉）？多系统协作时，同批事件的处理顺序（按 priority）是否导致低优先级系统的状态驱动检查在高优先级系统执行前误触发？** |
| D9 | 幂等与重入 | 重复触发/撤销重做安全？ |
| D10 | 元数据一致 | categories/tags/meta 与实际行为匹配？ |
| D11 | **Reducer 消耗路径** | 事件写入的资源/额度/状态，在 reducer 消耗时走的分支是否正确？**多种额度来源并存时消耗优先级是否正确？** |
| D12 | **写入-消耗对称** | 能力/事件写入的字段，在所有消费点（reducer/validate/UI）是否被正确读取和消耗？写入路径和消耗路径的条件分支是否对称？**Reducer 操作范围是否与 payload 声明的范围一致（禁止全量清空 payload 未涉及的数据）？** |
| D13 | **多来源竞争** | 同一资源/额度/状态有多个写入来源时，消耗逻辑是否正确区分来源？不同来源的优先级/互斥/叠加规则是否正确？ |
| D14 | **回合清理完整** | 回合/阶段结束时临时状态（额度/buff/标记/计数器）是否全部正确清理？清理遗漏会导致下回合状态泄漏 |
| D15 | **UI 状态同步** | UI 展示的数值/状态是否与 core 状态一致？UI 读取的字段是否是 reducer 实际写入的字段？UI 是否遗漏了某些状态来源？**UI 计算参考点是否与描述语义一致？** |
| D16 | **条件优先级** | reducer/validate 中多个条件分支（if/else if/else）的优先级是否正确？先命中的分支是否应该先命中？ |
| D17 | **隐式依赖** | 功能是否依赖特定的调用顺序/状态前置条件但未显式检查？事件处理顺序变化是否会破坏功能？ |
| D18 | **否定路径** | "不应该发生"的场景是否被测试覆盖？（如：额外额度不应消耗正常额度、基地限定额度不应影响其他基地） |
| D19 | **组合场景** | 两个独立正确的机制组合使用时是否仍然正确？（如：神秘花园额外额度 + 正常额度同时存在时的消耗行为） |
| D20 | **状态可观测性** | 玩家能否从 UI 上区分不同来源的资源/额度？（如：正常随从额度 vs 基地额外额度在 UI 上是否可区分） |
| D21 | **触发频率门控** | 触发型技能（`afterAttack`/`afterMove`/`onPhaseStart`/`onPhaseEnd`）是否有使用次数限制？同一效果的不同触发方式（攻击后 vs 代替攻击）是否互斥？ |
| D22 | **伤害计算管线配置** | 使用 `createDamageCalculation` 时配置项是否正确？`autoCollectStatus`/`autoCollectTokens`/`autoCollectShields` 是否根据业务需求启用？伤害来源和目标是否正确？ |
| D23 | **架构假设一致性** | 底层架构的隐含假设是否与描述语义冲突？通用验证函数（如 `canAttackEnhanced`）的硬编码规则是否阻止特殊语义实现？阶段/目标/资源的底层约束是否需要为特殊机制开放？ |
| D24 | **Handler 共返状态一致性** | 交互 handler 同时返回 events 和新 interaction 时，新 interaction 的选项是否基于 events 已生效后的状态计算？（events 尚未 reduce，选项基于旧状态会导致候选列表缺失/过时） |

### 需要展开的关键维度

**D2 边界完整 — 概念载体覆盖（强制）**：游戏描述中的一个名词在数据层可能有多种承载形式。筛选该概念时必须覆盖所有载体。**核心原则：一个游戏术语 ≠ 一种数据结构。审查时必须穷举该术语在数据层的所有承载形式。** 审查方法：① 锁定描述中的目标名词 ② 列出该名词在数据层的所有承载形式 ③ 追踪每个筛选点是否覆盖所有载体。只查了一种 = ❌。

> **示例（SummonerWars）**："建筑"有 `cell.structure`（地图格子上的固定建筑）和拥有 `mobile_structure` 能力的 `cell.unit`（可移动建筑单位）两种载体

**D2 子项：打出约束审计（强制）**（新增/修改 ongoing 行动卡、或修"卡牌打出到不合法基地"时触发）：描述中含条件性打出目标的 ongoing 行动卡，必须在数据定义中声明 `playConstraint`，并在验证层和 UI 层同步检查。**核心原则：卡牌描述中的打出前置条件必须在三层（数据定义 → 验证层 → UI 层）全部体现，缺任何一层都会导致非法打出或 UI 误导。** 审查方法：
1. **识别条件性打出描述**：grep 所有 ongoing 行动卡的 i18n effectText，匹配 `打出到一个.*的基地上` 等模式（如"打出到一个你至少拥有一个随从的基地上"）
2. **检查数据定义**：匹配到的卡牌在 `ActionCardDef` 中必须有 `playConstraint` 字段（如 `'requireOwnMinion'`）
3. **检查验证层**：`commands.ts` 中 ongoing 行动卡验证逻辑必须检查 `def.playConstraint`，拒绝不满足条件的打出
4. **检查 UI 层**：`Board.tsx` 的 `deployableBaseIndices` 计算必须根据 `playConstraint` 过滤不可选基地
5. **自动化审计**：`abilityBehaviorAudit.test.ts` section 5 已添加自动检查——描述含条件性打出目标的 ongoing 卡必须有 `playConstraint` 字段

> **示例（SmashUp 完成仪式）**：描述"打出到一个你至少拥有一个随从的基地上"，但 `ActionCardDef` 无 `playConstraint` 字段 → 验证层和 UI 层均无检查 → 玩家可以打出到空基地上。修复：添加 `playConstraint: 'requireOwnMinion'`，验证层和 UI 层同步检查

**D4 查询一致性 — 深入审查**（新增 buff/共享机制或修"没效果"时触发）：① 识别统一查询入口并列出 ② grep 原始字段访问（含 `.tsx`），排除合法场景 ③ 判定：查询结果会因 buff/光环/临时效果改变？→ 必须走统一入口。只关心"印刷值"→ 可直接访问 ④ 输出绕过清单：文件+行号+当前代码+应改为。

**D3 子项：引擎 API 调用契约审计（强制）**（新增/修改引擎 API 调用时触发）：引擎 API 支持多种调用约定（位置参数 vs 配置对象、重载签名等），参数位置/嵌套层级错误不会报类型错误但会导致功能静默失效。**核心原则：多约定 API 是静默失效的高发区，每次调用必须确认使用的是哪种约定，并验证参数位置与该约定一致。** 审查方法：
1. **确认调用约定**：识别 API 是否有多种签名（位置参数 vs 配置对象、不同参数数量的重载）。grep 所有调用点，逐个确认使用的约定
2. **检查参数位置/嵌套**：配置对象中的子配置必须嵌套在正确的字段下，禁止平铺为顶层字段。位置参数形式中，可选参数的位置不能被其他参数占用
3. **检查选项数据完整性**：当 API 的选项/参数代表业务实体时，选项数据必须包含 UI 层渲染所需的关键字段（如实体 ID、定义 ID 等），缺失会导致 UI 退化为降级模式
4. **典型静默失效**：参数传到错误位置 → 功能降级但无报错；子配置平铺而非嵌套 → 被忽略；选项数据缺字段 → UI 退化

> **示例（SummonerWars/SmashUp `createSimpleChoice`）**：第 5 参数可以是 `string`（sourceId）或 `SimpleChoiceConfig` 对象。位置参数形式中 `multi` 是第 7 参数，config 对象形式中 `multi` 嵌套在 `{ sourceId, multi: { min, max } }` 内。`{ sourceId, min, max }` ❌ 平铺会导致 `multi` 被忽略。选项 `value` 缺少 `defId` → UI 层 `extractDefId` 返回空，卡牌选项退化为按钮模式

**D5 子项：UI 组件单一来源检查（强制）**（新增/修改任何卡牌展示、选择、弹窗 UI 时触发）：同一类 UI 功能在每个游戏中只允许一个组件实现。**核心原则：功能重叠的 UI 组件是维护灾难——修 bug 时只改了一个，另一个继续坏。每类 UI 功能必须有唯一来源组件，所有场景复用。** 审查方法：
1. **新增 UI 前搜索**：在同游戏 `ui/` 目录下搜索是否已有功能相似的组件（卡牌展示、卡牌选择、放大查看等）
2. **禁止新建重复组件**：如果已有组件能通过扩展 props/模式覆盖新场景，必须复用，禁止新建功能重叠的组件
3. **修 bug 时同样适用**：修复 UI bug 时禁止"新建一个组件绕过问题"，必须在现有组件上修复
4. **唯一来源表**：每个游戏应在 `rule/` 或 `ui/README.md` 中维护自己的 UI 组件唯一来源表，列出每类 UI 功能对应的唯一组件

> **示例（SmashUp）**：卡牌展示/选择 → `PromptOverlay`（`displayCards` prop）；卡牌放大 → `CardMagnifyOverlay`。弃牌堆查看新建 `DiscardPlayStrip` 而非复用 `PromptOverlay` 的 `displayCards` 模式 = ❌ 违规

**D5 子项：自动触发技能的 UI 消费链路检查（强制）**（新增/修改 `trigger` 非 `activated`/`passive` 的技能，或修"攻击后/移动后没弹出选择"时触发）：非手动激活的触发器（`afterAttack`/`afterMove`/`onPhaseStart`/`onPhaseEnd`/`onKill` 等）由引擎层自动发射事件，如果该技能需要玩家交互（有 `interactionChain`、UI 模式、或描述含"你可以"），则 UI 事件消费层必须有对应的消费分支来自动驱动交互——**不能仅依赖按钮入口**。**核心原则：引擎层自动触发的事件，UI 层必须有对应的消费分支；否则事件被静默丢弃，功能完全失效但无报错。** 审查方法：
1. **识别自动触发+需交互的技能**：grep 所有 `trigger` 非 `activated`/`passive` 的能力定义，筛选出有 `interactionChain`、`ui.activationType` 为非 `directExecute`、或描述含"你可以"/"may"的技能
2. **追踪事件消费链路**：`execute` 层触发能力 → 发射触发事件 → UI 事件消费层（如 `useGameEvents`）的对应事件 handler → 是否有对应 `abilityId` 的分支设置 UI 交互状态
3. **判定标准**：
   - 事件消费层无对应分支 = ❌ 功能静默失效（引擎触发了但 UI 不响应）
   - 仅有按钮入口（`requiresButton: true`）但无事件消费分支 = ❌ 按钮需要手动选中单位点击，不符合自动触发语义
   - 有事件消费分支 + `requiresButton: false` = ✅ 正确（单入口，EventStream 驱动）
   - 有事件消费分支 + `requiresButton: true` = ❌ 双入口风险（撤回后 EventStream 清空，按钮仍可点击重复激活）
4. **交叉验证**：如果游戏有触发入口审计测试（如 `triggerEntryAudit.test.ts`），确认该技能 ID 在 `EVENT_STREAM_TRIGGERED_ABILITIES` 列表中

> **示例（SummonerWars `withdraw`）**：`trigger: 'afterAttack'` + `requiresButton: true`，引擎攻击后正确发射 `ABILITY_TRIGGERED(withdraw)`，但 `useGameEvents.ts` 无 withdraw 消费分支 → 攻击后不弹出选择界面，功能完全失效但无报错

**D5 子项：交互模式语义匹配（强制）**（新增交互能力或修"选择行为不对"时触发）：描述中的选择语义必须与 `createSimpleChoice` 的 `multi` 配置匹配。审查方法：
1. **语义→配置映射表**：
   - "选择任意数量" / "any number" / "你可以选择" → `multi: { min: 0, max: N }`
   - "选择一个" / "choose one" → 不传 `multi`（单选模式）
   - "选择恰好 N 个" / "choose exactly N" → `multi: { min: N, max: N }`
   - "选择最多 N 个" / "up to N" → `multi: { min: 0, max: N }` 或 `multi: { min: 1, max: N }`（视是否可跳过）
2. **grep 审查**：搜索所有 `createSimpleChoice` 调用，对照能力描述确认 `multi` 配置与语义一致
3. **UI 模式验证**：`multi` 存在 → UI 应显示多选复选框 + 全选 + 确认按钮；`multi` 不存在 → UI 应显示单选按钮/卡牌点击即确认
4. **典型缺陷**：描述说"任意数量"但未传 `multi` → 变成单选，选一个就结束；描述说"选择一个"但传了 `multi` → 多选模式不符合预期

**D10 元数据一致 — 深入审计**（新增/修改 handler 时触发）：mock 调用每个 handler，检查输出事件类型与 categories 声明一致。**核心原则：handler 的元数据声明必须与实际运行时行为一致，否则下游依赖元数据做分支决策的逻辑会被跳过。** 典型：handler 产生伤害事件 → categories 必须含 'damage'，否则依赖此标记的下游阶段（如防御阶段）被跳过。

**D10 子项：Custom Action target 间接引用审计（强制）**：当框架层根据效果定义的 `target` 字段自动设置 handler 上下文中的 `targetId` 时，handler 如果盲目使用该 `targetId` 作为所有操作的目标，可能导致目标错误。**核心原则：框架自动设置的 target 上下文反映的是效果定义的声明目标（通常是主要效果的目标），但 handler 内部可能包含多个不同目标的操作。handler 必须根据每个操作的业务语义自行选择正确的目标 ID。** 审查方法：
**审查触发条件**：
- 新增/修改任何 custom action handler
- 修复"伤害打到错误目标"/"弃牌弃错人"/"buff 给错人"类 bug
- handler 内包含 2 种以上不同性质的操作（如既抽牌又弃牌、既 buff 自己又 debuff 对手）

**审查方法**：
1. **列出 handler 内所有操作及其业务目标**：
   - 抽牌 → 自己
   - 弃牌 → 对手（进攻技能）或自己（代价）
   - 伤害 → 对手（进攻）或自己（反噬）
   - buff → 自己
   - debuff → 对手
   - 获得资源 → 自己
   - 消耗资源 → 对手（进攻）或自己（代价）
2. **确认每个操作的 `targetId`/`playerId` 来源**：
   - 是框架自动设置的上下文目标（`ctx.targetId`）？
   - 还是显式获取的对手 ID（`ctx.ctx.defenderId`）？
   - 还是攻击者自己（`ctx.attackerId`）？
3. **判定标准**：
   - **进攻技能的伤害/debuff/弃牌目标应为对手** → 必须显式使用 `ctx.ctx.defenderId`（注意双层 ctx）
   - **自我增益（抽牌/buff/获得资源）** → 使用 `ctx.attackerId` 或上下文 `ctx.targetId`（当 `action.target='self'` 时两者相同）
   - **混合目标场景（强制）**：同一 handler 既有自我增益又有对手惩罚 → 必须分别处理，禁止用同一个 `targetId` 变量覆盖两种目标
   - **防御反击场景**：防御技能中 `ctx.attackerId` 是防御者、`ctx.defenderId` 是原攻击者，反击伤害应打 `ctx.defenderId`

**典型错误模式**：
1. **单一伤害目标错误**：`action.target='self'` + handler 用 `ctx.targetId` 作为伤害目标 → 伤害打到自己
2. **混合目标未区分**：`action.target='self'`（因为主效果是抽牌）+ handler 用 `ctx.targetId` 作为弃牌目标 → 弃自己的牌而非对手
3. **防御反击目标混淆**：防御技能中 `ctx.attackerId` 是防御者、`ctx.defenderId` 是原攻击者，反击伤害应打 `ctx.defenderId`
4. **变量复用错误**：声明 `const targetId = ctx.targetId`，然后在所有操作中复用该变量 → 混合目标场景下必然有一半操作目标错误

**审查输出格式**：
```
Handler: handleXxx
操作清单：
  1. 抽牌 → 目标=自己 → 使用 ctx.attackerId ✅
  2. 弃牌 → 目标=对手 → 使用 ctx.ctx.defenderId ✅
  3. 伤害 → 目标=对手 → 使用 ctx.ctx.defenderId ✅
判定：✅ 所有操作目标正确
```

> **示例 1（DiceThrone Barbarian）**：`EffectAction` 声明 `target: 'self'` 时，`resolveEffectAction` 将 `CustomActionContext.targetId` 设为 `attackerId`。Barbarian 的 `handleBarbarianSuppressRoll` 用 `ctx.targetId` 作为 `DAMAGE_DEALT.targetId` → 进攻技能伤害打到自己。修复：用 `ctx.ctx.defenderId` 获取对手 ID

> **示例 2（DiceThrone 聚宝盆）**：`action.target='self'`（因为主效果是抽牌），handler 内既抽牌（目标=自己）又弃牌（目标=对手）。原实现用 `targetId` 作为弃牌目标 → 弃自己的牌。修复：抽牌用 `attackerId`，弃牌用 `ctx.defenderId`

**D7 子项：验证层有效性门控（强制）**（新增/修改有代价的技能或 `directExecute` 类型能力时触发）：有资源消耗的操作，验证层必须确保操作至少能产生一个有意义的效果，否则拒绝激活。**核心原则：禁止让玩家花费代价换取零效果。** 审查方法：
1. **识别有代价操作**：grep 所有资源消耗字段（如 `cost`、充能/魔力/增益点等游戏特定资源），以及 `customValidator` 中检查资源的技能
2. **追踪执行层前置条件**：executor 中在"消耗资源"之后、"产生效果"之前的所有条件判断（如遍历棋盘找目标、检查候选列表非空），这些条件在验证层是否也有对应检查
3. **判定标准**：执行层存在"找不到目标则产生零效果事件"的路径 → 验证层必须提前拒绝该路径。执行层的效果保证非空（如固定对自身生效）→ 无需额外验证
4. **同步检查 `quickCheck`**：`AbilityDef.ui.quickCheck` 必须与 `customValidator` 的前置条件对齐，否则按钮显示但点击被拒绝（体验差），或按钮不显示但实际可用（功能缺失）

> **示例（SummonerWars 寒冰碎屑）**：`customValidator` 只检查充能 ≥ 1，未检查棋盘上是否存在友方建筑旁有敌方单位。executor 遍历棋盘找目标可能为 0 个，导致消耗充能但零效果

**D2 子项：验证-执行前置条件对齐（强制）**（新增技能或修"激活了但没效果"时触发）：验证层（`customValidator`）和执行层（executor）对同一操作的前置条件必须语义一致。**核心原则：验证层允许通过的每条路径，执行层都必须能产生至少一个有意义的效果；执行层的每个"零效果"early return，验证层都必须提前拒绝。** 审查方法：
1. **提取执行层隐含前置条件**：executor 函数体中，在产生核心效果事件之前的所有 early return / 空结果路径，每条路径对应一个隐含前置条件
2. **逐条比对验证层**：每个隐含前置条件在 `customValidator` 中是否有对应检查
3. **判定标准**：执行层 early return 空事件 = 操作无效果 → 验证层必须拒绝；执行层 early return 但已产生部分有意义事件 → 可接受
4. **反向检查**：验证层允许通过的所有路径，执行层是否都能产生至少一个有意义的效果？
5. **典型模式**：executor 遍历棋盘/列表收集目标 → 可能收集到 0 个 → 验证层必须预检"至少存在 1 个有效目标"

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

> **示例（SummonerWars 寒冰碎屑/喂养巨食兽）**：`onPhaseExit` 产生通知事件但未 halt → FlowSystem 推进阶段 → UI 弹出确认框 → 玩家确认 → `requiredPhase` 校验失败（当前阶段已变）。跳过时 UI 只清除 `abilityMode` 不 dispatch `ADVANCE_PHASE` → `onAutoContinueCheck` 永远不触发 → 游戏卡死

> **示例（SummonerWars 寒冰碎屑 门控绕过）**：`triggerPhaseAbilities` 中门控条件硬编码为 `abilityId === 'feed_beast' && !canActivateAbility(...)`，ice_shards 绕过门控 → 充能=0 时仍产生 `ABILITY_TRIGGERED` 事件 → `hasConfirmablePhaseEndAbility` 正确返回 false（充能不足）→ 不 halt → 阶段推进到 attack → UI 弹出确认框 → 玩家确认 → 服务端拒绝（`requiredPhase: 'build'` 但当前 `phase: 'attack'`）

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
- "写入了但从来没生效" + 写入日志正常 + 消费逻辑正常 = 高度怀疑写入-消费窗口不对齐
- 状态在非常规阶段写入（如事件卡在 magic 阶段授予攻击权限）
- 临时状态有回合清理逻辑

> **示例（SummonerWars 群情激愤）**：阶段顺序 `summon → move → build → attack → magic → draw`。群情激愤在 magic 阶段写入 `extraAttacks=1`，但 attack 阶段已过。`TURN_CHANGED` 清理 `extraAttacks=0`。写入(magic) → 清理(TURN_CHANGED) 之间不包含消费窗口(attack) = ❌ extraAttacks 永远不会被消费。修复：扩展消费窗口，允许持有 `extraAttacks > 0` 的单位在任意阶段发起攻击（跨阶段攻击）

**D8 子项：多系统 afterEvents 优先级竞争（强制）**（新增/修改引擎系统的 afterEvents 逻辑，或修"功能在测试中正常但实际无效"时触发）：多个引擎系统按 priority 顺序处理同一批事件时，低优先级系统的"状态驱动检查"可能在高优先级系统执行前误触发。**核心原则：系统 A（priority=15）在 afterEvents 中设置 `pendingInteractionId` 后，立即检查 `sys.interaction.current` 是否为空来决定是否解锁——但系统 B（priority=22）尚未执行 `queueInteraction`，`sys.interaction.current` 确实为空，导致系统 A 误判"交互已完成"并解锁/关闭窗口。** 审查方法：
1. **识别状态驱动检查**：grep 所有系统的 `afterEvents` 中读取其他系统管理的状态字段（如 `sys.interaction.current`、`sys.responseWindow.current`）的逻辑
2. **检查 priority 顺序**：读取方的 priority 是否低于写入方？如果是，同一轮 afterEvents 中读取方先执行，读到的是旧值
3. **检查前瞻守卫**：读取方是否有"同批事件中是否包含写入方的触发事件"的前瞻检查？没有 = ❌ 可能误触发
4. **测试必须断言所有相关系统的状态**：测试只断言 `sys.interaction.current` 存在但不断言 `sys.responseWindow.current` 仍打开 = ❌ 无法发现窗口被提前关闭的 bug

**典型缺陷模式**：
- ❌ ResponseWindowSystem（priority=15）处理 `INTERACTION_REQUESTED` 后设置 `pendingInteractionId`，随即检查 `sys.interaction.current` 为空 → 误判交互已完成 → 解锁并关闭窗口。但 DiceThroneEventSystem（priority=22）尚未执行 `queueInteraction`
- ❌ 测试只断言 `sys.interaction.current` 存在（交互确实被创建了），但 `sys.responseWindow.current` 已被关闭 → 测试通过但功能实际无效（UI 失去响应窗口上下文）

**修复策略**：
- **前瞻守卫（推荐）**：在状态驱动检查前，检查同批事件中是否包含会触发高优先级系统写入的事件（如 `hasInteractionLockRequest`），如果有则跳过本轮检查，等下一轮 afterEvents
- **延迟检查**：发出内部驱动事件（如 `_CHECK_UNLOCK`），在下一轮 afterEvents 中再检查
- **提升 priority**：将读取方的 priority 调整到写入方之后（通常不推荐，会影响其他逻辑）

> **示例（DiceThrone 弹一手/响应窗口）**：ResponseWindowSystem（priority=15）在 afterEvents 中处理 `INTERACTION_REQUESTED` 事件后设置 `pendingInteractionId`，紧接着状态驱动解锁检查发现 `pendingInteractionId` 存在 + `sys.interaction.current` 为空 → 解锁并关闭窗口。但 DiceThroneEventSystem（priority=22）尚未执行，`queueInteraction` 还没调用。修复：添加 `hasInteractionLockRequest` 前瞻守卫，同批事件中有 `INTERACTION_REQUESTED` 时跳过解锁检查

**测试规范（强制）**：涉及多系统协作的功能（如响应窗口+交互系统），测试必须同时断言所有相关系统的状态：
```typescript
// ❌ 错误：只断言交互存在
expect(state.sys.interaction?.current).toBeDefined();

// ✅ 正确：同时断言交互存在 + 响应窗口仍打开 + 窗口被交互锁定
expect(state.sys.interaction?.current).toBeDefined();
expect(state.sys.responseWindow?.current).toBeDefined();
expect(state.sys.responseWindow?.current?.pendingInteractionId).toBeDefined();
```

**D11 Reducer 消耗路径（强制）**（新增/修改额度授予、资源写入、或修"额度/资源消耗不对"时触发）：能力/事件写入的资源/额度/状态，在 reducer 消耗时走的分支是否正确。**核心原则：写入正确 ≠ 消耗正确。审计必须追踪到 reducer 中消耗该资源的具体分支逻辑，验证条件判断和优先级。** 审查方法：
1. **追踪写入点**：能力/事件将资源写入哪个字段（如 `baseLimitedMinionQuota`、`minionLimit`、`charges`）
2. **追踪消耗点**：grep 该字段在 reducer 中的所有读取位置，找到消耗分支
3. **验证分支条件**：消耗分支的 if/else if/else 条件是否正确？多种额度来源并存时，哪个分支先命中？先命中的分支是否是正确的消耗来源？
4. **构造测试场景**：至少覆盖——① 只有该额度来源时消耗正确 ② 该额度来源与其他来源并存时消耗优先级正确 ③ 该额度消耗后不影响其他来源的剩余量
5. **典型缺陷**：条件判断中 `globalFull && baseQuota > 0` 导致全局额度未用完时基地限定额度被跳过，错误消耗全局额度

> **示例（SmashUp 神秘花园）**：`grantExtraMinion(restrictToBase)` 正确写入 `baseLimitedMinionQuota[baseIndex]`，但 reducer 的 `MINION_PLAYED` 中 `useBaseQuota = shouldIncrementPlayed && globalFull && baseQuota > 0`，要求 `globalFull`（全局额度用完）才消耗基地限定额度。当玩家还有正常额度时，打到花园的随从错误消耗了 `minionsPlayed` 而非 `baseLimitedMinionQuota`

**D12 写入-消耗对称（强制）**（新增事件类型、修改 reducer、或修"写入了但没生效"时触发）：能力/事件写入的字段，在所有消费点是否被正确读取和消耗。**核心原则：写入路径和消耗路径必须是镜像对称的——写入时用什么条件/字段名/数据结构，消耗时必须用相同的条件/字段名/数据结构。** 审查方法：
1. **列出写入链**：事件 payload → reducer case → 写入的字段名和数据结构
2. **列出消耗链**：所有读取该字段的位置（reducer 其他 case、validate、UI 组件），每个位置的读取方式和条件
3. **对称性检查**：写入时的 key 类型（string/number）与读取时是否一致？写入时的嵌套层级与读取时是否一致？写入时的条件分支与消耗时的条件分支是否覆盖相同的场景空间？
4. **典型缺陷**：写入用 `cardId`（`target-1`）但读取匹配 `instanceId`（`target-1#1`）；写入到 `baseLimitedMinionQuota[baseIndex]` 但消耗时条件要求 `globalFull` 才读取该字段

> **示例（SummonerWars 交缠颂歌）**：写入 `entanglementTargets` 用 `cardId`，但读取时匹配 `instanceId`，ID 格式不一致导致永远匹配不上

**D12 子项：Reducer 操作范围与 payload 语义对齐（强制）**（新增/修改 reducer case、或修"操作影响了不该影响的数据"时触发）：reducer case 对状态的操作范围是否与事件 payload 声明的范围一致。**核心原则：reducer 只能操作 payload 中显式声明的数据范围，禁止对 payload 未涉及的数据做"全量清空"等隐式操作。当同一事件类型被多个调用方复用时，reducer 必须兼容所有调用方的语义——既能处理"全量操作"也能处理"部分操作"。** 审查方法：
1. **识别 reducer 中的全量操作**：grep 所有 reducer case 中的 `hand: []`、`discard: []`、`deck: []`、`= []`、`= {}`、`= undefined` 等无条件清空/重置模式
2. **追踪所有调用方**：grep 该事件类型的所有发射点，列出每个调用方传入的 payload 语义——是"全量操作"（如变化之风把所有手牌洗入牌库）还是"部分操作"（如实地考察只把选中的手牌放牌库底）
3. **判定**：
   - 所有调用方都是全量操作 → reducer 无条件清空 ✅ 安全
   - 存在部分操作的调用方 → reducer 无条件清空 ❌ 会误伤未涉及的数据
   - 修复策略：reducer 根据 payload 中的 uid 列表精确操作，只移除/修改 payload 声明的数据，保留其余
4. **新增事件类型时必查**：reducer case 的操作范围是否只覆盖 payload 声明的数据？是否存在"顺便清空"未声明数据的隐式行为？
5. **复用事件类型时必查**：新调用方的 payload 语义是否与 reducer 的操作范围兼容？如果新调用方是"部分操作"但 reducer 做"全量操作"，必须修改 reducer 为精确操作

**典型缺陷模式**：
- ❌ reducer 无条件 `hand: []` 但有调用方只移动部分手牌 → 未选中的手牌被误清空
- ❌ reducer 无条件 `discard: []` 但有调用方只从弃牌堆取回部分卡 → 其余弃牌被误清空
- ❌ reducer 用 `allCards = [...hand, ...deck]` 合并后重建，但只用 `newDeckUids` 过滤 → 不在 `newDeckUids` 中的手牌被丢弃而非保留

**排查信号**：
- "选了几张但全部都没了" / "操作影响了不该影响的数据" = 高度怀疑 reducer 操作范围超出 payload
- 同一事件类型有多个调用方，其中一个是全量操作、另一个是部分操作

> **示例（SmashUp 实地考察）**：`HAND_SHUFFLED_INTO_DECK` 的 reducer 无条件 `hand: []`，对巫师"变化之风"（全部手牌洗入牌库）正确，但对"实地考察"（只把选中的手牌放牌库底）错误——未选中的手牌被误清空。修复：reducer 用 `newDeckUids` 构建 Set，只从手牌中移除在 Set 中的卡，保留其余

**D13 多来源竞争（强制）**（同一资源/额度/状态有多个写入来源时触发）：多个能力/事件可以写入同一个资源字段时，消耗逻辑是否正确区分来源。**核心原则：当多个来源向同一个资源池写入时，消耗逻辑必须明确"消耗的是哪个来源的贡献"，不能混淆。** 审查方法：
1. **识别多来源字段**：grep 所有写入同一字段的事件/能力（如多个能力都写入 `minionLimit`）
2. **区分来源类型**：全局额度 vs 基地限定额度 vs 条件限定额度（如力量≤2）
3. **验证消耗隔离**：消耗来源 A 的额度时，是否不影响来源 B 的额度？来源 A 用完后是否正确 fallback 到来源 B？
4. **验证叠加规则**：多个来源同时生效时，是叠加（+1+1=2）还是取最大/最小？实现是否与规则一致？
5. **典型缺陷**：母星（全局 `minionLimit+1`）和神秘花园（`baseLimitedMinionQuota+1`）同时生效时，打到花园的随从应优先消耗花园额度，但 reducer 优先消耗全局额度

> **示例（SmashUp）**：`minionLimit`（全局额度）和 `baseLimitedMinionQuota`（基地限定额度）是两种不同来源。母星通过 `LIMIT_MODIFIED` 增加 `minionLimit`，花园通过 `LIMIT_MODIFIED(restrictToBase)` 增加 `baseLimitedMinionQuota`。消耗时必须根据目标基地是否有限定额度来决定消耗哪个

**D14 回合清理完整（强制）**（新增临时状态字段、或修"上回合的效果残留到下回合"时触发）：回合/阶段结束时所有临时状态是否全部正确清理。**核心原则：每个写入临时状态的字段，都必须有对应的清理逻辑，且清理时机正确。** 审查方法：
1. **列出所有临时字段**：grep 回合开始时重置的字段（如 `minionsPlayed=0`、`actionsPlayed=0`），以及回合结束时清理的字段（如 `baseLimitedMinionQuota=undefined`、`extraMinionPowerMax=undefined`）
2. **逐字段验证**：每个在回合中被写入的临时字段，在回合结束/开始时是否有对应的清理/重置
3. **清理时机**：清理发生在 `TURN_STARTED` 还是 `TURN_ENDED`？如果有跨回合效果（如"下回合开始时"），清理时机是否正确避开？
4. **新增字段必查**：新增任何临时状态字段时，必须同时在回合清理逻辑中添加对应的清理代码
5. **典型缺陷**：新增 `baseLimitedMinionQuota` 字段但忘记在回合清理中重置，导致额度跨回合累积

**D15 UI 状态同步（强制）**（修"UI 显示不对"或新增 UI 展示时触发）：UI 展示的数值/状态是否与 core 状态一致。**核心原则：UI 必须读取 reducer 实际写入的字段，不能读取"看起来相关但实际不同"的字段。** 审查方法：
1. **追踪 UI 数据源**：UI 组件展示某个数值时，追踪到它读取的是 core 的哪个字段
2. **对比 reducer 写入**：reducer 实际写入的字段是否就是 UI 读取的字段？是否存在"UI 读 fieldA 但 reducer 写 fieldB"的不一致？
3. **多来源聚合**：如果一个 UI 数值需要聚合多个来源（如"剩余随从额度 = minionLimit - minionsPlayed + baseLimitedMinionQuota"），UI 是否正确聚合了所有来源？
4. **状态变更后刷新**：reducer 更新字段后，UI 是否能及时感知变更并重新渲染？
5. **典型缺陷**：UI 显示"剩余随从次数"只读 `minionLimit - minionsPlayed`，没有加上 `baseLimitedMinionQuota` 的额外额度，导致显示的剩余次数比实际少

**D16 条件优先级（强制）**（修改 reducer/validate 中的多分支逻辑时触发）：多个条件分支的优先级是否正确。**核心原则：if/else if/else 链中，先命中的分支会短路后续分支。必须确认先命中的分支确实应该先命中。** 审查方法：
1. **列出分支链**：将 if/else if/else 链中每个分支的条件和效果列成表
2. **构造边界场景**：找到两个分支条件都可能为 true 的场景，确认先命中的分支是正确的
3. **特别关注"兜底分支"**：else 分支是否会意外捕获不应该走到这里的场景？
4. **典型缺陷**：`if (useBaseQuota) { ... } else if (shouldIncrementPlayed) { ... }` 中 `useBaseQuota` 要求 `globalFull`，导致全局额度未满时所有场景都走 else if 分支

**D17 隐式依赖（强制）**（重构事件处理顺序、修改管线流程时触发）：功能是否依赖特定的调用顺序或状态前置条件但未显式检查。**核心原则：如果功能 B 依赖功能 A 先执行的结果，这个依赖必须是显式的（通过参数传递或状态检查），不能依赖"恰好 A 在 B 之前执行"的隐式顺序。** 审查方法：
1. **识别顺序依赖**：功能 B 读取的状态是否由功能 A 在同一管线中写入？如果 A 和 B 的执行顺序交换，功能是否会破坏？
2. **识别状态前置条件**：函数入口是否假设某个状态已经被设置（如"此时 minionLimit 已经被 onTurnStart 增加过"），但没有显式检查？
3. **防御性编程**：关键的顺序依赖应该通过断言或条件检查来保护，而不是依赖调用顺序
4. **典型缺陷**：`onTurnStart` 中花园授予额度，但如果 `onTurnStart` 的触发顺序变化导致额度授予在打出随从之后，功能静默失效

**D18 否定路径（强制）**（全面审查、新增额度/资源机制时触发）：测试是否覆盖了"不应该发生"的场景。**核心原则：正向测试（功能生效）和否定测试（功能不应影响其他东西）同等重要。** 审查方法：
1. **额度隔离测试**：额外额度消耗后，正常额度是否不受影响？正常额度消耗后，额外额度是否不受影响？
2. **基地隔离测试**：基地限定额度是否只在指定基地生效？在其他基地打随从是否不消耗该额度？
3. **玩家隔离测试**：玩家 A 的额度变化是否不影响玩家 B？
4. **回合隔离测试**：本回合的临时效果是否不泄漏到下回合？
5. **构造否定断言**：对每个写入操作，构造"写入后，不相关的字段应该不变"的断言

> **示例（SmashUp 神秘花园）**：测试应包含——① 花园额度消耗后 `minionsPlayed` 不变 ② 正常额度消耗后 `baseLimitedMinionQuota` 不变 ③ 在非花园基地打随从不消耗花园额度

**D19 组合场景（强制）**（全面审查、新增与已有机制交叉的能力时触发）：两个独立正确的机制组合使用时是否仍然正确。**核心原则：单独测试通过不代表组合测试通过。两个机制共享同一资源/状态时，必须测试组合场景。** 审查方法：
1. **识别共享资源**：两个机制是否读写同一个字段？（如母星和花园都影响随从额度）
2. **构造组合场景**：两个机制同时生效时，先触发 A 再触发 B、先触发 B 再触发 A，结果是否都正确？
3. **构造交替消耗场景**：先消耗 A 的额度再消耗 B 的额度，反过来呢？
4. **边界组合**：一个机制的边界值（如额度=0）与另一个机制的正常值组合时是否正确？

> **示例（SmashUp）**：母星（全局 minionLimit+1，力量≤2）+ 花园（baseLimitedMinionQuota+1，力量≤2）同时生效时：打到花园的力量≤2随从应消耗花园额度，打到其他基地的力量≤2随从应消耗母星额度，两者互不干扰

**D15 子项：UI 计算参考点验证（强制）**（新增/修改基于事件 payload 计算有效位置/目标/范围的 UI 逻辑，或修"UI 计算结果不符合描述"时触发）：当 UI 基于事件 payload 计算有效位置/目标/范围时，计算的参考点必须与卡牌描述的语义一致。**核心原则：Event payload 可能包含多个"正确的"位置字段，必须选择语义上正确的那个。不是"读取了错误的字段"（D15 主项覆盖），而是"在多个正确字段中选择了错误的输入"。** 审查方法：
1. **识别 UI 计算逻辑**：grep 所有 `getAdjacentCells`/`getUnitsInRange`/`getCellsInRange` 等位置计算函数的调用点
2. **提取描述中的参考点语义**：
   - "该单位相邻" → 参考点是移动的单位
   - "本单位相邻" → 参考点是抓附单位
   - "目标位置周围" → 参考点是目标位置
   - "起始位置周围" → 参考点是起始位置
3. **对比实现的参考点**：UI 计算函数的输入参数是哪个字段？该字段的语义是否与描述一致？
4. **检查 payload 中的字段选择**：如果 event payload 包含多个位置字段（如 `from`/`to`/`grabberPosition`/`movedTo`），确认选择的是语义正确的那个

**典型缺陷清单**：
- ❌ 描述说"该单位相邻"但用了 `grabberPosition`（本单位位置）
- ❌ 描述说"目标位置周围"但用了 `from`（起始位置）
- ❌ 描述说"移动路径上"但只计算了起点和终点，未计算中间格子

> **示例（SummonerWars 抓附跟随）**：描述"将本单位放置到**该单位相邻的区格**"（该单位=移动的单位），但 UI 用 `getAdjacentCells(grabberPosition)` 计算有效位置，应为 `getAdjacentCells(movedTo)`。Event payload 包含两个正确字段，但选择了语义不匹配的输入

**D20 状态可观测性（推荐）**（新增资源/额度来源、或修"玩家不知道还能不能操作"时触发）：玩家能否从 UI 上区分不同来源的资源/额度。**核心原则：如果两种额度的消耗规则不同（如基地限定 vs 全局），UI 应该让玩家能区分它们，否则玩家无法做出正确决策。** 审查方法：
1. **列出所有额度/资源来源**：每种来源的限制条件是什么？（如花园额度只能用于花园，力量≤2）
2. **UI 是否区分展示**：UI 是否只显示一个总数，还是分别显示不同来源？
3. **提示信息**：当操作被拒绝时，错误提示是否说明了具体原因（如"额外出牌只能打力量≤2的随从"而非笼统的"额度已用完"）？

**D21 触发频率门控（强制）**（新增/修改触发型技能、或修"技能可以无限重复使用"时触发）：触发型技能是否有使用次数限制，同一效果的不同触发方式是否互斥。**核心原则：`afterAttack`/`afterMove`/`onPhaseStart`/`onPhaseEnd` 等触发型技能默认每次触发都会执行，必须显式添加 `usesPerTurn`/`usesPerPhase` 限制，否则会导致无限重复使用。** 审查方法：
1. **识别触发型技能**：grep 所有 `trigger` 非 `activated`/`passive` 的技能定义
2. **检查使用次数限制**：每个触发型技能是否有 `usesPerTurn`/`usesPerPhase`/`usesPerAttack` 限制？
3. **判定标准**：
   - `afterAttack`/`afterMove` 触发 + 无 `usesPerTurn` = ❌ 每次攻击/移动都触发，可能无限重复
   - `onPhaseStart`/`onPhaseEnd` 触发 + 无 `usesPerPhase` = ❌ 每次进入/离开阶段都触发
   - 纯被动光环（如 `auraStructureLife`）无需限制 = ✅
   - 强制触发的阶段效果（无玩家选择）无需限制 = ✅
4. **检查互斥关系**：同一效果有"攻击后触发"和"代替攻击"两个版本时，是否有互斥机制？
   - 正确模式：`afterAttack` 版本有 `usesPerTurn: 1`，`activated` 版本有 `costsAttackAction: true`，两者共享使用次数计数器
   - 错误模式：两个版本独立计数，玩家可以先用"代替攻击"版本再用"攻击后"版本，绕过限制
5. **自动化检查**：在 CI 中添加 grep 检查，所有 `trigger: 'afterAttack'` 的技能必须有 `usesPerTurn` 或在白名单中

**典型缺陷清单**：
- ❌ `trigger: 'afterAttack'` 但无 `usesPerTurn` → 攻击后可以无限次推拉/抽牌/检索
- ❌ `trigger: 'afterMove'` 但无 `usesPerTurn`（除非是 `extraMove` 类被动）
- ❌ 同一效果有 `afterAttack` 和 `activated` 两个版本，但没有共享使用次数

> **示例（SummonerWars 清风法师念力）**：`trigger: 'afterAttack'` 但无 `usesPerTurn`，攻击后可以无限次选择不同目标推拉。修复：添加 `usesPerTurn: 1`

> **示例（SummonerWars 古尔壮读心传念）**：`trigger: 'afterAttack'` 但无 `usesPerTurn`，攻击后可以给所有友方士兵额外攻击。修复：添加 `usesPerTurn: 1`

**D22 伤害计算管线配置（强制）**（使用 `createDamageCalculation` 或修"伤害加成/减免不生效"时触发）：使用伤害计算管线时配置项是否正确，伤害来源和目标是否正确。**核心原则：`createDamageCalculation` 提供自动收集修正的能力（Token/状态/护盾），但默认配置可能不适合所有场景。必须根据业务需求显式配置 `autoCollectStatus`/`autoCollectTokens`/`autoCollectShields`，并确认伤害来源和目标正确。** 审查方法：

**审查触发条件**：
- 新增/修改任何使用 `createDamageCalculation` 的代码
- 修复"伤害加成/减免不生效"/"锁定 buff 没效果"/"护盾没抵挡"类 bug
- 新增英雄/游戏的伤害计算逻辑

**审查方法**：
1. **检查配置项完整性**：
   - `autoCollectStatus`：是否需要自动收集目标的状态修正（如锁定 +2 伤害、护甲减伤）？
     - ✅ 正确：攻击/技能伤害应启用（`true`），自动收集目标的 debuff/buff
     - ❌ 错误：设为 `false` 导致锁定等 debuff 不生效
   - `autoCollectTokens`：是否需要自动收集攻击方的 Token 加成（如火焰精通）？
     - ✅ 正确：根据游戏是否有"攻击方 Token 增加伤害"机制决定
     - ❌ 错误：游戏有 Token 加伤但设为 `false`
   - `autoCollectShields`：是否需要自动收集目标的护盾减免？
     - ✅ 正确：根据游戏是否有护盾机制决定
     - ❌ 错误：游戏有护盾但设为 `false`
2. **检查伤害来源和目标**：
   - `source.playerId`：伤害来源玩家 ID 是否正确？
     - 进攻技能 → `ctx.attackerId`
     - 防御反击 → `ctx.attackerId`（防御者）
     - 自伤/反噬 → `ctx.attackerId`
   - `source.abilityId`：伤害来源技能 ID 是否正确？用于日志和 breakdown
   - `target.playerId`：伤害目标玩家 ID 是否正确？
     - 进攻技能 → `ctx.ctx.defenderId`（注意双层 ctx）
     - 防御反击 → `ctx.ctx.defenderId`（原攻击者）
     - 自伤/反噬 → `ctx.attackerId`
3. **检查状态修正机制兼容性**：
   - 游戏使用 `passiveTrigger.timing === 'onDamageReceived'` 机制？→ 必须启用 `autoCollectStatus: true`
   - 游戏使用旧的 `damageReduction` 字段？→ `autoCollectStatus: true` 也会自动收集
   - 游戏使用 `applyOnDamageReceivedTriggers` 手动处理？→ 可以设为 `false`，但推荐迁移到新管线
4. **检查默认值假设**：
   - 不传配置项时，默认值是什么？（当前：`autoCollectStatus` 默认 `true`）
   - 代码是否依赖了错误的默认值假设？
5. **检查历史债务**：
   - 游戏是否有混用新旧伤害计算方式的情况？（如部分技能用 `createDamageCalculation`，部分手动构建 `DAMAGE_DEALT`）
   - 迁移到新管线时是否遗漏了某些伤害来源？

**典型缺陷清单**：
- ❌ `autoCollectStatus: false` 导致锁定/护甲等状态修正不生效
- ❌ 进攻技能用 `ctx.targetId` 作为伤害目标，但 `action.target='self'` 导致伤害打到自己
- ❌ 防御反击用 `ctx.attackerId` 作为伤害目标，应该用 `ctx.ctx.defenderId`（原攻击者）
- ❌ 混合目标场景（既抽牌又伤害）用同一个 `targetId` 变量，导致伤害目标错误
- ❌ 游戏有 Token 加伤机制但 `autoCollectTokens: false`
- ❌ 游戏有护盾机制但 `autoCollectShields: false`

**审查输出格式**：
```
文件: src/games/xxx/domain/customActions/yyy.ts
函数: dealDamage / handleXxxResolve
配置检查：
  - autoCollectStatus: false ❌ 应为 true（游戏有锁定 debuff）
  - autoCollectTokens: false ✅ 游戏无 Token 加伤机制
  - autoCollectShields: false ✅ 游戏无护盾机制
目标检查：
  - source.playerId: ctx.attackerId ✅
  - target.playerId: ctx.targetId ❌ 应为 ctx.ctx.defenderId（进攻技能）
修复方案：
  1. 将 autoCollectStatus 改为 true
  2. 将 target.playerId 改为 ctx.ctx.defenderId
```

> **示例（DiceThrone 月精灵迷影步）**：`dealDamage` 函数设置 `autoCollectStatus: false`，导致锁定 buff 的 `passiveTrigger.timing === 'onDamageReceived'` 机制不生效。修复：改为 `autoCollectStatus: true`

> **示例（DiceThrone Barbarian 压制）**：`action.target='self'` + handler 用 `ctx.targetId` 作为伤害目标 → 进攻技能伤害打到自己。修复：用 `ctx.ctx.defenderId` 获取对手 ID

**关联维度**：
- D1（语义保真）：伤害目标是否与描述一致？
- D10（元数据一致）：handler categories 是否包含 'damage'？
- D3（数据流闭环）：伤害事件是否被 reducer 正确消费？

**D23 架构假设一致性（强制）**（新增/修改底层验证函数、或修"特殊语义无法实现"时触发）：底层架构的隐含假设是否与描述语义冲突？通用验证函数（如 `canAttackEnhanced`、`validate.ts` 中的阶段检查）的硬编码规则是否阻止特殊语义实现？阶段/目标/资源的底层约束是否需要为特殊机制开放？**核心原则：底层架构的"通用规则"不应成为特殊语义的天花板。当描述要求突破常规约束时（如"攻击友军=治疗"、"魔力阶段攻击"），底层验证函数必须提供扩展点，而非硬编码拒绝。** 审查方法：

**审查触发条件**：
- 新增/修改任何底层验证函数（`canAttackEnhanced`、`canMoveTo`、`validate.ts` 中的阶段/目标/资源检查）
- 修复"特殊语义无法实现"/"绕过逻辑分散"/"底层硬编码拒绝"类 bug
- 新增需要突破常规约束的机制（跨阶段操作、非常规目标、特殊资源消耗）

**审查方法**：
1. **识别底层假设**：列出底层验证函数中所有硬编码的约束条件（如 `if (targetOwner === attackerUnit.owner) return false`、`if (core.phase !== 'attack') return false`）
2. **对照描述语义**：每个硬编码约束是否有描述中的反例？（如"治疗=攻击友军"、"群情激愤=魔力阶段攻击"）
3. **检查扩展点**：底层函数是否提供了上下文参数/特殊模式标记/状态检测来绕过硬编码约束？
4. **检查绕过逻辑一致性**：如果有绕过逻辑，是否在所有调用点（execute/validate/UI）一致生效？还是只在某一层生效导致其他层仍被拒绝？
5. **判定标准**：
   - 底层硬编码约束 + 描述有反例 + 无扩展点 = ❌ 架构假设冲突
   - 底层硬编码约束 + 有扩展点但只在部分层生效 = ❌ 绕过逻辑不一致
   - 底层硬编码约束 + 有扩展点且在所有层一致生效 = ✅ 正确
   - 底层无硬编码约束，通过上下文参数控制 = ✅ 最佳实践

**典型架构假设清单**：
- ❌ "攻击=敌对行为"：`canAttackEnhanced` 硬编码拒绝友军目标，无法实现"攻击友军=治疗"
- ❌ "攻击只能在攻击阶段"：`validate.ts` 硬编码阶段检查，无法实现事件卡授予的跨阶段攻击
- ❌ "移动只能在移动阶段"：硬编码阶段检查，无法实现"代替攻击移动"等跨阶段移动
- ❌ "资源消耗必须在特定阶段"：硬编码阶段检查，无法实现"任意阶段消耗魔力"的事件卡
- ❌ "单位不能穿过其他单位"：硬编码路径检查，无法实现"飞行"等穿越能力（已修复：通过 `canPassThrough` 参数）
- ✅ "移动距离≤2"：通过 `getUnitMoveEnhancements` 返回 `extraDistance` 扩展，支持飞行/迅捷等能力

**修复策略**：
1. **最小侵入（推荐）**：在底层函数中添加特殊模式检测（如 `isHealingMode`、`hasRallyingCry`），允许特殊语义绕过硬编码约束
2. **参数化扩展**：将硬编码约束改为可选参数（如 `canAttackEnhanced(state, attacker, target, { allowFriendly?: boolean, ignorePhase?: boolean })`）
3. **状态标记**：在 core 状态中添加特殊模式标记（如 `core.specialAttackMode = { allowFriendly: true }`），底层函数读取状态决定行为
4. **拆分函数**：将通用验证函数拆分为多个专用函数（如 `canAttackEnhanced` vs `canTargetForAction`），不同场景调用不同函数

**审查输出格式**：
```
底层函数: canAttackEnhanced (src/games/xxx/domain/helpers.ts:1046)
硬编码约束: if (targetOwner === attackerUnit.owner) return false
描述反例: 治疗技能"攻击友军=治疗"
扩展点: ❌ 无
绕过逻辑: execute.ts 中有治疗模式独立路径，但 UI 层调用 canAttackEnhanced 时仍被拒绝
判定: ❌ 架构假设冲突 + 绕过逻辑不一致
修复方案: 在 canAttackEnhanced 中添加 isHealingMode 检测，允许治疗模式攻击友军（距离=1，目标=士兵/英雄）
```

> **示例 1（SummonerWars 治疗技能）**：`canAttackEnhanced` 硬编码 `if (targetOwner === attackerUnit.owner) return false` 拒绝友军目标。治疗技能描述"攻击友军=治疗"，但底层验证函数无扩展点。`execute.ts` 中有治疗模式绕过逻辑，但 UI 层调用 `canAttackEnhanced` 时仍被拒绝，导致无法高亮友军单位为可攻击目标。修复：在 `canAttackEnhanced` 中添加 `isHealingMode` 检测（`attackerUnit.healingMode || getUnitAbilities(attackerUnit, state).includes('healing')`），允许治疗模式攻击友军（距离=1，目标=士兵/英雄）

> **示例 2（SummonerWars 群情激愤）**：`validate.ts` 硬编码 `if (core.phase !== 'attack') return false` 拒绝非攻击阶段的攻击命令。群情激愤事件卡描述"魔力阶段允许友方单位攻击"，但底层验证函数无扩展点。修复：在 `DECLARE_ATTACK` 验证中添加 `hasRallyingCry` 检测（`core.players[playerId].activeEvents.some(e => e.defId === 'rallying_cry' && e.isActive)`），允许跨阶段攻击

**关联维度**：
- D1（语义保真）：特殊语义是否被底层假设阻止？
- D2（边界完整）：底层约束是否覆盖所有场景（含特殊语义）？
- D5（交互完整）：UI 层是否能正确响应特殊语义（如高亮友军目标）？

**D24 Handler 共返状态一致性（强制）**（新增/修改交互 handler 中同时返回 events 和新 interaction 时触发）：交互 handler 同时返回 `{ events, state: queueInteraction(...) }` 时，新 interaction 的选项是否基于 events 已生效后的状态计算？**核心原则：handler 返回的 events 尚未被 reduce，此时 `state.core` 仍是旧状态。如果新 interaction 的选项依赖这些 events 的效果（如弃牌后从弃牌堆选随从），必须手动模拟 events 的效果来构建选项，否则选项列表会缺失/过时。** 审查方法：

**审查触发条件**：
- 新增/修改任何交互 handler 中同时返回 `events` 数组（非空）和 `queueInteraction` 的代码
- 修复"交互选项缺失"/"弹窗为空"/"选项列表不对"类 bug
- handler 返回的 events 会改变后续交互选项的数据来源（如弃牌→弃牌堆变化、消灭随从→场上随从变化、抽牌→手牌变化）

**审查方法**：
1. **识别共返模式**：grep 所有 handler 中同时包含 `events: [...]`（非空数组）和 `queueInteraction` 的 return 语句
2. **追踪 events 的状态影响**：列出返回的每个 event 会改变 `state.core` 的哪些字段（如 `CARDS_DISCARDED` → `player.hand` 减少 + `player.discard` 增加）
3. **追踪新 interaction 的选项数据来源**：新 interaction 的 options 是从 `state.core` 的哪个字段构建的？（如从 `player.discard` 过滤随从）
4. **判定**：选项数据来源字段是否被 events 影响？
   - 是 + 选项构建时未考虑 events 的效果 = ❌ 选项基于旧状态，会缺失/过时
   - 是 + 选项构建时手动合并了 events 的效果 = ✅ 正确
   - 否（events 不影响选项数据来源）= ✅ 无需处理
5. **修复策略**：
   - **手动合并（推荐）**：在构建选项时，将 events 的效果手动叠加到当前状态上。例如：`CARDS_DISCARDED` 事件中的 `cardUids` 对应的牌仍在 `player.hand` 中，需要手动将它们加入候选弃牌堆
   - **使用 optionsGenerator**：为新 interaction 设置 `optionsGenerator`，在 reduce 后自动基于最新状态重新生成选项（适用于框架支持的场景）
   - **拆分为两步交互**：先返回 events 不创建新 interaction，等 events reduce 后再由下一个触发点创建 interaction（架构改动较大，通常不推荐）

**典型缺陷模式**：
- ❌ handler 返回 `CARDS_DISCARDED` + 新 interaction 从 `player.discard` 选随从 → 刚弃的牌不在 `player.discard` 中（还在 `player.hand`），选项缺失
- ❌ handler 返回 `MINION_DESTROYED` + 新 interaction 从场上选随从 → 被消灭的随从仍在场上，选项包含已失效目标
- ❌ handler 返回 `CARDS_DRAWN` + 新 interaction 从手牌选牌弃掉 → 刚抽的牌不在 `player.hand` 中，选项缺失

**排查信号**：
- "交互弹窗为空/无选项" + handler 逻辑看起来正确 = 高度怀疑共返状态不一致
- handler 中 `eligible.length === 0` 导致跳过交互创建，但实际应该有候选项
- 交互选项在某些场景下正常（弃牌堆本身有随从）、某些场景下为空（只有刚弃的牌才是随从）

> **示例（SmashUp 亡者崛起）**：handler 返回 `CARDS_DISCARDED`（弃手牌）+ 新 interaction（从弃牌堆选力量<弃牌数的随从）。`CARDS_DISCARDED` 尚未 reduce，刚弃的牌仍在 `player.hand` 而非 `player.discard`。选项构建只从 `player.discard` 过滤 → 刚弃的随从不在候选列表中 → 如果弃牌堆原本没有符合条件的随从，弹窗为空。修复：手动将 `player.hand` 中 `discardUids` 对应的牌合并到候选池 `[...player.discard, ...justDiscarded]`

**关联维度**：
- D8（时序正确）：events 的 reduce 时机与 interaction 创建时机的先后关系
- D12（写入-消耗对称）：events 写入的状态变更与 interaction 选项读取的数据源是否对称
- D17（隐式依赖）：选项构建隐式依赖 events 已被 reduce 的假设

### 维度选择指南

| 任务 | 必选 | 推荐 |
|------|------|------|
| 新增技能/效果 | D1,D2,D3,D5,D7,D21,D22 | D6,D8,D10,D11,D18,D23 |
| 修"写入了但没生效" | D8,D12,D14,D3 | D4,D11,D23 |
| 修"没效果" | D4,D3,D1,D22 | D8,D10,D12,D21,D23 |
| 修"触发了状态没变" | D8,D3,D9 | D1,D7,D11,D21 |
| 修"点了没反应" | D5,D3,D10 | D8,D21,D23 |
| 修"激活了但没效果" | D7,D2,D3 | D1,D10,D11,D23 |
| 修"确认后验证失败" | D8,D7,D3 | D2,D5,D23 |
| 修"技能可以无限重复使用" | D21,D7,D8 | D1,D2 |
| 修"伤害加成/减免不生效" | D22,D1,D3 | D4,D10 |
| 修"锁定/护甲没效果" | D22,D4,D3 | D1,D10 |
| 修"特殊语义无法实现" | D23,D1,D2 | D5,D8 |
| 修"绕过逻辑分散" | D23,D3,D5 | D1,D8 |
| 新增阶段结束技能 | D8,D5,D7,D1,D21 | D2,D3,D23 |
| 修"阶段结束技能无效触发" | D8,D7,D2,D21 | D5,D3,D23 |
| 新增 UI 展示 | D5,D3,D15 | D1,D20 |
| 新增基于位置计算的 UI 交互 | D15,D5,D1 | D2,D3 |
| 修"UI 计算结果不符合描述" | D15,D1,D5 | D2,D3 |
| 全面审查 | D1-D23 | — |
| 新增 buff/共享 | D4,D1,D6,D22 | D10,D13,D19 |
| 重构事件流 | D3,D8,D9 | D10,D4,D17 |
| 新增交互能力 | D5,D3,D1 | D2,D8,D21,D23,D24 |
| 新增额度/资源机制 | D7,D11,D12,D13,D18 | D14,D15,D16,D19,D20 |
| 修"额度/资源消耗不对" | D11,D12,D13,D16 | D7,D15,D18 |
| 修"UI 显示不对" | D15,D3,D12 | D20,D5 |
| 修"上回合效果残留" | D14,D8,D9 | D17 |
| 修改 reducer 分支逻辑 | D16,D11,D12 | D18,D19 |
| 新增临时状态字段 | D14,D12,D15 | D18 |
| 新增英雄/游戏伤害计算 | D22,D1,D3 | D10,D4 |
| 迁移到新伤害计算管线 | D22,D3,D10 | D1,D4 |
| 新增/修改底层验证函数 | D23,D1,D2 | D5,D8 |
| 新增跨阶段/非常规目标机制 | D23,D1,D5 | D2,D8 |
| 修"交互选项缺失/弹窗为空" | D24,D5,D3 | D8,D12,D17 |
| 修"功能在测试中正常但实际无效" | D8,D3,D10 | D5,D17 |
| 修"操作影响了不该影响的数据" | D12,D11,D3 | D16,D18 |
| 新增/修改 handler 共返 events+interaction | D24,D8,D12 | D3,D17 |

### 输出格式

① 所选维度及理由 ② 每个维度 ✅/❌ + 证据 ③ 问题清单（文件+行号+修复方案）

---

## 描述→实现全链路审查规范（强制）

> 用户说"审计/审查/审核/核对/对一下描述和代码"时按此执行，禁止凭印象回答。"检查"不算触发词，不自动启动审计流程。

**适用**：① 新增技能/效果/被动/光环 ② 修"没效果"bug ③ 审查已有机制 ④ 重构消费链路

### 第零步：锁定权威描述

优先级：① 用户当前对话给出 → ② `rule/*.md` 规则文本 → ③ 卡牌实物图片（看不清必须停止确认）。**禁止用 i18n JSON、AbilityDef.description、代码注释作为权威输入**——这些是实现产物，可能带着错误理解。

**规则术语必须查词汇表（强制）**：描述中出现专有术语（如"基础能力"、"建筑"、"士兵"等）时，必须在 `rule/*.md` 的词汇表/术语定义中查找其精确定义，不得从代码函数名推断含义。**典型错误**：函数名 `getUnitBaseAbilities` 返回 `card.abilities + tempAbilities`，但规则词汇表定义"基础能力 = 单位卡上印刷的能力，不包括其他卡牌添加的能力"——函数名暗示的语义与规则定义不一致。

### 第一步：拆分独立交互链

原子单位是**独立交互链**，不是"卡牌"或"技能"。拆分信号：
- 不同触发时机（"打出时" vs "之后每当…时"）
- 需要玩家做出新选择
- 独立的条件→结果对
- "可以/may" → 独立链，必须有确认/跳过 UI，禁止自动执行
- "代替 X 做 Y" → 拆为"消耗 X"+"执行 Y"两个原子操作

**语义边界锁定（强制）**：
- **无限定词 = 不区分**："士兵"/"单位"/"卡牌" = 所有，包括敌我双方
- **有限定词 = 严格过滤**："敌方士兵"/"友方单位" = 仅限定范围
- **禁止凭"游戏常识"自行添加描述中不存在的限定条件**
- 审查时：实现中每个 filter/条件表达式回溯到描述依据，无依据 = ❌

**自检**：交互链拼接后与原文逐句对照，每句必须被覆盖，否则禁止进入下一步。

### 第 1.5 步：语义拆解（所有描述都必须做）

将自然语言描述转化为无歧义的**原子断言列表**，每条只描述一个可独立验证的事实。

**拆解步骤**：
1. **提取动作谓词**：每个动词/动作短语是一个原子效果的起点
2. **锁定五要素**：
   - 主体（谁执行）
   - 动作（做什么）
   - 目标（作用于谁，按语义边界规则锁定。**注意**：同一技能可能有多个不同目标——自我增益目标=自己，伤害/debuff 目标=对手。实现层必须分别处理，禁止用同一个 targetId 变量覆盖两种目标）
   - 数值（固定值/动态公式，标注数据来源）
   - 条件（触发时机/前置条件/资源消耗）
3. **识别复杂语义模式**并按策略展开（见下方「复杂语义模式」）
4. **输出**：`[条件] → [主体] 对 [目标] 执行 [动作]，数值=[数值]`

**示例**：
```
描述："如果对手拥有 2 个或更多状态效果，则造成 6 点不可防御伤害；否则造成 3 点伤害"
断言1: [对手状态效果 ≥ 2] → 当前玩家 对 对手 造成伤害，数值=6，标签=unblockable
断言2: [对手状态效果 < 2] → 当前玩家 对 对手 造成伤害，数值=3
断言3: [互斥] → 断言1 和断言2 不可同时生效
```

**自检**：原子断言能否完整还原原文语义？五要素都已填写？复杂模式都已标注？

### 第二步：逐链追踪八层

用原子断言列表作为对照基准：

| 层 | 要点 |
|----|------|
| 定义 | 字段值与原子断言一致 |
| 注册 | registry/白名单同步 |
| 执行 | 逻辑存在且语义一致。数据来源/计算方式/作用目标与断言匹配。**函数名不是证据（强制）**：不得因函数名"看起来对"就跳过实际返回值验证。必须追踪函数体确认返回值与权威描述一致。典型：`getUnitBaseAbilities` 名字暗示"基础能力"，但实际返回 `card.abilities + tempAbilities`，与规则定义的"基础能力"不一致 |
| 状态 | reduce 持久化正确。**事件副作用审计**：reduce handler 中除"持久化本事件状态变更"外的逻辑都是副作用嫌疑（如递增计数器、修改无关字段），须逐个确认合理性。同一事件类型在不同阶段（自动触发 vs 手动激活）是否需要不同处理？ |
| **消耗** | **（D11 新增层）reducer 中消耗该资源/额度的分支逻辑是否正确？条件优先级是否正确？多来源并存时消耗的是正确的来源？消耗后不影响其他来源的剩余量？** |
| 验证 | 影响其他命令合法性？**两阶段冲突**：自动触发阶段的计数/状态变更是否导致后续手动激活验证拒绝？ |
| UI | 反馈/入口/提示同步。角色反转上下文中角色字段与约定一致？**UI 读取的字段是否与 reducer 写入的字段一致？多来源聚合是否完整？** |
| i18n | 全语言有条目 |
| 测试 | 触发→生效→状态正确。**测试通过但语义错误 = 测试有 bug**，须同时修复实现和测试。**否定路径测试**：额外额度消耗后正常额度不变？基地限定额度不影响其他基地？ |

### 第三步：grep 消费点

ID 只出现在定义+注册 = 消费层缺失。

### 第四步：交叉影响

新增交互链是否触发已有机制连锁？列出路径并确认。

### 产出要求

"交互链 × 八层"矩阵，每条链附权威描述原文，每格 ✅/❌ + 证据（文件名+函数名），❌ 立即修复或标 TODO。禁止模糊结论。

---

## 复杂语义模式参考

> 语义拆解（第 1.5 步）遇到以下模式时，按对应策略进一步展开。

| 模式 | 识别信号 | 拆解策略 |
|------|---------|---------|
| 条件分支 | "如果/若/当…则…否则…" | 拆为独立路径（含隐含的"否则无效果"），每条独立追踪八层 |
| 组合效果 | "造成 X 并获得 Y" | 拆为原子效果序列，标注顺序依赖 |
| 时序依赖 | "先…然后根据结果…" | 画因果链，验证前置结果正确传递 |
| 升级变体 | "Level 2: 从 3 变为 5" | 建 `字段×等级` 差异矩阵，逐字段验证定义层+执行层+i18n 层一致 |
| 条件累加 | "每有 1 层 X，额外 Y" | 验证动态公式、边界值（0/满） |
| 互斥选择 | "选择 A 或 B（不可同时）" | 验证互斥约束在验证层+UI层双重保障 |
| 触发条件组合 | "当 A 且 B 时" | 列条件真值表，验证所有组合 |
| 跨阶段效果 | "本回合…下回合开始时…" | 标注生命周期起止点，验证 tick/清理 |
| 跨机制交叉 | 效果涉及多个机制标签 | 列出标签的所有消费点，确认交叉场景正确处理 |
| 角色反转 | 防御阶段"攻击者"实际指防御者 | grep 角色反转上下文，验证角色字段与约定一致 |
| target 间接引用 | custom action 中框架自动设置的 target 与 handler 实际业务目标不同 | 列出 handler 所有伤害/状态变更事件的 targetId 来源，确认进攻伤害用显式对手 ID、自我增益用上下文目标。同一 handler 内两种目标必须分别处理 |

---

## 教训附录

> 审查时用 D1-D10，此表仅供类似场景参考。

| 案例 | 缺陷 | 维度 | gameId |
|------|------|------|--------|
| 实现添加描述中不存在的"敌方"过滤 | 目标过滤多余 | D2 | summonerwars |
| "代替攻击"只做新效果没消耗攻击机会 | 语义拆分不足 | D1 | summonerwars |
| zombie_outbreak 限定条件仅入口检查 | 条件作用范围不足 | D2 | smashup |
| rapid_fire 自动触发递增 usageCount 致手动被拒 | 事件副作用+两阶段冲突 | D8+D5 | summonerwars |
| 通知事件在 reduce 中意外改状态 | 事件副作用 | D8 | summonerwars |
| 直接读 unit.card.abilities 绕过 buff | 查询绕过统一入口 | D4 | summonerwars |
| UI 直接读 unit.attack 不显示 buff | UI 查询绕过 | D4 | summonerwars |
| "可选"效果自动执行无确认 UI | 决策点缺失 | D5 | summonerwars |
| 测试只断言事件不断言状态 | 不验证最终状态 | D9 | 通用 |
| 测试按错误理解编写恰好通过 | 测试语义错误 | D9 | 通用 |
| 防御阶段测试攻击者/防御者搞反 | 角色反转 | D9 | dicethrone |
| categories 未声明 'damage' 致防御阶段跳过 | 元数据缺失 | D10 | dicethrone |
| custom action handler 用 `ctx.targetId` 致进攻技能伤害打到自己 | target 间接引用：框架自动设置的 targetId 与 handler 实际业务目标不一致（单一伤害目标错误） | D10+D1 | dicethrone |
| 聚宝盆 `action.target='self'`（主效果抽牌），handler 用 `targetId` 作为弃牌目标 → 弃自己的牌而非对手 | target 间接引用：混合目标场景未区分，同一 handler 内抽牌（自己）和弃牌（对手）用了同一个 `targetId` | D10+D1 | dicethrone |
| 重构后旧 handler 未清理 | 孤儿 handler | D10 | dicethrone |
| 交缠颂歌写入 `cardId`（`target-1`）但读取匹配 `instanceId`（`target-1#1`），永远匹配不上，功能完全失效但不报错 | 写入→读取 ID 类型不一致 | D3 | summonerwars |
| 交缠颂歌共享 `card.abilities + tempAbilities`，但规则定义"基础能力 = 单位卡上印刷的能力，不包括其他卡牌添加的能力"。函数名 `getUnitBaseAbilities` 误导审查者跳过验证 | 规则术语语义偏差 + 函数名误导 | D1 | summonerwars |
| `createSimpleChoice` 的 `multi` 参数 `{ min, max }` 传到 `timeout`（第 6 参数）位置，multi 实际为第 7 参数 | 引擎 API 参数位置错误，功能静默失效 | D3 | summonerwars |
| config 对象中 `min`/`max` 平铺为顶层字段（`{ sourceId, min, max }`），未嵌套在 `multi` 子对象中 | 引擎 API 调用契约违反，`multi` 被忽略 | D3 | summonerwars |
| 描述说"任意数量"但 `createSimpleChoice` 未传 `multi` 参数，导致单选模式 | 交互模式与描述语义不匹配 | D5 | summonerwars |
| 选项 `value` 缺少 `defId` 字段，UI 层 `extractDefId` 返回空，卡牌选项退化为按钮模式 | 选项数据不完整导致 UI 模式退化 | D5 | summonerwars |
| 弃牌堆出牌新建 `DiscardPlayStrip` 组件，与 `PromptOverlay` 的 `displayCards` 模式功能完全重叠 | UI 组件重复：未复用唯一来源组件，新建功能重叠组件 | D5 | smashup |
| 弃牌堆出牌用全屏遮罩 PromptOverlay 展示卡牌，遮挡基地区域导致无法点击基地放置随从 | UI 布局模式错误：选择模式需要底部面板而非全屏遮罩 | D5 | smashup |
| 寒冰碎屑 `customValidator` 只检查充能 ≥ 1，未检查是否存在友方建筑旁有敌方单位。executor 遍历棋盘找目标可能为 0 个，导致消耗充能但零效果 | 验证层前置条件不完整：有代价操作未门控"至少存在有效目标"，验证-执行前置条件不对齐 | D7+D2 | summonerwars |
| 寒冰碎屑/喂养巨食兽 `onPhaseExit` 产生通知事件但未 halt 阶段推进 → UI 弹出确认框时阶段已变 → 玩家确认后 `requiredPhase` 校验失败 | 引擎批处理时序与 UI 异步交互不对齐：阶段结束需确认的技能必须 halt 阶段推进 | D8 | summonerwars |
| 跳过阶段结束技能时 UI 只清除 `abilityMode` 不 dispatch 命令 → `onAutoContinueCheck` 永远不触发 → 游戏卡死 | UI 跳过路径不完整：跳过必须 dispatch 阶段推进命令让引擎层恢复流程 | D8+D5 | summonerwars |
| `triggerPhaseAbilities` 门控条件硬编码 `abilityId === 'feed_beast'`，ice_shards 绕过 `canActivateAbility` 检查 → 充能=0 时仍产生事件 → 阶段推进无 halt → UI 弹确认框 → 服务端拒绝 | 通用门控被特化为单技能：循环中的门控函数被 `abilityId === 'xxx'` 包裹，其他技能绕过验证产生无效事件，引发事件-halt-阶段三方不一致 | D8 | summonerwars |
| 践踏（trample）+ speed_up 组合使移动距离从 2 扩展到 3，`getPassedThroughUnitPositions` 只处理 distance ≤ 2 的非直线路径，distance > 2 非直线直接 `return []`，践踏伤害完全失效 | 能力组合输入域扩展：审计分别验证了 speed_up（移动距离 ✅）和 trample（路径伤害 ✅），但未验证组合后路径算法是否覆盖扩展后的距离×形状输入空间 | D6+D2 | summonerwars |
| 神秘花园 `grantExtraMinion(restrictToBase)` 正确写入 `baseLimitedMinionQuota`，但 reducer `MINION_PLAYED` 中 `useBaseQuota = globalFull && baseQuota > 0` 要求全局额度先用完才消耗基地限定额度。玩家还有正常额度时打到花园的随从错误消耗 `minionsPlayed` | Reducer 消耗路径条件优先级错误：写入正确但消耗分支的 if 条件多了 `globalFull` 前置，导致基地限定额度在全局额度未满时被跳过 | D11+D16 | smashup |
| 神秘花园审计只验证了"能力授予额度 ✅"和"验证层允许打出 ✅"，判定通过。未追踪到 reducer 中消耗该额度的具体分支逻辑 | 审计遗漏：只验证写入链不验证消耗链。写入正确 ≠ 消耗正确，必须追踪到 reducer 消耗分支 | D11+D12 | smashup |
| 母星（全局 minionLimit+1）和花园（baseLimitedMinionQuota+1）同时生效时，打到花园的随从应优先消耗花园额度，但 reducer 优先消耗全局额度 | 多来源竞争：两种额度来源共存时消耗优先级未正确处理 | D13 | smashup |
| 完成仪式描述"打出到一个你至少拥有一个随从的基地上"，但 `ActionCardDef` 无 `playConstraint` 字段，验证层和 UI 层均无打出前置条件检查，玩家可打出到空基地 | 打出约束缺失：审计 section 5 只检查 `ongoingTarget` 字段映射，未覆盖打出前置条件。描述中的条件性打出目标必须在数据定义（`playConstraint`）→ 验证层 → UI 层三层体现 | D2 | smashup |
| 牧师治疗技能无法对友军使用：`canAttackEnhanced` 硬编码 `if (targetOwner === attackerUnit.owner) return false` 拒绝友军目标，治疗模式的绕过逻辑只在 `execute.ts` 中，UI 层调用 `canAttackEnhanced` 时仍被拒绝 | 架构假设冲突：底层验证函数假设"攻击=敌对行为"，无法处理"攻击友军=治疗"的特殊语义。绕过逻辑分散在 execute/validate/UI 层，不一致 | D23 | summonerwars |
| 群情激愤无法让友军在魔力阶段攻击：`validate.ts` 硬编码 `if (core.phase !== 'attack') return false` 拒绝非攻击阶段的攻击命令，即使事件卡授予了跨阶段攻击权限 | 架构假设冲突：底层验证函数假设"攻击只能在攻击阶段"，无法处理事件卡授予的跨阶段攻击特权 | D23 | summonerwars |
| 抓附（grab）跟随位置错误：UI 用 `getAdjacentCells(grabberPosition)`（抓附单位位置）计算相邻格子，应用 `getAdjacentCells(movedTo)`（移动单位目标位置）。描述"将本单位放置到**该单位相邻的区格**"（该单位=移动的单位） | UI 计算参考点语义错误：event payload 包含多个正确字段（`grabberPosition` 和 `movedTo`），但选择了语义不匹配的输入 | D15 | summonerwars |
| 群情激愤在 magic 阶段写入 `extraAttacks=1`，但 attack 阶段已过，`TURN_CHANGED` 清理 `extraAttacks=0`。写入→清理之间不包含消费窗口，extraAttacks 永远不会被消费。排查时只验证写入链（事件卡打出→执行→reduce 写入）全部正常，忽略了"写入后何时能用"的时序问题 | 写入-消费窗口不对齐：写入时机在消费窗口之后，状态被回合清理抹掉。排查盲区：只验证写入链不验证消费时序 | D8 | summonerwars |
| 亡者崛起 handler 返回 `CARDS_DISCARDED`（弃手牌）+ 新 interaction（从弃牌堆选随从），但 `CARDS_DISCARDED` 尚未 reduce，刚弃的牌仍在 `player.hand` 而非 `player.discard`。选项只从 `player.discard` 过滤 → 刚弃的随从不在候选列表 → 弹窗为空/无选项 | Handler 共返状态不一致：handler 同时返回 events 和新 interaction，新 interaction 的选项基于未 reduce 的旧状态构建，缺失 events 带来的状态变更 | D24 | smashup |
| 实地考察（Field Trip）选择部分手牌放入牌库底，结果全部手牌被清空。`HAND_SHUFFLED_INTO_DECK` reducer 无条件 `hand: []`，但 Field Trip 只移动选中的手牌，未选中的手牌被误清空 | Reducer 操作范围超出 payload 语义：同一事件类型被全量操作（Winds of Change 移动全部手牌）和部分操作（Field Trip 移动选中手牌）复用，reducer 只兼容全量场景，部分操作时误清空未选中数据 | D12 | smashup |
| 弹一手/惊不惊喜等骰子修改卡在响应窗口打出后无效果：ResponseWindowSystem（priority=15）处理 `INTERACTION_REQUESTED` 后设置 `pendingInteractionId`，紧接着状态驱动解锁检查发现 `sys.interaction.current` 为空 → 误判交互已完成 → 关闭窗口。DiceThroneEventSystem（priority=22）尚未执行 `queueInteraction`。测试只断言 `sys.interaction.current` 存在但不断言 `sys.responseWindow.current` → 测试通过但功能实际无效 | 多系统 afterEvents 优先级竞争：低优先级系统的状态驱动检查在高优先级系统执行前误触发。测试遗漏：只断言单个系统状态不断言协作系统状态 | D8 | dicethrone |
| `targetOpponentDice` 在所有骰子修改 handler 中硬编码为 `false`，导致响应窗口中打出的骰子修改卡（target=select/opponent）无法作用于对手骰子 | 元数据硬编码：handler 未根据 `action.target` 动态解析目标，所有骰子修改交互都默认操作自己的骰子 | D10+D1 | dicethrone |
