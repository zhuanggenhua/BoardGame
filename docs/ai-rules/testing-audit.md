# 测试与审计规范

> **触发条件**：新增功能/技能/API、修复 bug、审查实现完整性时阅读。

---

## 核心原则

- **全面审计为主，测试工具为辅（强制）**：审计是思维框架（告诉你"该检查什么"），测试工具是执行手段（帮你"自动化检查"）。审计必须先做（人工思考），测试工具是补充（自动化覆盖）。
- **数据驱动优先，禁止硬编码（强制）**：实现任何游戏机制时，优先将规则/配置/效果做成可枚举数据，由引擎解析执行。禁止用 switch-case/if-else 逐个硬编码技能/效果/卡牌逻辑。新增同类机制时应提取抽象（通用 handler/executor/模板），而非复制粘贴再改参数。
- **测试用固定值代替随机（强制）**：测试中涉及随机数（骰子、抽牌、洗牌等）时，必须使用固定值或可控的伪随机序列，禁止依赖真随机。做法：① GameTestRunner 的 `random` 参数传入返回固定值的函数 ② 使用 `applyDiceValues` 等调试面板 API 注入预设值 ③ 测试 setup 中直接构造确定性初始状态。目的：确保测试结果可重复、可调试、不因随机波动导致偶发失败。
- **同类测试去重**：多个实体共享同一 handler/executor/reducer 分支时，只需一个代表性行为测试，其余用契约测试覆盖数据定义。≥5 个同类用 `test.each`。仅当条件分支/交互路径/边界行为/交叉影响不同时才需独立测试。
- **事件发射 ≠ 状态生效**：必须断言 reduce 后的最终状态，禁止只测注册/写入就判定"已实现"。
- **多系统协作必须断言所有相关系统状态（强制）**：涉及多个引擎系统协作的功能（如响应窗口+交互系统、流程系统+交互系统），测试必须同时断言所有相关系统的状态字段，不能只断言其中一个。典型：测试只断言 `sys.interaction.current` 存在但不断言 `sys.responseWindow.current` 仍打开 → 测试通过但功能实际无效。

---

## 一、全面审计规范（主要方法）

### 1. 通用实现缺陷检查维度（D1-D24）

---

## 二、测试工具选型（辅助手段）

> **核心原则**：GameTestRunner 行为测试最优先，审计工具是补充。

| 工具 | 适用场景 |
|------|---------|
| GameTestRunner | 命令序列+状态断言（首选） |
| entityIntegritySuite | 数据定义契约（≥20 实体时必选） |
| referenceValidator | 实体引用链验证 |
| interactionChainAudit | UI 状态机 payload 覆盖（多步 UI 交互时必选） |
| interactionCompletenessAudit | Interaction handler 注册覆盖（有 InteractionSystem 时必选） |

### 效果数据契约测试（强制）

新增游戏/英雄/卡牌/Token 定义时必须同步编写。职责：结构完整性 + 语义正确性。数据定义必须包含所有执行所需字段，禁止执行层"猜测"。

- `createEffectContractSuite`：接受 getSources/getSourceId/extractEffects/rules/minSourceCount
- `createI18nContractSuite`：验证 i18n key 格式和存在性
- 新增游戏 → 创建 `entity-chain-integrity.test.ts`；所有有 action 的效果必须声明 timing

### 交互链完整性审计

**模式 A（UI 状态机）**：多步交互必须声明 `interactionChain`。检查：声明完整性、steps ⊇ required、定义层与执行器 payloadContract 双向一致。

**模式 B（Interaction 链）**：检查 handler 注册覆盖、链式完整性、孤儿 handler。审计输入从源码自动抽取，禁止维护手工列表。

### CI 质量门禁

PR 必跑：`typecheck` → `test:games` → `i18n:check` → `test:e2e:critical`。

---

## 三、E2E 测试选择器一致性检查（强制）

> **重构 UI 交互模式后必须执行**。UI 组件的渲染方式变更（如从弹窗改为内联横幅）时，所有引用旧选择器的 E2E 测试必须同步更新。

**检查清单**：

1. **选择器来源验证**：E2E 测试中的 `data-testid`/CSS 选择器/文本匹配，必须对应实际渲染的组件。重构后用 `grep` 搜索旧选择器，确认所有 E2E 文件已更新。
2. **交互路径验证**：测试中的点击/输入序列必须与实际 UI 交互路径一致。例如：手牌选择在 HandArea 中直接点击 vs 在弹窗 overlay 中选择，两者选择器完全不同。
3. **按钮文本验证**：按钮文本来自 i18n，测试中的正则匹配必须覆盖中英文两种 locale（`/Confirm Discard|确认弃牌/i`）。
4. **状态验证**：测试必须验证 UI 状态变更（如 `data-selected="true"`），不能只验证"点击了按钮"。

**典型反模式**：

- ❌ 重构了交互模式（弹窗→横幅），E2E 测试仍查找旧弹窗选择器 → 测试超时/skip，从未真正执行
- ❌ 测试中硬编码了组件内部 CSS 类名（如 `.card-selector-overlay`）→ 样式重构后测试失效
- ✅ 使用 `data-testid` + 按钮文本匹配，与实际渲染组件对齐

---

## 四、教训附录

> 所有审查/审计/新增功能验证时按维度检查。D1-D10 为原有维度（已扩展），D11-D33 为新增维度。

