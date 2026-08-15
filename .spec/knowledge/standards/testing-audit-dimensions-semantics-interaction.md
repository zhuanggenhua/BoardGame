---
name: testing-audit-dimensions-semantics-interaction
description: 语义交互审计维度：动作语义、选择对象和按钮语义——审计交互语义时查
metadata:
  type: doc
  status: 已交付
---

# 测试审计 D 维度细则：语义与交互

本文档承载语义保真、边界完整、数据流闭环、查询一致性、交互完整和副作用传播细则；正文可引用其他 D 编号作为交叉门禁。

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

**D1 子项：响应窗口可选打出文案审计（强制）**（新增/修改 Smash Up 响应窗口 special 行动牌文案，或修“可在计分前打出”类反馈时触发）：
1. **先核对权威口径**：若英文/规则书原文是 `Special: Play before a base scores.` 这类“可在该时机打出此牌”的句式，中文必须明确保留“可选打出此牌”语义。
2. **中文文案必须同时表达三个要素**：`特殊`、`你可以`、`打出此牌/该卡牌`。缺任一项都算语义降级。
3. **禁止命令句误译**：禁止把这类文案写成 `特殊：在一个基地计分前打出。`。这会把“可选响应窗口入口”误写成“必须执行的命令句”。
4. **禁止吞掉“打出此牌”语义**：也不能只写成 `特殊：在一个基地计分前，...` 然后直接接效果，导致“这是从手牌可选打出”这一层信息丢失。
5. **基础版 / POD 必须一起审**：同名卡若同时存在基础版与 POD 版，必须分别核对，禁止只修其中一个版本。


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

**D1 子项：合法性 / 奖励 / 惩罚拆分审计（强制）**（规则文本同时出现“可做某动作”和“对某类目标才奖励/才免罚/才触发”时触发）：合法动作集合、奖励条件、惩罚豁免条件和后续能力触发条件必须分别建断言。**核心原则：奖励/惩罚条件不是合法性条件。** 审查方法：
1. **先拆四类口径**：① 动作是否合法；② 做完是否获得奖励；③ 是否免除惩罚；④ 是否满足“攻击后/消灭后/造成伤害后”等后续触发条件。
2. **禁止反向推导**：规则写“攻击敌方卡牌后获得魔力 / 未指定敌方卡牌会受罚 / 攻击敌方卡牌后触发能力”，不能推出“攻击友方卡牌非法”。
3. **测试必须分正反路径**：至少覆盖“动作合法但不计奖励/不免罚/不触发后续能力”和“动作合法且满足奖励/免罚/触发条件”两条路径。
4. **实现审计点**：通用合法性 helper 不得硬编码奖励或惩罚口径；奖励、惩罚和触发系统应消费目标归属、目标类型、是否敌方等独立快照字段。


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

**D3 子项：静态定义与旁路消费一致性审计（强制）**（能力/卡牌/状态定义 `effects: []`，但当前对象已有运行时行为、旧 evidence 声称 passed，或用户质疑“未实现/审计维度不足”时触发）：空效果只表示声明层没有内联效果，不是实现状态结论。审计必须把空效果能力分成三类，并写入 evidence 或机器守卫：
1. **已实现旁路消费**：运行时由 helper、execute、abilityResolver、systems、flowHooks、UI adapter 或专用 mechanics 消费。必须写清消费者、最终权威状态、测试/evidence 入口。
2. **有意静态/被动**：能力本身只改变分类、标签、召唤位置、查询结果或规则身份，不产生独立事件。必须写清真实消费者和负向路径。
3. **真实占位/未接入**：未找到运行时消费者或证据不足。必须登记为残余或 blocked，不能因为定义存在就判通过。

审查方法：
1. **先列全集**：按当前范围的配置真相源列出所有能力定义，筛选 `effects.length === 0` 的对象。
2. **反查消费者**：逐项搜索 ability id 在 helper、execute、abilityResolver、systems、flowHooks、UI adapter、AI legal-actions、测试和 evidence 中的消费点。
3. **禁止二元误判**：不得把 `effects: []` 直接写成“未实现”；也不得因为测试曾 passed 就忽略声明层无法独立解释行为的结构问题。
4. **结构 finding**：若同一批次里同类能力有的走 `effects/custom action`，有的走旁路特判，必须按 D33 标注合理差异或结构 finding。
5. **机器守卫**：如果范围内空效果能力可以枚举，必须补测试或脚本要求每个空效果能力都有分类、消费者和 evidence 入口。

