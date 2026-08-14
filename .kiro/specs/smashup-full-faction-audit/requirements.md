# 需求文档：大杀四方（SmashUp）全维度审计（D1-D33）

## 简介

对大杀四方（SmashUp, gameId: `smashup`）进行基于 `.spec/knowledge/standards/testing-audit.md` D1-D33 全维度框架的系统性审计。

**第一阶段（已完成）**：D1 描述→实现文本一致性 + D3 注册覆盖的静态审计，覆盖基础版 8 派系。发现 3 个 i18n 文本错误（已修复）和 2 个逻辑 bug（待修复）。已有静态属性测试（Property 1-3, 6, 9）和逐派系文本审计报告（`docs/audit/smashup/phase1-*.md`）。

**第二阶段（本 spec）**：补全第一阶段完全缺失的运行时行为维度审计。审计范围为基础版 8 派系 + 全部基地卡。

## 审计数据源与冲突处理规范

- **主要对照源**：SmashUp Wiki + 卡牌图片（图片优先）
- **代码侧数据源**：i18n JSON 描述 + 能力注册表 + reducer + validate + UI 组件
- **冲突处理原则**：差异累积记录，统一向用户确认后再决定以哪方为准
- **确认批次**：每完成一个审计维度组后，将差异汇总提交用户确认

## 术语表

- **GameTestRunner**: 引擎层行为测试工具，通过命令序列+状态断言验证运行时行为
- **afterScoring**: 基地计分后触发的 ongoing trigger 时机
- **ctx.playerId**: trigger 回调中的当前回合玩家 ID（非卡牌 owner）
- **post-reduce**: reducer 执行后的状态（计数器已递增）
- **grantExtraMinion**: 授予额外随从出牌额度的引擎 API
- **createSimpleChoice**: 创建玩家交互选择的引擎 API
- **baseLimitedMinionQuota**: 基地限定的额外随从额度字段
- **filterProtectedEvents**: 过滤受保护实体事件的函数

---

## 需求（第一阶段 — 已完成，保留引用）

### 需求 1：基础版 8 派系 D1 文本审计（已完成）

已完成逐卡文本比对，报告见 `docs/audit/smashup/phase1-*.md`。

### 需求 2：静态注册覆盖属性测试（已完成）

已完成 Property 1-3, 6, 9 属性测试。

---

## 需求（第二阶段 — 缺失维度补全）

### 需求 3：D1 子项 — 实体筛选范围语义审计

**用户故事：** 作为开发者，我希望审计所有能力实现中 `.filter()`/`.find()`/`for...of` 等实体收集操作的范围，确保与描述中的范围限定词（"本基地"/"其他基地"/"所有基地"/"己方"/"对手"等）完全一致。

#### 验收标准

1. THE Audit_System SHALL 对每个能力执行器中的实体筛选操作，提取描述中的范围限定词（位置范围、归属范围、实体类型、来源范围、排除条件），逐个与代码中的筛选条件比对
2. WHEN 描述说"其他基地"时，代码 SHALL 遍历 `state.bases.filter(b => b.index !== thisBaseIndex)` 而非 `thisBase.minions`
3. WHEN 描述说"你的随从"时，代码 SHALL 过滤 `m.controller === playerId`，不得遍历所有随从不过滤归属
4. THE Audit_System SHALL 输出筛选范围审计矩阵：描述范围 | 代码筛选 | 判定（✅/❌）
5. THE Audit_System SHALL 重点覆盖已知高风险卡牌：`base_tortuga`（亚军移动随从范围）、`alien_crop_circles`（全基地 vs 单基地）、`pirate_full_sail`（移动目标范围）

### 需求 4：D5 — 交互语义完整性审计

**用户故事：** 作为开发者，我希望审计所有 `createSimpleChoice` 调用的 `multi` 配置、`targetType` 声明、以及实现模式（额度 vs 交互）是否与描述语义匹配。

#### 验收标准

1. THE Audit_System SHALL 检查每个 `createSimpleChoice` 调用的 `multi` 配置是否与描述语义匹配：描述"任意数量"→ `multi: { min: 0, max: N }`；描述"选择一个"→ 无 `multi`（单选）；描述"最多 N 个"→ `multi: { min: 0, max: N }`
2. THE Audit_System SHALL 检查描述语义为"授予额度"的能力（如"你可以打出一张额外随从"）是否使用 `grantExtraMinion`/`grantExtraAction` 而非 `createSimpleChoice` 弹窗
3. THE Audit_System SHALL 检查所有 `grantExtraMinion` 调用是否正确传递了描述中的约束条件（`sameNameOnly`/`restrictToBase`/`powerMax`）到 payload
4. WHEN 能力使用 `targetType` 声明走棋盘直选模式时，THE Audit_System SHALL 检查非目标选项（done/skip/cancel）是否有替代 UI 可达路径
5. THE Audit_System SHALL 检查同类型卡牌（如"选随从→逐张选手牌"模式）的 `targetType`、停止按钮 value key、`displayMode` 是否跨派系一致