| # | 维度 | 核心问题 |
|---|------|---------|
| D1 | 语义保真 | 实现是否忠实于权威描述？（多做/少做/做错）。**特别注意**：伤害/debuff 的作用目标是否与描述一致？custom action handler 中 targetId 来源是否正确？**实体筛选/收集操作的范围是否与描述一致？**（"本基地" vs "其他基地" vs "所有基地"等） |
| D2 | 边界完整 | 所有限定条件是否全程约束？ |
| D3 | 数据流闭环 | 定义→注册→执行→状态→验证→UI→i18n→测试 是否闭环？**写入→读取 ID 一致性**、**引擎 API 调用契约** |
| D4 | 查询一致性 | 可被 buff/光环动态修改的属性是否走统一入口？ |
| D5 | 交互完整 | 玩家决策点都有对应 UI？**交互模式与描述语义匹配？** **实现模式（额度 vs 交互）与描述语义匹配？** **UI 组件是否复用唯一来源？** |
| D6 | 副作用传播 | 新增效果是否触发已有机制的连锁？ |
| D7 | 资源守恒 | 代价/消耗/限制正确扣除和恢复？**有代价操作的验证层是否拒绝必然无效果的激活？** |
| D8 | 时序正确 | 触发顺序和生命周期正确？**引擎批处理时序与 UI 异步交互是否对齐？阶段结束副作用与阶段推进的执行顺序是否导致验证层状态不一致？事件产生门控是否对所有同类技能普适生效（禁止硬编码特定 abilityId）？状态写入时机是否在消费窗口内（写入后是否有机会被消费，还是会被清理逻辑先抹掉）？交互解决后是否自动恢复流程推进（D8.4）？多系统协作时，同批事件的处理顺序（按 priority）是否导致低优先级系统的状态驱动检查在高优先级系统执行前误触发？回调函数（onPlay/onMinionPlayed 等）中的计数器检查是否使用了正确的 post-reduce 阈值（首次=1 而非 0）？是否使用权威计数器而非派生状态判定"首次"？** |
| D9 | 幂等与重入 | 重复触发/撤销重做安全？**后处理循环中的事件去重集合是否从正确的数据源构建？** |
| D10 | 元数据一致 | categories/tags/meta 与实际行为匹配？ |
| D11 | **Reducer 消耗路径** | 事件写入的资源/额度/状态，在 reducer 消耗时走的分支是否正确？**多种额度来源并存时消耗优先级是否正确？** |
| D12 | **写入-消耗对称** | 能力/事件写入的字段，在所有消费点（reducer/validate/UI）是否被正确读取和消耗？写入路径和消耗路径的条件分支是否对称？**Reducer 操作范围是否与 payload 声明的范围一致（禁止全量清空 payload 未涉及的数据）？** |
| D13 | **多来源竞争** | 同一资源/额度/状态有多个写入来源时，消耗逻辑是否正确区分来源？不同来源的优先级/互斥/叠加规则是否正确？ |
| D14 | **回合清理完整** | 回合/阶段结束时临时状态（额度/buff/标记/计数器）是否全部正确清理？清理遗漏会导致下回合状态泄漏 |
| D15 | **UI 状态同步** | UI 展示的数值/状态是否与 core 状态一致？UI 读取的字段是否是 reducer 实际写入的字段？UI 是否遗漏了某些状态来源？**UI 计算参考点是否与描述语义一致？UI 交互门控是否与 validate 合法路径对齐？** |
| D16 | **条件优先级** | reducer/validate 中多个条件分支（if/else if/else）的优先级是否正确？先命中的分支是否应该先命中？ |
| D17 | **隐式依赖** | 功能是否依赖特定的调用顺序/状态前置条件但未显式检查？事件处理顺序变化是否会破坏功能？ |
| D18 | **否定路径** | "不应该发生"的场景是否被测试覆盖？（如：额外额度不应消耗正常额度、基地限定额度不应影响其他基地） |
| D19 | **组合场景** | 两个独立正确的机制组合使用时是否仍然正确？（如：神秘花园额外额度 + 正常额度同时存在时的消耗行为） |
| D20 | **状态可观测性** | 玩家能否从 UI 上区分不同来源的资源/额度？（如：正常随从额度 vs 基地额外额度在 UI 上是否可区分） |
| D21 | **触发频率门控** | 触发型技能（`afterAttack`/`afterMove`/`onPhaseStart`/`onPhaseEnd`）是否有使用次数限制？同一效果的不同触发方式（攻击后 vs 代替攻击）是否互斥？ |
| D22 | **伤害计算管线配置** | 使用 `createDamageCalculation` 时配置项是否正确？`autoCollectStatus`/`autoCollectTokens`/`autoCollectShields` 是否根据业务需求启用？伤害来源和目标是否正确？ |
| D23 | **架构假设一致性** | 底层架构的隐含假设是否与描述语义冲突？通用验证函数（如 `canAttackEnhanced`）的硬编码规则是否阻止特殊语义实现？阶段/目标/资源的底层约束是否需要为特殊机制开放？ |
| D24 | **Handler 共返状态一致性** | 交互 handler 同时返回 events 和新 interaction 时，新 interaction 的选项是否基于 events 已生效后的状态计算？（events 尚未 reduce，选项基于旧状态会导致候选列表缺失/过时） |
| D25 | **MatchState 传播完整性** | 能力需要创建交互时，调用点是否传递了 `matchState` 参数？返回后是否更新了 `matchState` 变量？测试是否覆盖了完整调用链路（而非只测能力函数本身）？ |
| D26 | **事件设计完整性** | 事件是否包含所有消费者需要的上下文信息？事件设计前是否列出了所有已知消费场景？事件字段是否支持所有消费场景的需求？ |
| D27 | **可选参数语义** | 可选参数在哪些场景下是必需的？调用点是否在必需场景下传递了可选参数？类型系统是否能捕获遗漏？函数是否应该拆分为 `fooBase(required)` 和 `fooWithContext(required, optional)`？ |
| D28 | **白名单/黑名单完整性** | 白名单/黑名单是否覆盖所有已知场景？新增功能时是否更新了白名单？白名单逻辑是否有文档说明加入条件？白名单是否是"显式声明"而非"隐式推断"？ |
| D29 | **PPSE 事件替换完整性** | `postProcessSystemEvents` 可能过滤/替换/追加事件（如压制 `MINION_DESTROYED`），调用方（`runAfterEventsRounds`）是否用 PPSE 返回的完整事件列表替换原 `roundEvents` 中的领域事件？仅追加新增部分 = ❌ 被压制的事件仍会被 reduce |
| D30 | **消灭流程时序与防止消灭白名单** | `processDestroyTriggers` 中：① onDestroy 必须在防止消灭触发器（基地能力/ongoing）之后执行，仅在确认消灭时触发；② pendingSave 判定使用 `PREVENT_DESTROY_SOURCE_IDS` 白名单，新增防止消灭能力时必须将其 sourceId 加入白名单，否则消灭不会被暂缓；③ 交互选项值必须快照所有 handler 需要的字段（如 `counterAmount`），因为来源实体可能在交互解决前离场 |
| D31 | **效果拦截路径完整性** | 使用"注册+过滤"两步实现的拦截机制（如 `registerProtection` + `filterProtected*Events`），过滤函数是否在**所有事件产生路径**上被调用？① 直接命令执行（`execute()`/`reducer.ts` 后处理）② 交互解决（`afterEvents` in `systems.ts`）③ FlowHooks 后处理（`postProcess` in `index.ts`）④ 触发链递归（`processDestroyTriggers`/`processMoveTriggers` 内部产生的事件）。任一路径遗漏 = 保护机制在该路径下完全失效但不报错 |
| D32 | **替代路径后处理对齐** | 代码中存在多条路径调用同一核心函数（如 `resolvePostDamageEffects`/`resolveAttack`）时，所有路径是否实现了相同的后处理检查集？替代/快捷路径（如潜行免伤、闪避、先手击杀）是否遗漏了规范路径中的 halt 检查、响应窗口、额外攻击等后处理逻辑？ |
| D33 | **跨实体同类能力实现路径一致性** | 不同实体（英雄/派系/卡组/单位类型）中语义相同的能力（伤害/治疗/抽牌/移动/状态修正/额外行动/回收/限制等）是否使用一致的事件类型、注册模式和副作用处理？合理差异（语义本身不同导致的实现差异）需标注原因，不合理差异需修复 |
| D34 | **交互选项 UI 渲染模式正确性** | 交互选项的 `value` 字段是否包含会被 UI 误判为"卡牌选择"的字段（`defId`/`minionDefId`/`baseDefId`）？简单确认交互（是/否）是否显式声明 `displayMode: 'button'`？选项 `value` 中的字段是否都被交互处理器实际使用（禁止包含不必要的上下文字段）？UI 组件的 `isCardOption`/`extractDefId` 逻辑是否与交互设计意图一致？ |
| D35 | **交互上下文快照完整性** | 交互创建时是否保存了所有必要的上下文信息到 `continuationContext`？**关键场景**：① 基地计分后创建交互（`afterScoring`），此时基地上的随从/ongoing 卡牌信息需要快照，因为 `BASE_CLEARED` 事件被延迟，但其他交互可能会修改基地状态；② 链式交互中，第一个交互解决后可能改变第二个交互的候选列表，需要在创建时快照；③ 交互处理器需要访问的任何"可能在交互解决前变化"的数据，都必须快照。**反模式**：只保存 `baseIndex`/`cardUid` 等引用，但不保存实体的详细信息（如力量值、defId、owner 等）。**参考实现**：海盗湾（`base_pirate_cove`）的 `minionsSnapshot`。 |
| D36 | **延迟事件补发的健壮性** | 延迟事件（如 `_deferredPostScoringEvents`）的补发是否依赖脆弱的条件？**脆弱设计**：补发逻辑只在 `sourceId` 存在且 `getInteractionHandler(sourceId)` 返回有效 handler 时执行 → 如果 handler 未注册或抛出异常，延迟事件永远不会被发出，游戏卡死。**健壮设计**：延迟事件的补发应该在框架层（如 `InteractionSystem`）无条件执行，不依赖游戏层的 handler 实现。**检查清单**：① 所有创建交互的能力是否都注册了 handler？② handler 是否可能抛出异常导致补发逻辑不执行？③ 延迟事件的存储位置是否安全（不会被意外修改或删除）？④ 链式交互时，延迟事件是否正确传递到下一个交互？ |
| D37 | **交互选项动态刷新完整性** | 框架层已支持自动推断选项类型（根据 `value` 的字段：`minionUid` → field、`baseIndex` → base、`cardUid` → hand/discard），无需手动添加 `_source` 字段。**根因**：同时触发多个交互时，后续交互创建时基于初始状态，可能包含已失效的选项（如已被替换的基地、已被消灭的随从、已被弃掉的手牌）。框架层的 `refreshInteractionOptions` 自动刷新所有选项。**可选优化**：复杂场景（如从弃牌堆/牌库选择）可显式声明 `_source: 'discard'` 提升性能，但非必需。**自动化检查**：grep 所有 `createSimpleChoice` 调用，查找手写 `optionsGenerator` 的地方（通常不需要，框架层已自动处理）。**参考文档**：`docs/bugs/smashup-jinx-dynamic-options.md`。**教训**：海盗大副（pirate_first_mate）、蒸汽朋克亚哈船长（steampunk_captain_ahab）、机械师（steampunk_mechanic）、场地变更（steampunk_change_of_venue）、托尔图加（base_tortuga）、诡猫巷（base_cat_fanciers_alley）、平衡之地（base_land_of_balance）、绵羊神社（base_sheep_shrine）、牧场（base_the_pasture）都因缺少动态刷新导致托尔图加计分后基地被替换时选项过时，用户点击后卡住。框架层自动推断后，这些问题全部自动修复，无需修改游戏层代码。 |
| D38 | **UI 门控系统优先级冲突** | 多个独立的 UI 门控系统（`disabled*`/`*DisabledUids`/`isSelectable` 等）同时作用于同一 UI 元素时，是否存在优先级冲突？**根因**：不同上下文（响应窗口/交互系统/教学模式/阶段限制）各自计算禁用集合，UI 层取并集导致过度禁用。**核心原则**：交互系统激活时应该是最高优先级，其他门控系统必须检查交互状态并退让（返回 `undefined`）。**审查方法**：① 识别所有 UI 门控系统（grep `disabled*`/`*DisabledUids` 的 useMemo）② 绘制状态机交叉矩阵（哪些状态可能同时激活）③ 检查高优先级门控是否在计算开始时检查低优先级状态并提前返回 ④ 典型冲突：响应窗口门控 × 交互系统门控、教学模式 × 正常游戏、阶段限制 × 能力授予额外行动。**优先级规则**：交互系统 > 响应窗口 > 教学模式 > 阶段限制；全局禁用（游戏结束/加载中）> 所有局部门控。**自动化检查**：在 HandArea 等组件中添加 warning，当多个 `disabledCardUids` 同时非空时打印警告。**参考文档**：`docs/bugs/smashup-ninja-hidden-ninja-ui-state-conflict.md`。**教训**：便衣忍者在 Me First! 窗口中打出后创建手牌选择交互，但 `meFirstDisabledUids` 继续禁用所有非 `beforeScoringPlayable` 随从，导致交互无法完成。修复：`meFirstDisabledUids` 计算中添加 `if (isHandDiscardPrompt) return undefined;`。 |
| D39 | **流程控制标志清除完整性** | 流程控制标志（`flowHalted`/`isProcessing`/`isPending` 等）的清除条件是否完整？清除条件必须检查标志背后的状态，而非只检查标志本身。**核心原则：流程控制标志是"症状"，背后的状态（如交互是否完成）才是"病因"。清除标志时必须检查病因是否已消除，而非只检查症状是否存在。** 审查方法：① **识别所有流程控制标志**：grep `flowHalted`/`isProcessing`/`isPending`/`isLocked` 等标志的设置点 ② **追踪每个标志的设置原因**：标志为什么被设置？背后的状态是什么？（如 `flowHalted=true` 因为创建了交互等待玩家响应）③ **追踪每个标志的清除条件**：清除逻辑是否检查了背后的状态？（如检查 `sys.interaction.current` 是否为空）还是只检查标志本身？④ **检查所有退出路径**：正常完成、用户取消、错误、超时等所有路径是否都正确清除标志？⑤ **检查守卫逻辑**：使用标志的守卫（如 `if (flowHalted) return { halt: true }`）是否同时检查了背后的状态？**典型缺陷模式**：❌ 守卫只检查 `flowHalted` 标志，不检查交互是否仍在进行 → 交互完成后标志未清除，守卫永远 halt ❌ 清除逻辑只在正常完成路径，错误/取消路径未清除 → 标志泄漏到下次操作 ❌ 多个系统共享同一标志，一个系统清除后另一个系统仍依赖 → 状态不一致 ✅ 守卫检查 `flowHalted && sys.interaction.current` → 只有标志存在且交互仍在进行时才 halt ✅ 所有退出路径（正常/取消/错误）都清除标志 ✅ 每个标志有明确的"拥有者"系统，只有拥有者负责清除。**审查输出格式**：```标志: flowHalted (src/games/smashup/domain/index.ts:577)设置原因: 创建交互等待玩家响应（beforeScoring/afterScoring 技能）背后状态: sys.interaction.current 存在清除条件: ❌ 只检查 flowHalted 标志，不检查 sys.interaction.current守卫逻辑: if (state.sys.flowHalted) return { halt: true } ❌ 缺少交互状态检查退出路径: 正常完成 ✅ / 用户取消 ✅ / 错误 ❌ / 超时 ❌判定: ❌ 清除条件不完整（只检查标志不检查状态）修复方案: 将守卫改为 if (state.sys.flowHalted && state.sys.interaction.current) return { halt: true }```**排查信号**：① "操作后卡住/无法继续" + 日志显示 `halt=true` 但交互已完成 = 高度怀疑标志清除条件不完整 ② 标志在某些场景下正常清除，某些场景下泄漏 = 退出路径不完整 ③ 多个系统使用同一标志，行为不一致 = 标志所有权不明确。**参考文档**：`docs/bugs/smashup-tortuga-pirate-king-卡住-2026-02-28-16-53.md`。**教训**：托尔图加海盗王移动后卡住。`flowHalted=true` 因为 beforeScoring 创建交互，用户响应后交互完成，但 `onPhaseExit` 守卫只检查 `flowHalted` 标志不检查 `sys.interaction.current`，直接返回 `halt=true`，导致 afterScoring 永远不执行。修复：守卫改为 `if (state.sys.flowHalted && state.sys.interaction.current) return { halt: true }`，只有标志存在且交互仍在进行时才 halt。 |
| D40 | **后处理循环事件去重完整性** | 后处理循环中判定"新事件"时，去重集合必须从**输入事件**构建，而非从**输出事件**构建。输出事件可能被过滤/替换/追加，不能作为"已处理"的判定依据。**核心原则**：循环中的"已处理"集合应该反映真正已处理的输入事件，而非处理后的输出事件。**审查方法**：① **识别后处理循环**：grep 所有包含 `while`/`for` 循环且处理事件列表的函数（如 `processDestroyMoveCycle`/`runAfterEventsRounds`）② **追踪去重集合构建**：循环中用于判定"新事件"的集合（如 `destroyUidsBefore`/`processedUids`），其数据源是什么？③ **判定标准**：去重集合从**输入事件**构建 → ✅ 正确（反映真正已处理的事件）；去重集合从**输出事件**构建 → ❌ 错误（输出可能被过滤，导致误判）；去重集合从**中间状态**构建 → ⚠️ 需要验证中间状态是否等价于输入 ④ **循环不变式检查**：每次迭代后，去重集合是否正确更新（累加新处理的事件）？⑤ **典型缺陷模式**：❌ `Set(afterProcess.events.filter(...))` — 从输出构建，可能遗漏被过滤的事件 ❌ 循环中去重集合不更新 — 每次迭代都用初始集合，导致重复处理 ✅ `Set(inputEvents.filter(...))` — 从输入构建，反映真正已处理的事件 ✅ 每次迭代后 `processedUids.add(newUid)` — 累加更新。**审查输出格式**：```函数: processDestroyMoveCycle (reducer.ts:991-1070)循环类型: while (newDestroyEvents.length > 0)去重集合: destroyUidsBefore数据源: afterDestroy.events ❌ 应该从 events 参数构建判定: ❌ 去重集合从输出事件构建，可能遗漏被过滤的事件修复方案: 将 line 1008 改为 events.filter(...)```**典型案例**：SmashUp `processDestroyMoveCycle`：`destroyUidsBefore` 从 `afterDestroy.events` 构建 → 被拯救的随从 UID 不在集合中 → 后续循环误判为"新消灭" → 重复触发 onDestroy。**参考文档**：`docs/bugs/smashup-igor-double-trigger-investigation.md`。**教训**：Igor 被消灭时 onDestroy 触发两次。`processDestroyTriggers` 第一轮处理 Igor 消灭，但 `destroyUidsBefore` 从 `afterDestroy.events` 构建（而非输入 `events`），导致循环中同一个 Igor UID 被误判为"新的"消灭，`processDestroyTriggers` 被再次调用，Igor onDestroy 触发第二次。修复：将 `destroyUidsBefore` 改为从输入 `events` 构建。 |
| D41 | **系统职责重叠检测** | 多个系统是否对同一批数据执行相同处理？**触发条件**：新增系统、重构现有系统、修复"重复触发"类 bug。**审查方法**：① **识别所有处理同类数据的系统**：grep 所有调用相同核心函数的地方（如 `processDestroyMoveCycle`）② **绘制调用链路图**：每个系统在什么时机调用？输入是什么？输出是什么？③ **检查职责边界**：两个系统是否对同一批数据执行相同处理？④ **判定标准**：同一批数据被处理一次 → ✅ 正确；同一批数据被处理多次 → ❌ 职责重叠。**输出格式**：```系统 A: SmashUpEventSystem.afterEvents()调用: processDestroyMoveCycle(交互解决产生的事件)时机: Pipeline afterEvents 阶段系统 B: postProcessSystemEvents()调用: processDestroyMoveCycle(所有系统事件)时机: Pipeline 步骤 4.5 和步骤 5判定: ❌ 职责重叠（交互解决产生的事件被处理两次）```**典型案例**：SmashUp Igor 双重触发 — `SmashUpEventSystem.afterEvents()` 和 `postProcessSystemEvents` 都调用 `processDestroyMoveCycle`，导致 Igor onDestroy 触发两次。**参考文档**：`docs/bugs/smashup-igor-double-trigger-root-cause-final.md`、`docs/bugs/smashup-igor-fix-summary.md`。 |
| D42 | **事件流全链路审计** | 事件从产生到消费的完整路径是否被重复处理或遗漏处理？**触发条件**：新增事件类型、修改事件处理逻辑、修复"事件丢失/重复"类 bug。**审查方法**：① **选择代表性事件**：如 `MINION_DESTROYED` ② **追踪完整生命周期**：产生（哪些地方会产生？）→ 传递（如何从产生点传递到消费点？）→ 处理（哪些系统会处理？处理顺序？）→ 消费（如何影响状态？）③ **检查重复处理**：同一个事件是否被多个系统处理？④ **检查遗漏处理**：是否有应该处理但没有处理的系统？**典型案例**：SmashUp Igor — `MINION_DESTROYED` 事件被 `SmashUpEventSystem` 和 `postProcessSystemEvents` 重复处理。**参考文档**：`docs/bugs/smashup-igor-fix-summary.md`。 |
| D43 | **重构完整性检查** | 引入新系统替代旧系统时，旧系统的职责是否完全迁移？遗留代码是否已清理？**触发条件**：引入新系统替代旧系统、重构现有架构。**审查方法**：① **识别新旧系统**：新系统是什么？旧系统是什么？② **检查职责迁移**：旧系统的职责是否完全迁移到新系统？③ **检查遗留代码**：旧系统的代码是否已清理？④ **检查调用点**：所有调用旧系统的地方是否已更新？⑤ **判定标准**：旧系统完全移除 → ✅ 重构完整；旧系统部分保留 → ⚠️ 需要文档说明原因；新旧系统并存且职责重叠 → ❌ 重构不完整。**典型案例**：SmashUp — 引入 `postProcessSystemEvents` 统一处理所有系统事件，但忘记移除 `SmashUpEventSystem` 中的后处理逻辑，导致职责重叠。**参考文档**：`docs/bugs/smashup-igor-fix-summary.md`。 |
| D44 | **测试设计反模式检测** | 测试是否依赖内部实现，导致架构重构破坏测试？**触发条件**：编写新测试、修复测试失败、架构重构导致测试破坏。**反模式清单**：① **直接调用内部函数**：测试直接调用 `processDestroyTriggers`/`processAffectTriggers` 等内部实现，而不是通过 `runCommand` ② **绕过 Pipeline**：测试不经过完整的命令执行流程，导致系统钩子（`afterEvents`/`postProcessSystemEvents`）未被调用 ③ **验证中间状态**：测试断言内部函数的返回值，而不是最终的游戏状态 ④ **假设实现细节**：测试依赖"交互在哪个阶段创建"等实现细节，而不是"交互最终是否存在"。**正确做法**：① **使用公开 API**：通过 `runCommand` 执行命令，让 Pipeline 自动调用所有系统 ② **验证最终状态**：断言 `finalState.sys.interaction.current` 等最终状态，而不是中间步骤 ③ **黑盒测试**：测试"输入→输出"，不关心内部如何实现 ④ **架构无关**：架构重构不应破坏测试（除非行为真的变了）。**判定标准**：测试调用 `runCommand` → ✅ 正确；测试直接调用 `processXxx` 内部函数 → ❌ 反模式；测试断言 `finalState` → ✅ 正确；测试断言 `processXxx` 的返回值 → ❌ 反模式。**典型案例**：SmashUp Igor 测试失败 — 4 个测试直接调用 `processDestroyTriggers`，绕过 Pipeline，架构修复（移除重复后处理）导致测试破坏。如果测试使用 `runCommand`，架构修复不会破坏测试。**参考文档**：`docs/bugs/smashup-igor-fix-summary.md`。 |
| D45 | **Pipeline 多阶段调用去重** | 同一函数在 pipeline 不同阶段被调用多次，导致副作用重复执行？**触发条件**：新增/修改 pipeline 流程、新增系统钩子（afterEvents/postProcessSystemEvents）、修复"重复触发"类 bug。**核心原则**：Pipeline 中的后处理函数（如 `postProcessSystemEvents`）可能在多个阶段被调用（步骤 4.5 和步骤 5），如果函数内部没有去重机制，会对同一批事件重复处理，导致副作用（如创建交互、触发能力）重复执行。**审查方法**：① **识别多阶段调用**：grep pipeline 中所有调用同一函数的位置（如 `postProcessSystemEvents` 在步骤 4.5 和步骤 5 都被调用）② **追踪函数副作用**：该函数会产生什么副作用？（创建交互、发射事件、修改状态）③ **检查去重机制**：函数内部是否有"已处理事件"集合？去重集合是否从正确的数据源构建（输入事件而非输出事件）？④ **判定标准**：函数在 pipeline 中被调用 1 次 → ✅ 无需去重；函数在 pipeline 中被调用 ≥2 次 + 有去重机制 → ✅ 正确；函数在 pipeline 中被调用 ≥2 次 + 无去重机制 → ❌ 会重复执行。**典型缺陷模式**：❌ `postProcessSystemEvents` 在步骤 4.5 和步骤 5 都被调用，每次都处理相同的 `MINION_PLAYED` 事件 → 创建两个不同的交互，第二个覆盖第一个 ❌ 去重集合从输出事件构建（`afterProcess.events`）而非输入事件 → 被过滤的事件不在集合中，下次循环误判为"新事件"。**修复策略**：① **添加去重逻辑**：在函数入口检查事件是否已处理（如通过 `sourceCommandType` 字段区分原始事件和派生事件）② **移除重复调用**：如果函数的职责已被其他系统覆盖，移除冗余调用点 ③ **去重集合从输入构建**：循环中的"已处理"集合必须从输入事件构建，而非输出事件。**排查信号**：① "交互一闪而过" + 日志显示交互 ID 变化（如 `robot_hoverbot_0` → `robot_hoverbot_<timestamp>`）= 高度怀疑重复创建交互 ② "能力触发两次" + 日志显示同一事件被处理多次 = 高度怀疑 pipeline 多阶段调用。**参考文档**：`docs/bugs/smashup-robot-hoverbot-interaction-double-trigger.md`、`docs/bugs/smashup-igor-double-trigger-root-cause-final.md`。**教训**：盘旋机器人 onPlay 能力的交互一闪而过，`postProcessSystemEvents` 在 pipeline 步骤 4.5 和步骤 5 都被调用，每次都处理相同的 `MINION_PLAYED` 事件，创建了两个不同的交互（ID 从 `robot_hoverbot_0` 变成 `robot_hoverbot_<timestamp>`），第二个覆盖了第一个。修复：添加 `sourceCommandType` 字段区分原始事件和派生事件，只处理有 `sourceCommandType` 的事件。 |
| D46 | **交互选项 UI 渲染模式声明完整性** | 交互选项缺少 `displayMode` 声明，UI 不知道如何渲染？**触发条件**：新增交互能力、修复"UI 显示不对"/"卡牌预览不显示"类 bug。**核心原则**：交互选项的 `value` 字段包含 `defId`/`cardUid` 等字段时，UI 会自动推断为"卡牌选择"并显示卡牌预览。如果业务语义不是卡牌选择（如"是否打出牌库顶的随从"），必须显式声明 `displayMode: 'button'` 覆盖自动推断。**审查方法**：① **识别交互选项结构**：grep 所有 `createSimpleChoice` 调用，检查选项的 `value` 字段包含哪些字段 ② **判定业务语义**：选项是"从列表中选择一张卡"（卡牌选择）还是"确认/取消操作"（按钮选择）？③ **检查 displayMode 声明**：业务语义是按钮选择 + `value` 包含 `defId`/`cardUid` → 必须显式声明 `displayMode: 'button'`；业务语义是卡牌选择 → 可以省略 `displayMode`（自动推断）④ **UI 渲染验证**：实际运行时 UI 是否按预期渲染？（卡牌预览 vs 按钮）。**典型缺陷模式**：❌ 选项 `value: { cardUid, defId }` + 无 `displayMode` 声明 → UI 自动推断为卡牌选择，显示卡牌预览（可能不符合预期）❌ 选项 `value: { done: true }` + 无 `displayMode` 声明 → UI 推断为按钮（正确），但不一致（其他选项有 `displayMode` 声明）。**修复策略**：① **显式声明 displayMode**：所有交互选项都显式声明 `displayMode: 'button'` 或 `displayMode: 'card'`，不依赖自动推断 ② **统一声明风格**：同一交互的所有选项使用相同的声明风格（都显式声明或都省略）。**排查信号**：① "UI 显示不对" + 选项包含 `defId`/`cardUid` 但不应该显示卡牌预览 = 高度怀疑缺少 `displayMode: 'button'` 声明 ② "卡牌预览不显示" + 选项应该显示卡牌但 UI 显示按钮 = 高度怀疑错误声明了 `displayMode: 'button'`。**参考文档**：`docs/bugs/smashup-robot-hoverbot-interaction-double-trigger.md`。**教训**：盘旋机器人交互选项包含 `cardUid` 和 `defId`（用于日志和调试），但业务语义是"是否打出牌库顶的随从"（按钮选择），未显式声明 `displayMode: 'button'`，导致 UI 自动推断为卡牌选择并显示卡牌预览。修复：添加 `displayMode: 'button' as const`。 |
| D47 | **E2E 测试覆盖完整性** | 测试只覆盖引擎层（GameTestRunner），未覆盖完整的命令执行流程（WebSocket 同步）？**触发条件**：编写新测试、修复"本地测试通过但实际无效"类 bug、架构重构后测试仍通过但功能破坏。**核心原则**：GameTestRunner 直接调用 `executePipeline`，绕过了传输层（WebSocket）和 UI 层的完整流程。如果 bug 发生在 pipeline 之外的层级（如 `postProcessSystemEvents` 被调用两次、UI 交互一闪而过），GameTestRunner 无法发现。**审查方法**：① **识别测试覆盖范围**：测试使用 GameTestRunner（引擎层）还是 E2E 测试（完整流程）？② **追踪 bug 发生层级**：bug 发生在 pipeline 内部（reducer/execute/validate）还是 pipeline 外部（系统钩子/UI 层/传输层）？③ **判定标准**：bug 在 pipeline 内部 + GameTestRunner 测试 → ✅ 可以发现；bug 在 pipeline 外部 + GameTestRunner 测试 → ❌ 无法发现；bug 在任何层级 + E2E 测试 → ✅ 可以发现。**典型缺陷模式**：❌ 只有 GameTestRunner 测试，未覆盖 E2E → pipeline 外部的 bug（如 `postProcessSystemEvents` 重复调用）无法发现 ❌ E2E 测试存在但未覆盖关键交互路径（如 onPlay 能力触发）→ 交互相关 bug 无法发现。**修复策略**：① **补充 E2E 测试**：对关键交互路径（onPlay/onDestroy/响应窗口/交互链）补充 E2E 测试 ② **E2E 测试优先**：新增功能时优先编写 E2E 测试，GameTestRunner 作为补充（快速验证引擎层逻辑）③ **测试金字塔**：E2E 测试覆盖关键路径（少量），GameTestRunner 覆盖边界条件和组合场景（大量）。**排查信号**：① "GameTestRunner 测试全绿但实际无效" = 高度怀疑 bug 在 pipeline 外部 ② "架构重构后测试仍通过但功能破坏" = 高度怀疑测试覆盖不完整。**参考文档**：`docs/bugs/smashup-robot-hoverbot-interaction-double-trigger.md`。**教训**：盘旋机器人 onPlay 能力的交互一闪而过，GameTestRunner 测试全绿（因为直接调用 `executePipeline`，`postProcessSystemEvents` 只被调用一次），但实际游戏中 `postProcessSystemEvents` 在 pipeline 步骤 4.5 和步骤 5 都被调用，导致交互重复创建。E2E 测试可以发现这个问题（因为经过完整的命令执行流程）。 |