典型缺陷模式：
- ❌ 审计报告写“`effects: []` 说明未接执行器”，但旧 intake / 行为测试已经证明 helper 或 execute 正在消费该能力。
- ❌ 只在文件头写“未接执行器保留空效果”，实际有一半能力已旁路实现，导致后续补审把已实现链路误报为残余。
- ❌ 已实现旁路能力没有证据映射，新能力加入同一批次后无人知道应该在哪个消费者补测试。

**D5 子项：UI 组件单一来源检查（强制）**（新增/修改任何卡牌展示、选择、弹窗 UI 时触发）：同一类 UI 功能在每个游戏中只允许一个组件实现。**核心原则：功能重叠的 UI 组件是维护灾难——修 bug 时只改了一个，另一个继续坏。每类 UI 功能必须有唯一来源组件，所有场景复用。** 审查方法：
1. **新增 UI 前搜索**：在同游戏 `ui/` 目录下搜索是否已有功能相似的组件（卡牌展示、卡牌选择、放大查看等）
2. **禁止新建重复组件**：如果已有组件能通过扩展 props/模式覆盖新场景，必须复用，禁止新建功能重叠的组件
3. **修 bug 时同样适用**：修复 UI bug 时禁止"新建一个组件绕过问题"，必须在现有组件上修复
4. **唯一来源表**：每个游戏应在 `rule/` 或 `ui/README.md` 中维护自己的 UI 组件唯一来源表，列出每类 UI 功能对应的唯一组件

**D5 子项：场景对象直选优先审计（强制）**（新增/修改房间、基地、棋盘格、卡牌、角色、物品、目标单位等对象选择 UI，或修“按钮太多/不好点/退化成交互列表/不该圆圈高亮”反馈时触发）：玩家要选的目标如果已经在当前主视图里以真实对象出现，并且对象身份可稳定映射，正式主路径必须点击对象本体或贴合对象轮廓的高亮层。文字按钮、列表、编号、圆点和旁路标签只能作为备用、无障碍入口、筛选辅助或确认/取消控件，不能替代对象本体主路径。审查方法：
1. **先列真实对象**：逐项列出候选目标在主视图中是否可见、是否有稳定 ID、是否能命中本体点击区域；可见且身份稳定时，必须优先做本体点击。
2. **同源高亮与校验**：本体高亮、点击 handler、可选目标集合、最终命令 payload 必须来自同一批合法目标；禁止列表可点但对象不高亮，或对象高亮但点击走另一套过滤。
3. **角色/玩家 token 也是对象本体（强制）**：玩家、角色、怪物、随从、基地、房间、物品卡、手牌、地图 token 只要已经在主视图可见，就必须优先点该对象本体。队友列表、顶部提示、底部行动条、文字标签、编号目标、头像清单只能定位、说明或作为无障碍辅助；不得继续发正式目标命令。
4. **旁路按钮降级**：保留按钮/列表时必须能说明它只是备用、定位、筛选或细分控制；E2E 主路径不得继续只点击旁路按钮来证明交互可用。若旁路仍能直接完成“攻击/选择目标/移动到对象/选中物品”等目标命令，默认视为退化，必须改回对象本体承接。
5. **形状语义一致**：非骰子对象不得使用圆形选中/可选高亮；房间/基地贴合地图块或卡牌边框，卡牌贴合卡面，角色/玩家 token 贴合头像/立绘/token 轮廓，物品贴合物品牌。选中态要用贴合本体的描边/发光，不得用独立圆点、圆圈或遮挡文字替代。
6. **同类交互必须统一样式**：同一业务语义的目标选择（攻击目标、交易目标、物品目标、房间目标、鉴定目标）不得在不同位置混用不同风格；新增/修改一处时必须主动搜索同类入口，统一承接对象、选中高亮和验证断言。
7. **无法直选要写阻塞**：只有对象不可见、当前视口无该对象、身份映射不稳定、组合选择需要先指定“给谁选目标”等情况，才允许暂不本体直选；审计结论必须写明阻塞原因和备用入口。
8. **最低输出**：审计结论至少包含 `真实对象是否在场 -> 本体点击入口 -> 贴合高亮 -> 备用按钮角色 -> E2E 主点击对象 -> 同类入口是否已搜索` 六项；缺任一项不得宣称直选优先已达标。


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