### 需求 5：D8 — 时序正确性审计

**用户故事：** 作为开发者，我希望审计所有 ongoing trigger 的 `ctx.playerId` 语义、post-reduce 计数器阈值、以及 ongoing 触发顺序的正确性。

#### 验收标准

1. THE Audit_System SHALL 检查所有 `afterScoring`/`beforeScoring` trigger 回调中是否误用 `ctx.playerId` 作为卡牌 owner（应遍历所有同名 ongoing 实例的 `ownerId` 独立判断）
2. THE Audit_System SHALL 检查所有 `onMinionPlayed`/`onCardPlayed` 回调中的计数器检查是否使用 post-reduce 阈值（首次 = `=== 1` 而非 `=== 0`）
3. THE Audit_System SHALL 检查所有 `onMinionPlayed` 回调中是否使用权威计数器（`minionsPlayedPerBase`）而非派生状态（`base.minions.length`）判定"首次"
4. WHEN 多个 ongoing trigger 在同一时机触发时，THE Audit_System SHALL 验证触发顺序是否影响最终结果（如两个 afterScoring trigger 的执行顺序是否导致不同的 VP 分配）
5. THE Audit_System SHALL 使用 GameTestRunner 构造行为测试，覆盖：非当前回合玩家拥有的 afterScoring trigger 是否正确触发、首次打出随从的 onMinionPlayed 是否正确判定

### 需求 6：D8 子项 — 写入-消费窗口对齐审计

**用户故事：** 作为开发者，我希望审计所有在非常规阶段写入临时状态的机制，确保写入时机在消费窗口内。

#### 验收标准

1. THE Audit_System SHALL 画出 SmashUp 的完整阶段时间线（playCards → scoring → draw → TURN_CHANGED），标注每个临时状态的写入时机、消费窗口、清理时机
2. THE Audit_System SHALL 检查所有 `grantExtraMinion`/`grantExtraAction` 的写入时机是否在对应消费窗口（playCards 阶段）之前或之内
3. WHEN 写入发生在消费窗口之后时，THE Audit_System SHALL 标记为 ❌ 并记录：写入阶段、消费阶段、清理阶段、修复建议
4. THE Audit_System SHALL 重点检查基地能力（如 `base_homeworld`、`base_secret_grove`）的额度授予时机是否在 playCards 阶段可消费

### 需求 7：D11/D12/D13 — 额度写入-消耗对称性审计

**用户故事：** 作为开发者，我希望审计所有额度/资源的写入路径与消耗路径是否对称，多来源额度的消耗优先级是否正确。

#### 验收标准

1. THE Audit_System SHALL 追踪每个 `LIMIT_MODIFIED` 事件从 payload → reducer case → 写入字段的完整链路，验证字段名和数据结构一致
2. THE Audit_System SHALL 追踪 `PLAY_MINION`/`PLAY_ACTION` 在 reducer 中的消耗分支，验证消耗条件与写入条件对称
3. WHEN `baseLimitedMinionQuota` 和 `minionLimit` 同时存在时，THE Audit_System SHALL 验证消耗优先级：打到限定基地的随从应优先消耗 `baseLimitedMinionQuota`，而非 `minionLimit`
4. THE Audit_System SHALL 使用 GameTestRunner 构造测试：① 只有基地限定额度时消耗正确 ② 基地限定额度与全局额度并存时消耗优先级正确 ③ 基地限定额度消耗后不影响全局额度剩余量
5. THE Audit_System SHALL 检查 reducer 中 `HAND_SHUFFLED_INTO_DECK` 等复用事件类型的操作范围是否与所有调用方的 payload 语义对齐（全量操作 vs 部分操作）

### 需求 8：D14 — 回合清理完整性审计

**用户故事：** 作为开发者，我希望审计回合/阶段结束时所有临时状态是否全部正确清理。

#### 验收标准

1. THE Audit_System SHALL 列出所有在回合中被写入的临时字段（`minionsPlayed`/`actionsPlayed`/`baseLimitedMinionQuota`/`extraMinionPowerMax`/`sameNameMinionRemaining` 等），验证每个字段在 `TURN_STARTED` 或 `TURN_ENDED` 中有对应的清理/重置
2. WHEN 发现临时字段无清理逻辑时，THE Audit_System SHALL 标记为 ❌ 回合清理遗漏
3. THE Audit_System SHALL 使用 GameTestRunner 构造跨回合测试：回合 1 授予额外额度 → 回合 2 验证额度已清零

### 需求 9：D15 — UI 状态同步审计

**用户故事：** 作为开发者，我希望审计 UI 展示的数值/状态是否与 core 状态一致。

#### 验收标准