### 需要展开的关键维度

**D2 边界完整 — 概念载体覆盖（强制）**：游戏描述中的一个名词在数据层可能有多种承载形式。筛选该概念时必须覆盖所有载体。**核心原则：一个游戏术语 ≠ 一种数据结构。审查时必须穷举该术语在数据层的所有承载形式。** 审查方法：① 锁定描述中的目标名词 ② 列出该名词在数据层的所有承载形式 ③ 追踪每个筛选点是否覆盖所有载体。只查了一种 = ❌。

**D1 子项：替代/防止语义合同审计（强制）**（新增/修改描述包含“防止”“改为”“而不是”“instead/prevent”语义的能力时触发）：
1. **语义类型先判定**：描述是“防止事件发生”还是“改为另一结果”。
   - “防止被消灭”= 原事件不应最终生效（如不应有 `MINION_DESTROYED` 的最终落地）。
   - “改为回手/移动”= 原事件应被替代为新事件（如 `MINION_RETURNED`/`MINION_MOVED`）。
2. **状态级断言必须覆盖**：不能只断言“发了某个事件”，必须断言最终实体状态。
   - 防止消灭：目标随从仍在场（除非描述明确另说）。
   - 替代回手：目标应离场并进入拥有者手牌。
3. **负路径必须显式恢复**：有“跳过/不发动”分支时，必须恢复原始结算路径，不能静默吞事件。
4. **防递归门禁（强制）**：恢复原始事件时必须带原因标记，并在同一拦截器中识别该标记避免再次拦截，防止交互循环。
5. **测试最低门槛（必须同时满足）**：
   - 正路径：选择“发动/防止”时的最终状态断言。
   - 负路径：选择“跳过”时恢复原结算。
   - 重入路径：验证不会重复弹出同一拦截交互。