**D5 子项：可选主效果与可选子动作拆分（强制）**（新增/修改描述含“你可以发动/如果你这样做/然后必须/可以先/可不移动/可不推拉”等嵌套可选语义，或修“必须点某个子动作才会结算”时触发）：
1. **先拆语义层级**：把“是否发动整个效果”和“发动后某个步骤是否执行”分成两个独立判断。`跳过整个效果` 不等于 `不执行子动作但继续主效果`。
2. **选项必须可达**：如果规则允许“发动主效果但不执行子动作”（例如不推拉、不移动、不选择额外目标），系统交互选项和 UI 横幅/按钮必须显式暴露该入口，不能只暴露 `skip/cancel`。
3. **主效果后续必须落地**：选择“不执行子动作但继续主效果”后，后续必选结算仍必须发生，例如充能、扣资源、造成伤害、抽牌或状态写入。
4. **按钮文案必须区分**：UI 文案应区分“不推拉/不移动/不选额外目标”和“跳过/取消整个效果”，避免把子动作跳过误导成主效果跳过。
5. **最低测试门槛**：至少覆盖三类路径：① 跳过整个效果不改变状态；② 不执行子动作但继续主效果，最终权威状态改变；③ UI/adapter 层能拿到并提交该子动作跳过选项。

**D5 子项：单候选自动执行掩蔽审计（强制）**（使用 `resolveOrPrompt`、`autoResolveIfSingle`、`candidates[0]` 回退或同类“单候选自动执行”路径时触发）：
`resolveOrPrompt` 默认 `autoResolveIfSingle = true`，`createSimpleChoice(..., { autoResolveIfSingle: true })` 或 handler 里直接取第一项，也会在候选数为 1 时跳过交互直接执行。若测试场景只构造 1 个候选，容易误判“交互链完整”。

核心口径：只要现实语义是玩家选择卡牌、基地、随从、角色、目标、支付对象、来源、目的地、顺序、数量或是否执行，单候选也必须保留交互；自动收口只允许用于已经没有玩家选择、没有可见对象、没有放弃/跳过语义的固定机械结果。

审查方法：
1. **识别受影响能力**：grep `resolveOrPrompt(`、`autoResolveIfSingle`、`.find(`、`candidates[0]`、`options[0]`、`available[0]` 等单候选直执模式，确认该能力是否“语义上需要玩家先选择”。
2. **单候选也要测交互**：若语义需要玩家选择，必须构造 1 个合法候选并断言第一步交互 `sourceId` 出现；可选效果还必须断言跳过/不做分支可达。
3. **多候选仍要测选择正确性**：至少构造 2 个合法候选，断言玩家选中的候选被结算，而不是默认第一项被结算。
4. **固定结果才允许自动收口**：若设计上允许自动执行，审计必须写清为什么这一步已经不是玩家选择，并补断言证明不存在可见目标、支付对象、顺序、数量和放弃/跳过语义。
5. **禁止以“链路有后续 sourceId”代替第一步验证**：必须显式断言首步是否出现（或按第 4 条证明该首步不应存在）。


**D5 子项：实现模式与描述语义匹配——额度授予 vs 交互选择（强制）**（新增能力实现、或修"弹窗不该出现"/"基地全灰"/"操作被交互阻断"时触发）：描述语义是"授予资源/额度/权限"时，实现必须用额度模式（修改状态，让玩家在正常流程中自行消费），禁止用交互模式（弹窗让玩家立即选择并消费）。**核心原则：额度授予 ≠ 立即消费。"你可以打出一张额外随从"的正确语义是"+1 额度"，不是"现在选一张打出"。交互弹窗会劫持正常操作流程，导致 UI 状态冲突（如 `selectedCardUid` 被清除、基地选择从 `deployableBaseIndices` 切换到 `selectableBaseIndices`）。** 审查方法：
1. **语义→实现模式映射表**：
   - "你可以打出 N 张额外随从/行动卡" → 额度模式：`grantExtraMinion`/`grantExtraAction` 修改 `minionLimit`/`actionLimit`，玩家在正常出牌流程中使用
   - "你可以打出一张力量≤N 的额外随从" → 额度模式 + 约束：`grantExtraMinion(playerId, reason, now, undefined, { powerMax: N })`
   - "返回/回手一张牌（或随从）后，将它再次打出 / play it again / play the returned card" → **returned-card 额度模式**：默认应锁 `specificCardUid`（必要时再带 `sameNameDefId`），但**除非文本显式写了 `here/on that base/到原处/在该基地`，否则不得把原 `baseIndex` 当成隐式限制继续传下去**；基地/位置选择仍按普通合法目标重新生成
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