1. THE Audit_System SHALL 检查 Board.tsx 中"剩余随从次数"的计算是否聚合了所有额度来源（`minionLimit - minionsPlayed + baseLimitedMinionQuota`）
2. THE Audit_System SHALL 检查 `deployableBaseIndices` 的计算是否根据 `playConstraint`/`restrictToBase` 等约束正确过滤不可选基地
3. WHEN 能力有力量指示物（`powerModifier`）时，THE Audit_System SHALL 验证 UI 渲染条件是否直接读取 reducer 写入的字段

### 需求 10：D18/D19 — 否定路径与组合场景审计

**用户故事：** 作为开发者，我希望审计额度隔离（否定路径）和多机制组合场景的正确性。

#### 验收标准

1. THE Audit_System SHALL 使用 GameTestRunner 构造否定路径测试：① 基地限定额度消耗后 `minionsPlayed` 不变 ② 正常额度消耗后 `baseLimitedMinionQuota` 不变 ③ 在非限定基地打随从不消耗基地限定额度
2. THE Audit_System SHALL 使用 GameTestRunner 构造组合场景测试：母星（全局 minionLimit+1, 力量≤2）+ 神秘花园（baseLimitedMinionQuota+1）同时生效时，两种额度互不干扰
3. THE Audit_System SHALL 构造跨派系能力组合测试：两个不同派系的 ongoing trigger 在同一时机触发时结果正确

### 需求 11：D31 — 效果拦截路径完整性审计

**用户故事：** 作为开发者，我希望审计 `registerProtection` + `filterProtectedEvents` 机制在所有事件产生路径上是否被调用。

#### 验收标准

1. THE Audit_System SHALL 列出所有调用 `filterProtectedMinionDestroyEvents`/`filterProtectedMinionMoveEvents` 等过滤函数的位置
2. THE Audit_System SHALL 列出所有产生 `MINION_DESTROYED`/`MINION_MOVED` 等可被拦截事件的路径：① 直接命令执行 ② 交互解决（afterEvents）③ FlowHooks 后处理 ④ 触发链递归（processDestroyTriggers）
3. WHEN 某条事件产生路径未调用对应的过滤函数时，THE Audit_System SHALL 标记为 ❌ 拦截路径遗漏
4. THE Audit_System SHALL 使用 GameTestRunner 验证：受保护随从（如 `trickster_hideout` 保护的随从）在所有消灭路径下均不被消灭

### 需求 12：D33 — 跨派系同类能力实现路径一致性审计

**用户故事：** 作为开发者，我希望审计不同派系中语义相同的能力是否使用一致的事件类型、注册模式和副作用处理。

#### 验收标准

1. THE Audit_System SHALL 按能力类型分组（消灭随从/抽牌/移动随从/力量修正/额外出牌/弃牌堆回收/返回手牌/打出限制），对每组内所有卡牌的实现路径进行比对
2. THE Audit_System SHALL 对每组输出：事件类型 | 注册模式 | 副作用处理 | 一致性判定
3. WHEN 差异在合理范围内（语义本身不同导致的实现差异）时，THE Audit_System SHALL 标注原因
4. WHEN 差异不合理时，THE Audit_System SHALL 标记为 ⚠️ 待修复

### 需求 13：D24 — Handler 共返状态一致性审计

**用户故事：** 作为开发者，我希望审计交互 handler 同时返回 events 和新 interaction 时，新 interaction 的选项是否基于 events 已生效后的状态计算。

#### 验收标准

1. THE Audit_System SHALL grep 所有 handler 中同时包含非空 `events` 数组和 `queueInteraction` 的 return 语句
2. THE Audit_System SHALL 追踪返回的 events 会改变 `state.core` 的哪些字段，以及新 interaction 的选项从哪个字段构建
3. WHEN 选项数据来源字段被 events 影响且选项构建未考虑 events 效果时，THE Audit_System SHALL 标记为 ❌ 共返状态不一致
4. THE Audit_System SHALL 重点检查涉及"弃牌后从弃牌堆选"模式的 handler（如丧尸派系的回收能力）

### 需求 14：D2 子项 — 打出约束与额度授予约束审计

**用户故事：** 作为开发者，我希望审计 ongoing 行动卡的 `playConstraint` 声明和额度授予的约束条件在数据定义→验证层→UI 层三层是否完整体现。

#### 验收标准

1. THE Audit_System SHALL grep 所有 ongoing 行动卡的 i18n effectText，匹配条件性打出描述（如"打出到一个你至少拥有一个随从的基地上"），检查对应 `ActionCardDef` 是否有 `playConstraint` 字段
2. THE Audit_System SHALL 检查 `commands.ts` 中 ongoing 行动卡验证逻辑是否检查 `def.playConstraint`
3. THE Audit_System SHALL 检查 `Board.tsx` 的 `deployableBaseIndices` 计算是否根据 `playConstraint` 过滤不可选基地
4. THE Audit_System SHALL 检查所有 `grantExtraMinion` 调用点，交叉对比卡牌描述中的约束条件（"同名"/"到这里"/"力量≤N"），验证 payload 完整性