> 典型反模式：
> - ❌ 文案写“防止被消灭”，实现却发 `MINION_RETURNED`（语义从 prevent 变成 replace）
> - ❌ 跳过分支只关闭弹窗，不恢复 `MINION_DESTROYED`
> - ❌ 恢复 `MINION_DESTROYED` 后未做 reason 门禁，导致同拦截器再次触发并循环


**D1 子项：实体筛选范围语义审计（强制）**（新增/修改任何包含实体筛选（filter/collect/遍历）的能力实现时触发）：代码中每个 `.filter()`/`.find()`/`for...of` 等实体收集操作的范围，必须与描述中的范围完全一致。**核心原则：筛选范围是语义保真的基础维度——"哪些实体"比"对实体做什么"更容易出错且更难发现，因为范围错误不会报类型错误、不会抛异常，只会静默返回错误的候选集。** 审查方法：
1. **提取描述中的范围限定词**：逐字阅读能力描述，标注所有范围限定词并归类：
   - **位置范围**："本基地"/"此基地" vs "其他基地"/"另一个基地" vs "所有基地" vs "相邻基地"
   - **归属范围**："己方"/"你的" vs "对方"/"对手的" vs "所有玩家的" vs "任意"
   - **实体类型**："随从" vs "行动卡" vs "所有卡牌" vs "ongoing 行动卡"
   - **来源范围**："手牌" vs "弃牌堆" vs "牌库" vs "场上" vs "牌库顶 N 张"
   - **排除条件**："非本基地" = 所有基地 - 本基地；"另一个基地上的" = 排除当前基地