**D6 子项：副作用死亡后的连锁传播（强制）**（新增/修改自伤、代价伤害、牺牲、推拉后伤害、替换、消灭或死亡后被动时触发）：
1. **副作用也是正式事件**：由能力副作用造成的伤害、消灭、替换、离场，必须进入与普通伤害/消灭相同的死亡后处理和被动触发链；不得因为它来自“代价/自伤/副作用”就跳过后续机制。
2. **最终棋盘优先**：测试不能只断言产生了 `伤害/消灭/充能` 事件，还必须断言最终场上单位、区域、充能、伤害和后续被动结果，尤其要确认已死亡对象不再继续获得后续增益。
3. **后处理读最新状态**：死亡后处理、范围扫描和后续被动必须基于移动/推拉/伤害/死亡事件归约后的最新状态；禁止继续用批次入口旧棋盘扫描目标。
4. **正反路径都要测**：至少覆盖“副作用未致死时只落主效果”和“副作用致死时触发后续被动并排除死亡对象”两条路径。
5. **关联维度**：同时按 D8（结算时序）、D12（写入-消耗对称）、D18（否定路径）、D40（批内副作用串行状态推进）、D55（共享合同多消费者一致性）记录命中。

**D15 子项：状态→UI 可见性链路审计（强制）**（修“逻辑生效但界面没显示”时触发）：
对于力量指示物/标记类效果，必须验证“事件产生 → reducer 写入 → UI 渲染条件命中”三段链路完整。

审查方法：
1. **事件层**：断言产生了目标事件（如 `POWER_COUNTER_ADDED`）。
2. **状态层**：断言 reducer 写入了目标字段（如 `minion.powerModifier` 递增）。
3. **UI 层**：检查渲染条件是否直接读取该字段（如 `powerModifier > 0` 显示徽章/标记），避免读错字段或漏读。


**D9 幂等与重入 — 深入审计**（新增/修改创建交互并 halt 的函数、或修"交互解决后能力重复触发"时触发）：

**D9.1 后处理循环事件去重**（原有内容）：后处理循环中判定"新事件"时，去重集合必须从**输入事件**构建，而非从**输出事件**构建。若同一批输入事件会在循环内继续读写共享状态，还要额外检查**批内串行状态推进**：后一个事件必须读取前一个事件副作用已落地后的最新状态，而不是批次入口旧状态。详见 D40。

**D9.2 交互解决后函数重入防重复（强制·通用）**：当函数创建交互并 halt 流程时，交互解决后函数会被重入。函数内部的**所有触发点**（beforeScoring/afterScoring/onPlay/onDestroy/onPhaseStart/onPhaseEnd 等）都必须有防重复机制，不能只保护部分触发点。

**核心原则**：
- 创建交互 + halt 流程 = 函数会被重入（交互解决后流程恢复，函数继续执行或被再次调用）
- 函数内有多个触发点时，必须为**每个触发点**单独添加防重复机制
- 对称设计：`beforeXxxTriggeredYyy` 防止 `beforeXxx` 重复，`afterXxxTriggeredYyy` 防止 `afterXxx` 重复
- 防重复标记必须在回合/阶段结束时清理，避免泄漏到下一回合

**审查方法**：
1. **识别创建交互并 halt 的函数**：grep 所有返回 `{ halt: true }` 或设置 `flowHalted=true` 的函数（如 `scoreOneBase`、`processPhaseEnd`、`executeTurn` 等）
2. **列出函数内所有触发点**：函数内调用了哪些触发器？（`triggerBeforeScoring`/`triggerAfterScoring`/`fireMinionPlayedTriggers`/`fireDestroyTriggers` 等）
3. **检查每个触发点的防重复机制**：
   - 是否有"已触发"标记字段？（如 `beforeScoringTriggeredBases`/`afterScoringTriggeredBases`）
   - 触发前是否检查标记？（如 `if (alreadyTriggered) continue`）
   - 触发后是否立即设置标记？（发射标记事件 → 立即 reduce 到本地 core 副本）
4. **检查标记清理时机**：标记在回合/阶段结束时是否正确清理？（通常在 `TURN_CHANGED`/`PHASE_CHANGED` 事件的 reducer 中清理）
5. **对称性检查**：如果函数有 `beforeXxx` 和 `afterXxx` 两个触发点，是否都有对应的防重复机制？