2. **逐个追踪代码中的筛选操作**：找到实现中所有 `.filter()`/`.find()`/`.flatMap()`/`for...of` 循环，对每个操作：
   - 标注其筛选的数据源（遍历的是哪个集合？`base.minions`/`state.bases`/`player.hand`？）
   - 标注其过滤条件（`m.controller === playerId`/`b.index !== currentBaseIndex`？）
   - 与描述中的范围限定词逐一比对
3. **判定标准**：
   - 描述说"其他基地上的随从" → 代码必须遍历 `state.bases.filter(b => b.index !== thisBaseIndex)` 的随从 ❌ 只遍历 `thisBase.minions`
   - 描述说"你的随从" → 代码必须过滤 `m.controller === playerId` ❌ 遍历所有随从不过滤归属
   - 描述说"手牌中的随从" → 代码必须从 `player.hand.filter(c => c.type === 'minion')` ❌ 从 `base.minions` 取
   - 描述无范围限定（"一个随从"）→ 代码应遍历所有合法目标 ❌ 只遍历部分
4. **交叉验证**：如果能力有多个筛选步骤（如"选择其他基地上你的一个随从，移动到此基地"），每个步骤的范围都必须独立验证
5. **输出格式**：
   



**常见范围错误模式**：
- ❌ "其他基地"写成"本基地"（最常见：遍历 `thisBase.minions` 而非 `otherBases.flatMap(b => b.minions)`）
- ❌ "所有基地"写成"本基地"（遗漏其他基地的实体）
- ❌ "对手的随从"写成"己方随从"（`controller` 过滤条件取反）
- ❌ "手牌中的"写成"场上的"（数据源选错）
- ❌ "牌库顶 N 张"写成"整个牌库"（范围过大）
- ❌ 无排除条件（描述说"另一个"但代码包含了当前实体自身）


**D2 子项：打出约束审计（强制）**（新增/修改 ongoing 行动卡、或修"卡牌打出到不合法基地"时触发）：描述中含条件性打出目标的 ongoing 行动卡，必须在数据定义中声明 `playConstraint`，并在验证层和 UI 层同步检查。**核心原则：卡牌描述中的打出前置条件必须在三层（数据定义 → 验证层 → UI 层）全部体现，缺任何一层都会导致非法打出或 UI 误导。** 审查方法：
1. **识别条件性打出描述**：grep 所有 ongoing 行动卡的 i18n effectText，匹配 `打出到一个.*的基地上` 等模式（如"打出到一个你至少拥有一个随从的基地上"）
2. **检查数据定义**：匹配到的卡牌在 `ActionCardDef` 中必须有 `playConstraint` 字段（如 `'requireOwnMinion'`）
3. **检查验证层**：`commands.ts` 中 ongoing 行动卡验证逻辑必须检查 `def.playConstraint`，拒绝不满足条件的打出
4. **检查 UI 层**：`Board.tsx` 的 `deployableBaseIndices` 计算必须根据 `playConstraint` 过滤不可选基地
5. **自动化审计**：`abilityBehaviorAudit.test.ts` section 5 已添加自动检查——描述含条件性打出目标的 ongoing 卡必须有 `playConstraint` 字段


**D2 子项：额度授予约束审计（强制）**（新增/修改 `grantExtraMinion`/`grantExtraAction` 调用时触发）：卡牌描述中授予额外出牌额度时附带的约束条件（同名、指定基地、力量上限等），必须在事件 payload 中完整编码，并在验证层（commands.ts）、归约层（reduce.ts）、UI 层（Board.tsx）三层全部体现。**核心原则：`grantExtraMinion(playerId, reason, now)` 只授予了"数量"，描述中的"同名"/"指定基地"/"力量≤N"等约束如果不显式传入 payload，就会被静默丢弃——额度变成无约束的通用额度。** 审查方法：
1. **识别带约束的额度授予**：grep 所有 `grantExtraMinion`/`grantExtraAction` 调用点，交叉对比卡牌描述中的约束条件（"同名"/"到这里"/"力量≤N"等）
2. **检查 payload 完整性**：描述含"同名" → payload 必须有 `sameNameOnly: true`（可选 `sameNameDefId`）；描述含"到这里/到此基地" → 必须有 `restrictToBase`；描述含"力量≤N" → 必须有 `powerMax`
3. **检查三层消费**：
   - **reduce.ts**：`LIMIT_MODIFIED` case 是否根据 payload 写入正确的状态字段（`sameNameMinionRemaining`/`baseLimitedMinionQuota`/`baseLimitedSameNameRequired`）
   - **commands.ts**：`PLAY_MINION` 验证是否在对应额度路径上检查约束（同名 defId 匹配、基地限定同名匹配）
   - **Board.tsx**：`deployableBaseIndices` 计算是否根据约束过滤不可选基地/不可选卡牌
4. **组合约束**：`restrictToBase` + `sameNameOnly` 同时存在时（如宗教圆环），三层必须同时检查基地限定 AND 同名约束


**D4 查询一致性 — 深入审查**（新增 buff/共享机制或修"没效果"时触发）：① 识别统一查询入口并列出 ② grep 原始字段访问（含 `.tsx`），排除合法场景 ③ 判定：查询结果会因 buff/光环/临时效果改变？→ 必须走统一入口。只关心"印刷值"→ 可直接访问 ④ 输出绕过清单：文件+行号+当前代码+应改为。

**D3 子项：引擎 API 调用契约审计（强制）**（新增/修改引擎 API 调用时触发）：引擎 API 支持多种调用约定（位置参数 vs 配置对象、重载签名等），参数位置/嵌套层级错误不会报类型错误但会导致功能静默失效。**核心原则：多约定 API 是静默失效的高发区，每次调用必须确认使用的是哪种约定，并验证参数位置与该约定一致。** 审查方法：
1. **确认调用约定**：识别 API 是否有多种签名（位置参数 vs 配置对象、不同参数数量的重载）。grep 所有调用点，逐个确认使用的约定
2. **检查参数位置/嵌套**：配置对象中的子配置必须嵌套在正确的字段下，禁止平铺为顶层字段。位置参数形式中，可选参数的位置不能被其他参数占用
3. **检查选项数据完整性**：当 API 的选项/参数代表业务实体时，选项数据必须包含 UI 层渲染所需的关键字段（如实体 ID、定义 ID 等），缺失会导致 UI 退化为降级模式

**D5 子项：UI 组件单一来源检查（强制）**（新增/修改任何卡牌展示、选择、弹窗 UI 时触发）：同一类 UI 功能在每个游戏中只允许一个组件实现。**核心原则：功能重叠的 UI 组件是维护灾难——修 bug 时只改了一个，另一个继续坏。每类 UI 功能必须有唯一来源组件，所有场景复用。** 审查方法：
1. **新增 UI 前搜索**：在同游戏 `ui/` 目录下搜索是否已有功能相似的组件（卡牌展示、卡牌选择、放大查看等）
2. **禁止新建重复组件**：如果已有组件能通过扩展 props/模式覆盖新场景，必须复用，禁止新建功能重叠的组件
3. **修 bug 时同样适用**：修复 UI bug 时禁止"新建一个组件绕过问题"，必须在现有组件上修复
4. **唯一来源表**：每个游戏应在 `rule/` 或 `ui/README.md` 中维护自己的 UI 组件唯一来源表，列出每类 UI 功能对应的唯一组件


**D5 子项：自动触发技能的 UI 消费链路检查（强制）**（新增/修改 `trigger` 非 `activated`/`passive` 的技能，或修"攻击后/移动后没弹出选择"时触发）：非手动激活的触发器（`afterAttack`/`afterMove`/`onPhaseStart`/`onPhaseEnd`/`onKill` 等）由引擎层自动发射事件，如果该技能需要玩家交互（有 `interactionChain`、UI 模式、或描述含"你可以"），则 UI 事件消费层必须有对应的消费分支来自动驱动交互——**不能仅依赖按钮入口**。**核心原则：引擎层自动触发的事件，UI 层必须有对应的消费分支；否则事件被静默丢弃，功能完全失效但无报错。** 审查方法：
1. **识别自动触发+需交互的技能**：grep 所有 `trigger` 非 `activated`/`passive` 的能力定义，筛选出有 `interactionChain`、`ui.activationType` 为非 `directExecute`、或描述含"你可以"/"may"的技能
2. **追踪事件消费链路**：`execute` 层触发能力 → 发射触发事件 → UI 事件消费层（如 `useGameEvents`）的对应事件 handler → 是否有对应 `abilityId` 的分支设置 UI 交互状态
3. **判定标准**：
   - 事件消费层无对应分支 = ❌ 功能静默失效（引擎触发了但 UI 不响应）
   - 仅有按钮入口（`requiresButton: true`）但无事件消费分支 = ❌ 按钮需要手动选中单位点击，不符合自动触发语义
   - 有事件消费分支 + `requiresButton: false` = ✅ 正确（单入口，EventStream 驱动）
   - 有事件消费分支 + `requiresButton: true` = ❌ 双入口风险（撤回后 EventStream 清空，按钮仍可点击重复激活）
4. **交叉验证**：如果游戏有触发入口审计测试（如 `triggerEntryAudit.test.ts`），确认该技能 ID 在 `EVENT_STREAM_TRIGGERED_ABILITIES` 列表中


**D5 子项：交互模式语义匹配（强制）**（新增交互能力或修"选择行为不对"时触发）：描述中的选择语义必须与 `createSimpleChoice` 的 `multi` 配置匹配。审查方法：
1. **语义→配置映射表**：
   - "选择任意数量" / "any number" / "你可以选择" → `multi: { min: 0, max: N }`
   - "选择一个" / "choose one" → 不传 `multi`（单选模式）
   - "选择恰好 N 个" / "choose exactly N" → `multi: { min: N, max: N }`
   - "选择最多 N 个" / "up to N" → `multi: { min: 0, max: N }` 或 `multi: { min: 1, max: N }`（视是否可跳过）
2. **grep 审查**：搜索所有 `createSimpleChoice` 调用，对照能力描述确认 `multi` 配置与语义一致
3. **UI 模式验证**：`multi` 存在 → UI 应显示多选复选框 + 全选 + 确认按钮；`multi` 不存在 → UI 应显示单选按钮/卡牌点击即确认
**D5 子项：单候选自动执行掩蔽审计（强制）**（使用 `resolveOrPrompt` 或同类“单候选自动执行” helper 时触发）：
`resolveOrPrompt` 默认 `autoResolveIfSingle = true`，会在候选数为 1 时跳过交互直接执行。若测试场景只构造 1 个候选，容易误判“交互链完整”。

审查方法：
1. **识别受影响能力**：grep `resolveOrPrompt(` 调用点，确认该能力是否“语义上需要玩家先选择”。
2. **双用例强制**：
   - **多候选用例（必需）**：至少构造 2 个合法候选，断言第一步交互 `sourceId` 出现；
   - **单候选用例（可选）**：若设计上允许自动执行，再补一个单候选直执用例。
3. **禁止以“链路有后续 sourceId”代替第一步验证**：必须显式断言首步是否出现（或按设计自动跳过）。


**D5 子项：实现模式与描述语义匹配——额度授予 vs 交互选择（强制）**（新增能力实现、或修"弹窗不该出现"/"基地全灰"/"操作被交互阻断"时触发）：描述语义是"授予资源/额度/权限"时，实现必须用额度模式（修改状态，让玩家在正常流程中自行消费），禁止用交互模式（弹窗让玩家立即选择并消费）。**核心原则：额度授予 ≠ 立即消费。"你可以打出一张额外随从"的正确语义是"+1 额度"，不是"现在选一张打出"。交互弹窗会劫持正常操作流程，导致 UI 状态冲突（如 `selectedCardUid` 被清除、基地选择从 `deployableBaseIndices` 切换到 `selectableBaseIndices`）。** 审查方法：
1. **语义→实现模式映射表**：
   - "你可以打出 N 张额外随从/行动卡" → 额度模式：`grantExtraMinion`/`grantExtraAction` 修改 `minionLimit`/`actionLimit`，玩家在正常出牌流程中使用
   - "你可以打出一张力量≤N 的额外随从" → 额度模式 + 约束：`grantExtraMinion(playerId, reason, now, undefined, { powerMax: N })`
   - "选择一个随从消灭/移动/返回手牌" → 交互模式：`createSimpleChoice` 让玩家选择目标
   - "从牌库/弃牌堆中检索一张卡到手牌" → 交互模式：需要玩家从非手牌来源选择
   - "从弃牌堆打出一个随从" → **两步交互模式**：步骤1选随从 + 步骤2选基地 → 生成 `MINION_PLAYED(fromDiscard: true)` 事件。参照 `zombie_lord`、`vampire_crack_of_dusk` 的实现。❌ 禁止用「回收到手牌 + 给额度」模式（`CARD_RECOVERED_FROM_DISCARD` + `grantExtraMinion`），这会导致选完随从后没有基地选择引导，UX 断裂
   - "弃掉 N 张手牌" → 交互模式：需要玩家选择弃哪些
2. **判定标准**：
   - 描述的效果是"增加可用次数/权限" + 消费发生在正常操作流程中 → 必须用额度模式 ❌ 禁止用交互弹窗
   - 描述的效果需要"从特定来源选择目标"（牌库/弃牌堆/场上单位）→ 必须用交互模式
   - 描述的效果是"额外打出"但来源是弃牌堆/牌库（非手牌）→ 交互模式正确（需要先选卡再选基地）
3. **副作用检查**：交互弹窗（`createSimpleChoice`）会触发 `currentPrompt` 变化 → `useEffect` 清除 `selectedCardUid`/`selectedCardMode` → 基地渲染从 `deployableBaseIndices`（正常流程）切换到 `selectableBaseIndices`（交互驱动）→ 如果交互选项中没有基地选项，所有基地变灰
4. **grep 审查**：搜索所有 `grantExtraMinion`/`grantExtraAction` 调用点和 `createSimpleChoice` 调用点，交叉对比能力描述，确认模式选择正确