**典型缺陷模式**：
- ❌ 只为 `beforeScoring` 添加 `beforeScoringTriggeredBases`，遗漏 `afterScoring` → 交互解决后重入时 `afterScoring` 重复触发
- ❌ 防重复标记在触发后异步设置（等待 pipeline reduce）→ 同一轮重入时标记尚未生效，仍会重复触发
- ❌ 防重复标记未在回合结束时清理 → 泄漏到下回合，导致下回合该触发点永远不触发
- ❌ 多个触发点共享同一个标记 → 触发其中一个后，其他触发点也被误屏蔽

**修复模板**：
```typescript
// 1. 在 core 类型中添加防重复标记字段
export interface GameCore {
  // ...
  beforeScoringTriggeredBases?: number[];  // 已触发 beforeScoring 的基地
  afterScoringTriggeredBases?: number[];   // 已触发 afterScoring 的基地
}

// 2. 在事件类型中添加标记事件
export const EVENTS = defineEvents({
  'game:before_scoring_triggered': { audio: 'silent', sound: null },
  'game:after_scoring_triggered': { audio: 'silent', sound: null },
  'game:before_scoring_cleared': { audio: 'silent', sound: null },
  'game:after_scoring_cleared': { audio: 'silent', sound: null },
});

// 3. 在函数中检查并设置标记
function scoreOneBase(state: MatchState, baseIndex: number): MatchState {
  let core = state.core;

  // beforeScoring 防重复
  const alreadyTriggeredBefore = core.beforeScoringTriggeredBases?.includes(baseIndex);
  if (!alreadyTriggeredBefore) {
    // 触发 beforeScoring 能力
    const beforeEvents = triggerBeforeScoring(core, baseIndex);

    // 立即标记已触发（发射事件 + 立即 reduce）
    const markEvent = { type: 'game:before_scoring_triggered' as const, baseIndex };
    core = reduce(core, markEvent);

    // 应用 beforeScoring 事件
    for (const event of beforeEvents) {
      core = reduce(core, event);
    }
  }

  // ... 计分逻辑 ...

  // afterScoring 防重复
  const alreadyTriggeredAfter = core.afterScoringTriggeredBases?.includes(baseIndex);
  if (!alreadyTriggeredAfter) {
    // 触发 afterScoring 能力
    const afterEvents = triggerAfterScoring(core, baseIndex);

    // 立即标记已触发
    const markEvent = { type: 'game:after_scoring_triggered' as const, baseIndex };
    core = reduce(core, markEvent);

    // 应用 afterScoring 事件
    for (const event of afterEvents) {
      core = reduce(core, event);
    }
  }

  return { ...state, core };
}

// 4. 在 reducer 中处理标记事件
case 'game:before_scoring_triggered':
  return {
    ...core,
    beforeScoringTriggeredBases: [
      ...(core.beforeScoringTriggeredBases || []),
      event.baseIndex
    ]
  };

case 'game:after_scoring_triggered':
  return {
    ...core,
    afterScoringTriggeredBases: [
      ...(core.afterScoringTriggeredBases || []),
      event.baseIndex
    ]
  };

// 5. 在阶段/回合结束时清理标记
case 'game:phase_changed':
  if (event.newPhase === 'nextPhase') {
    return {
      ...core,
      beforeScoringTriggeredBases: undefined,
      afterScoringTriggeredBases: undefined
    };
  }
  return core;
```

**排查信号**：
- "交互解决后能力重复触发" + 日志显示同一能力被触发两次 = 高度怀疑缺少防重复机制
- "只有部分触发点有防重复" + 最近修改了 `flowHalted` 清除逻辑 = 高度怀疑遗漏了某些触发点
- "上回合的防重复标记泄漏到下回合" = 标记未在回合结束时清理

**参考案例**：
- SmashUp 巫师学院（Wizard Academy）：Commit `5383362` 只为 `beforeScoring` 添加了 `beforeScoringTriggeredBases`，遗漏了 `afterScoring` 的 `afterScoringTriggeredBases`。修复 `flowHalted` 清除逻辑后，交互解决时 `scoreOneBase` 被重入，`afterScoring` 能力重复触发，玩家可以反复点击加分。修复：添加 `afterScoringTriggeredBases` 机制，与 `beforeScoringTriggeredBases` 对称。

**关联维度**：
- D8（时序正确）：交互解决后是否自动恢复流程推进？
- D39（流程控制标志清除完整性）：`flowHalted` 标志的清除条件是否正确？
- D14（回合清理完整）：防重复标记是否在回合结束时清理？


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