**典型缺陷模式**：

**D5 子项：棋盘直选模式下非目标选项可达性（强制·通用）**（新增 `targetType` 声明、或修"操作按钮不显示"/"卡住"时触发）：适用于**所有游戏**中将交互路由到棋盘/场地直选模式的场景。当 Board 层根据交互元数据（如 `targetType`/选项结构）判定走直选模式时，通用弹窗（PromptOverlay 等）被隐藏，选项集中的**非目标选项**（done/skip/cancel/__cancel__/confirm 等）必须有替代 UI 可达路径（浮动按钮/操作栏）。

**核心原则**：直选模式下，"目标选项"通过棋盘实体点击可达，"操作选项"必须通过浮动按钮可达。过滤逻辑必须使用**排除法**（排除目标选项的特征字段），不硬编码操作选项的字段名，确保新增操作选项类型自动可达。

**审查方法**：
1. **选项分类**：grep 交互的 `options` 构建代码，将选项分为"目标选项"（含目标实体标识字段，如单位ID/格子坐标/卡牌ID）和"操作选项"（done/skip/cancel 等无目标实体标识的选项）
2. **UI 路由验证**：确认直选模式激活时通用弹窗被隐藏 → 操作选项必须被 `xxxExtraOptions` 类逻辑捕获并渲染为替代 UI
3. **过滤逻辑审查**：`xxxExtraOptions` 必须用排除法（"无目标字段 → 操作选项"），禁止用白名单法（"skip === true → 操作选项"），后者会遗漏新增的操作选项类型
4. **跨选择类型一致性**：同一 Board 中所有直选模式（单位选择/基地选择/卡牌选择/格子选择等）的 `xxxExtraOptions` 过滤逻辑必须统一采用排除法

**典型缺陷**：交互声明走直选模式，选项含 `{ done: true }` 的"完成选择"按钮，但浮动按钮过滤逻辑只匹配 `skip === true`，导致 `done` 按钮在直选模式下不可见，玩家无法结束操作 → 游戏卡死

**D5 子项：同类型卡牌交互一致性（强制）**（新增交互能力、或修"同类型卡表现不一致"时触发）：功能描述模式相同的卡牌（如"选随从 → 逐张选手牌 → 每张获得效果"），必须使用相同的 `targetType`、选项结构、停止按钮命名和 handler 模式。**跨派系也必须对齐。**

审查方法：
1. **识别同类卡**：新增交互能力时，grep 已有卡牌的描述文本，找到模式相同的卡牌（如"任意数量的手牌/随从卡 → 每张+1指示物"）。
2. **参照实现**：以已有正确实现为基准，新卡的 `targetType`、选项构建函数结构（过滤条件、停止按钮 value key）、handler 判断逻辑必须与基准一致。
3. **一致性清单**：
   - `targetType` 相同（如手牌选择统一用 `'hand'`，不能一个用 `'hand'` 另一个用 `'generic'`）
   - 停止/完成按钮的 `value` key 统一（如统一用 `{ stop: true }` 或 `{ done: true }`，不能混用）
   - `displayMode` 声明方式统一（`'button' as const`，不能用 `as any` 强转）
   - `autoResolveIfSingle` 配置统一


**D15 子项：状态→UI 可见性链路审计（强制）**（修“逻辑生效但界面没显示”时触发）：
对于力量指示物/标记类效果，必须验证“事件产生 → reducer 写入 → UI 渲染条件命中”三段链路完整。

审查方法：
1. **事件层**：断言产生了目标事件（如 `POWER_COUNTER_ADDED`）。
2. **状态层**：断言 reducer 写入了目标字段（如 `minion.powerModifier` 递增）。
3. **UI 层**：检查渲染条件是否直接读取该字段（如 `powerModifier > 0` 显示徽章/标记），避免读错字段或漏读。


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
**审查输出格式**：






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

**D11 Reducer 消耗路径（强制）**（新增/修改额度授予、资源写入、或修"额度/资源消耗不对"时触发）：能力/事件写入的资源/额度/状态，在 reducer 消耗时走的分支是否正确。**核心原则：写入正确 ≠ 消耗正确。审计必须追踪到 reducer 中消耗该资源的具体分支逻辑，验证条件判断和优先级。** 审查方法：
1. **追踪写入点**：能力/事件将资源写入哪个字段（如 `baseLimitedMinionQuota`、`minionLimit`、`charges`）
2. **追踪消耗点**：grep 该字段在 reducer 中的所有读取位置，找到消耗分支
3. **验证分支条件**：消耗分支的 if/else if/else 条件是否正确？多种额度来源并存时，哪个分支先命中？先命中的分支是否是正确的消耗来源？
4. **构造测试场景**：至少覆盖——① 只有该额度来源时消耗正确 ② 该额度来源与其他来源并存时消耗优先级正确 ③ 该额度消耗后不影响其他来源的剩余量

**D12 写入-消耗对称（强制）**（新增事件类型、修改 reducer、或修"写入了但没生效"时触发）：能力/事件写入的字段，在所有消费点是否被正确读取和消耗。**核心原则：写入路径和消耗路径必须是镜像对称的——写入时用什么条件/字段名/数据结构，消耗时必须用相同的条件/字段名/数据结构。** 审查方法：
1. **列出写入链**：事件 payload → reducer case → 写入的字段名和数据结构
2. **列出消耗链**：所有读取该字段的位置（reducer 其他 case、validate、UI 组件），每个位置的读取方式和条件
3. **对称性检查**：写入时的 key 类型（string/number）与读取时是否一致？写入时的嵌套层级与读取时是否一致？写入时的条件分支与消耗时的条件分支是否覆盖相同的场景空间？

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
**排查信号**：

**D13 多来源竞争（强制）**（同一资源/额度/状态有多个写入来源时触发）：多个能力/事件可以写入同一个资源字段时，消耗逻辑是否正确区分来源。**核心原则：当多个来源向同一个资源池写入时，消耗逻辑必须明确"消耗的是哪个来源的贡献"，不能混淆。** 审查方法：
1. **识别多来源字段**：grep 所有写入同一字段的事件/能力（如多个能力都写入 `minionLimit`）
2. **区分来源类型**：全局额度 vs 基地限定额度 vs 条件限定额度（如力量≤2）
3. **验证消耗隔离**：消耗来源 A 的额度时，是否不影响来源 B 的额度？来源 A 用完后是否正确 fallback 到来源 B？
4. **验证叠加规则**：多个来源同时生效时，是叠加（+1+1=2）还是取最大/最小？实现是否与规则一致？

**D14 回合清理完整（强制）**（新增临时状态字段、或修"上回合的效果残留到下回合"时触发）：回合/阶段结束时所有临时状态是否全部正确清理。**核心原则：每个写入临时状态的字段，都必须有对应的清理逻辑，且清理时机正确。** 审查方法：
1. **列出所有临时字段**：grep 回合开始时重置的字段（如 `minionsPlayed=0`、`actionsPlayed=0`），以及回合结束时清理的字段（如 `baseLimitedMinionQuota=undefined`、`extraMinionPowerMax=undefined`）
2. **逐字段验证**：每个在回合中被写入的临时字段，在回合结束/开始时是否有对应的清理/重置
3. **清理时机**：清理发生在 `TURN_STARTED` 还是 `TURN_ENDED`？如果有跨回合效果（如"下回合开始时"），清理时机是否正确避开？
4. **新增字段必查**：新增任何临时状态字段时，必须同时在回合清理逻辑中添加对应的清理代码
**D15 UI 状态同步（强制）**（修"UI 显示不对"或新增 UI 展示时触发）：UI 展示的数值/状态是否与 core 状态一致。**核心原则：UI 必须读取 reducer 实际写入的字段，不能读取"看起来相关但实际不同"的字段。** 审查方法：
1. **追踪 UI 数据源**：UI 组件展示某个数值时，追踪到它读取的是 core 的哪个字段
2. **对比 reducer 写入**：reducer 实际写入的字段是否就是 UI 读取的字段？是否存在"UI 读 fieldA 但 reducer 写 fieldB"的不一致？
3. **多来源聚合**：如果一个 UI 数值需要聚合多个来源（如"剩余随从额度 = minionLimit - minionsPlayed + baseLimitedMinionQuota"），UI 是否正确聚合了所有来源？
4. **状态变更后刷新**：reducer 更新字段后，UI 是否能及时感知变更并重新渲染？
**D16 条件优先级（强制）**（修改 reducer/validate 中的多分支逻辑时触发）：多个条件分支的优先级是否正确。**核心原则：if/else if/else 链中，先命中的分支会短路后续分支。必须确认先命中的分支确实应该先命中。** 审查方法：
1. **列出分支链**：将 if/else if/else 链中每个分支的条件和效果列成表
2. **构造边界场景**：找到两个分支条件都可能为 true 的场景，确认先命中的分支是正确的
3. **特别关注"兜底分支"**：else 分支是否会意外捕获不应该走到这里的场景？
**D17 隐式依赖（强制）**（重构事件处理顺序、修改管线流程时触发）：功能是否依赖特定的调用顺序或状态前置条件但未显式检查。**核心原则：如果功能 B 依赖功能 A 先执行的结果，这个依赖必须是显式的（通过参数传递或状态检查），不能依赖"恰好 A 在 B 之前执行"的隐式顺序。** 审查方法：
1. **识别顺序依赖**：功能 B 读取的状态是否由功能 A 在同一管线中写入？如果 A 和 B 的执行顺序交换，功能是否会破坏？
2. **识别状态前置条件**：函数入口是否假设某个状态已经被设置（如"此时 minionLimit 已经被 onTurnStart 增加过"），但没有显式检查？
3. **防御性编程**：关键的顺序依赖应该通过断言或条件检查来保护，而不是依赖调用顺序
**D18 否定路径（强制）**（全面审查、新增额度/资源机制时触发）：测试是否覆盖了"不应该发生"的场景。**核心原则：正向测试（功能生效）和否定测试（功能不应影响其他东西）同等重要。** 审查方法：
1. **额度隔离测试**：额外额度消耗后，正常额度是否不受影响？正常额度消耗后，额外额度是否不受影响？
2. **基地隔离测试**：基地限定额度是否只在指定基地生效？在其他基地打随从是否不消耗该额度？
3. **玩家隔离测试**：玩家 A 的额度变化是否不影响玩家 B？
4. **回合隔离测试**：本回合的临时效果是否不泄漏到下回合？
5. **构造否定断言**：对每个写入操作，构造"写入后，不相关的字段应该不变"的断言


**D19 组合场景（强制）**（全面审查、新增与已有机制交叉的能力时触发）：两个独立正确的机制组合使用时是否仍然正确。**核心原则：单独测试通过不代表组合测试通过。两个机制共享同一资源/状态时，必须测试组合场景。** 审查方法：
1. **识别共享资源**：两个机制是否读写同一个字段？（如母星和花园都影响随从额度）
2. **构造组合场景**：两个机制同时生效时，先触发 A 再触发 B、先触发 B 再触发 A，结果是否都正确？
3. **构造交替消耗场景**：先消耗 A 的额度再消耗 B 的额度，反过来呢？
4. **边界组合**：一个机制的边界值（如额度=0）与另一个机制的正常值组合时是否正确？


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

**D15 子项：UI 交互门控与 validate 对齐（强制）**（在 validate 层新增/修改合法路径后强制触发，或修"引擎测试通过但实际操作无效"时触发）：UI 层的交互前置过滤（可点击判断、禁用集合、模式切换条件、可选目标集合）是否与 validate 层的合法路径完全对齐。**核心原则：UI 层和 validate 层是两套独立维护的门控，改了 validate 不等于 UI 也放行。引擎层测试（GameTestRunner / executePipeline）直接 dispatch 命令绕过 UI，测试全绿不代表用户能操作。** 审查方法：
1. **识别 validate 变更**：本次修改在 validate 中新增/放宽了哪些合法路径？（如新增了"Me First! 窗口中允许 PLAY_MINION"）
2. **追踪 UI 入口**：用户要触达该路径，需要经过哪些 UI 交互步骤？（如点击手牌 → 选择基地 → dispatch 命令）
3. **逐层检查 UI 门控**：沿用户操作链路，检查每一步是否有独立的前置过滤阻止用户触达新路径：
   - **点击回调门控**：`handleCardClick`/`handleBaseClick` 等回调中是否有 `card.type`/`phase`/模式判断提前 return？
   - **禁用集合**：`disabledUids`/`meFirstDisabledUids` 等集合是否把新增的合法卡牌/目标标记为禁用（置灰）？
   - **可选目标集合**：`deployableBaseIndices`/`selectableBaseIndices` 等集合的计算逻辑是否覆盖了新增的合法场景？
   - **模式切换条件**：进入部署模式/选择模式的条件是否排除了新增的合法操作？
4. **构造端到端操作链**：模拟用户从"看到 UI" → "点击" → "选择目标" → "命令 dispatch"的完整链路，确认每一步都不被 UI 门控拦截

**典型缺陷模式**：

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
**审查输出格式**：






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
**修复策略**：
1. **最小侵入（推荐）**：在底层函数中添加特殊模式检测（如 `isHealingMode`、`hasRallyingCry`），允许特殊语义绕过硬编码约束
2. **参数化扩展**：将硬编码约束改为可选参数（如 `canAttackEnhanced(state, attacker, target, { allowFriendly?: boolean, ignorePhase?: boolean })`）
3. **状态标记**：在 core 状态中添加特殊模式标记（如 `core.specialAttackMode = { allowFriendly: true }`），底层函数读取状态决定行为
4. **拆分函数**：将通用验证函数拆分为多个专用函数（如 `canAttackEnhanced` vs `canTargetForAction`），不同场景调用不同函数

**审查输出格式**：






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
**排查信号**：

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
| 修"点了没反应" | D5,D3,D10,D15 | D8,D21,D23 |
| 修"激活了但没效果" | D7,D2,D3 | D1,D10,D11,D23 |
| 修"确认后验证失败" | D8,D7,D3 | D2,D5,D23 |
| 修"技能可以无限重复使用" | D21,D7,D8 | D1,D2 |
| 修"首次触发能力从不生效" | D8,D1,D3 | D14,D21 |
| 修"首次触发能力每次都触发" | D8,D1,D21 | D3,D14 |
| 新增"每回合首次"类能力 | D8,D1,D14 | D3,D21 |
| 修"伤害加成/减免不生效" | D22,D1,D3 | D4,D10 |
| 修"锁定/护甲没效果" | D22,D4,D3 | D1,D10 |
| 修"特殊语义无法实现" | D23,D1,D2 | D5,D8 |
| 修"绕过逻辑分散" | D23,D3,D5 | D1,D8 |
| 新增阶段结束技能 | D8,D5,D7,D1,D21 | D2,D3,D23 |
| 修"阶段结束技能无效触发" | D8,D7,D2,D21 | D5,D3,D23 |
| 修"交互一闪而过" | D45,D46,D47 | D8,D9,D40 |
| 修"重复触发" | D45,D40,D41,D42 | D8,D9,D43 |
| 修"UI 显示不对" | D46,D15,D5 | D3,D34 |
| 架构重构后测试失败 | D44,D47,D43 | D41,D42 |
| 新增 pipeline 流程 | D45,D40,D41 | D8,D9,D42 |
| 新增系统钩子 | D45,D41,D42 | D8,D40,D43 |
| 新增 UI 展示 | D5,D3,D15 | D1,D20 |
| 新增基于位置计算的 UI 交互 | D15,D5,D1 | D2,D3 |
| 修"UI 计算结果不符合描述" | D15,D1,D5 | D2,D3 |
| 全面审查 | D1-D39 | — |
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
| 修"弹窗不该出现"/"基地全灰"/"操作被交互阻断" | D5,D1,D3 | D8,D15 |
| validate 新增/放宽合法路径 | D15,D5,D2 | D3,D23 |
| 修"引擎测试通过但实际操作无效" | D15,D5,D3 | D8,D23 |
| 新增额外出牌/额度授予能力 | D5,D7,D11,D12 | D2,D13,D18 |
| 新增/修改"注册+过滤"拦截机制 | D31,D3,D8 | D17,D6 |
| 修"保护在某些场景下不生效" | D31,D3,D1 | D8,D17 |
| 新增事件产生路径 | D31,D8,D3 | D17,D6 |
| 新增/修改绕过正常流程的替代路径 | D32,D8,D17 | D31,D3 |
| 修"替代路径下交互/动画不触发" | D32,D8,D5 | D17,D3 |
| 新增/修改包含实体筛选的能力 | D1,D2,D3 | D5,D8,D12 |
| 修"筛选结果为空/候选列表缺失" | D1,D2,D5 | D3,D12,D24 |
| 修"操作后卡住/无法继续" | D39,D8,D3 | D5,D17 |
| 修"交互完成后仍然 halt" | D39,D8,D5 | D3,D17 |
| 新增/修改流程控制标志 | D39,D8,D17 | D3,D5 |

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

> 审查时用 D1-D47 维度，此表仅供类似场景参考。

**核心教训**：
- 语义保真（D1）：实现必须忠实于权威描述，禁止添加/删除/修改描述中不存在的限定条件
- 边界完整（D2）：所有限定条件必须全程约束，不得只在入口检查
- 数据流闭环（D3）：定义→注册→执行→状态→验证→UI→i18n→测试 必须闭环
- 查询一致性（D4）：可被 buff/光环动态修改的属性必须走统一查询入口
- 交互完整（D5）：玩家决策点都有对应 UI，交互模式与描述语义匹配
- 时序正确（D8）：写入时机必须在消费窗口内，阶段结束交互必须 halt 推进
- Reducer 消耗路径（D11）：多来源并存时消耗优先级必须正确
- 写入-消耗对称（D12）：写入路径和消费路径的条件分支必须对称
- 回合清理完整（D14）：临时状态必须在回合/阶段结束时正确清理
- UI 状态同步（D15）：UI 读取的字段必须与 reducer 写入的字段一致

详细案例见 git history 和 docs/bugs/ 目录。
