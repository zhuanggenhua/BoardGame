# 审计 4.2：冠军能力 — 火祀召唤、吸取生命、暴怒

## 第零步：锁定权威描述

### 伊路特-巴尔 — 火祀召唤（fire_sacrifice_summon）
**权威描述**（i18n zh-CN）：
> 在你的召唤阶段，你可以消灭一个友方单位，以代替支付魔力费用来召唤一个单位。

**被动描述**（fire_sacrifice_passive）：
> 当你为召唤本单位支付费用时，还必须消灭一个友方单位，并且使用本单位替换被消灭的单位。

**卡牌数据**：伊路特-巴尔，冠军，近战，力量6，生命6，费用6，abilities: ['fire_sacrifice_summon']

### 德拉戈斯 — 吸取生命（life_drain）
**权威描述**（i18n zh-CN）：
> 在本单位攻击之前，可以消灭其2个区格以内的一个友方单位。如果你这样做，则本次攻击战力翻倍。

**卡牌数据**：德拉戈斯，冠军，近战，力量4，生命8，费用6，abilities: ['life_drain']

### 古尔-达斯 — 暴怒（rage）
**权威描述**（i18n zh-CN）：
> 本单位每有1点伤害，则获得战力+1。

**卡牌数据**：古尔-达斯，冠军，近战，力量3，生命8，费用5，abilities: ['rage']

---

## 第一步：拆分独立交互链

### 火祀召唤（fire_sacrifice_summon）
- **链A**：主动激活 → 选择友方单位 → 消灭该单位 → 移动自身到该位置
  - 触发时机：召唤阶段，主动激活
  - 原子步骤：
    1. 玩家点击"火祀召唤"按钮
    2. 选择一个友方单位作为牺牲目标
    3. 消灭该友方单位（触发 onDeath 效果如献祭）
    4. 将伊路特-巴尔移动到被消灭单位的位置

### 吸取生命（life_drain）
- **链A**：攻击前激活 → 选择2格内友方单位 → 消灭该单位 → 战力翻倍 → 执行攻击
  - 触发时机：攻击前（beforeAttack），可选
  - 原子步骤：
    1. 玩家点击"吸取生命"按钮
    2. 选择2格内的一个友方单位
    3. 消灭该友方单位（触发 onDeath 效果）
    4. 本次攻击战力翻倍（×2）
    5. 选择攻击目标，执行攻击

### 暴怒（rage）
- **链A**：被动效果 → 伤害计算时 → 每1点伤害+1战力
  - 触发时机：onDamageCalculation，被动
  - 原子步骤：
    1. 古尔-达斯发起攻击
    2. 计算有效战力时，读取 unit.damage
    3. 战力 = 基础战力 + 伤害标记数量

### 自检
- 火祀召唤：覆盖"消灭友方单位"+"移动到该位置" ✅
- 吸取生命：覆盖"攻击之前"+"消灭2格内友方"+"战力翻倍" ✅
- 暴怒：覆盖"每有1点伤害"+"战力+1" ✅

---

## 第二步：八层链路矩阵

### 火祀召唤（fire_sacrifice_summon）

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `abilities.ts` 中 `fire_sacrifice_summon` AbilityDef：trigger='activated', requiredPhase='summon', ui.requiresButton=true, ui.buttonPhase='summon', quickCheck 检查场上有其他友方单位。customValidator 验证 targetUnitId 存在且为友方。 |
| 注册层 | ✅ | `NECROMANCER_ABILITIES` 数组注册到 `abilityRegistry`；`executors/necromancer.ts` 注册 `fire_sacrifice_summon` 执行器到 `abilityExecutorRegistry`。 |
| 执行层 | ✅ | `executors/necromancer.ts`：查找目标单位 → `emitDestroyWithTriggers`（含 onDeath 触发）→ 发射 `UNIT_MOVED` 事件将源单位移动到被消灭位置。限定条件：customValidator 验证 targetUnitId 为友方单位。 |
| 状态层 | ✅ | `reduce.ts`：`UNIT_DESTROYED` 移除单位并放入弃牌堆；`UNIT_MOVED` 移动源单位到新位置。 |
| 验证层 | ✅ | `abilityValidation.ts`：通用验证流程检查阶段（summon）、单位拥有技能、customValidator 验证目标为友方。 |
| UI层 | ✅ | `AbilityButtonsPanel.tsx` 渲染按钮；`StatusBanners.tsx` 显示"火祀召唤：选择要消灭的友方单位"；`useCellInteraction.ts` 高亮友方单位供选择。 |
| i18n层 | ✅ | zh-CN 和 en 均有 `fire_sacrifice_summon` 的 name/description、`abilityButtons.fireSacrificeSummon`、`statusBanners.ability.fireSacrificeSummon`。 |
| 测试层 | ✅ | `abilities-necromancer-execute.test.ts`：测试消灭友方+移动到位置，验证事件和最终状态。`entity-chain-integrity.test.ts` 覆盖注册完整性。 |

### 吸取生命（life_drain）

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `abilities.ts` 中 `life_drain` AbilityDef：trigger='beforeAttack', requiredPhase='attack', ui.requiresButton=true, ui.activationContext='beforeAttack', quickCheck 检查2格内有友方单位。customValidator 验证目标为友方且距离≤2。 |
| 注册层 | ✅ | `NECROMANCER_ABILITIES` 注册到 `abilityRegistry`；`executors/necromancer.ts` 注册 `life_drain` 执行器。 |
| 执行层 | ✅ | 两条执行路径：① `executors/necromancer.ts`（ACTIVATE_ABILITY）：消灭友方 + STRENGTH_MODIFIED(multiplier=2)。② `execute.ts` DECLARE_ATTACK 的 beforeAttack 分支：消灭友方 + STRENGTH_MODIFIED + beforeAttackMultiplier×2 应用到骰子数。限定条件：距离≤2 在 customValidator 和 validate.ts 双重检查。 |
| 状态层 | ✅ | `reduce.ts`：`UNIT_DESTROYED` 移除单位；`STRENGTH_MODIFIED` 是通知事件不修改状态（战力翻倍在 execute 层通过 `beforeAttackMultiplier` 应用到骰子数）。 |
| 验证层 | ✅ | `validate.ts` DECLARE_ATTACK 分支：检查 targetUnitId 存在、为友方、距离≤2。`abilityValidation.ts`：通用验证检查阶段和 customValidator。 |
| UI层 | ✅ | `AbilityButtonsPanel.tsx` 渲染按钮；`StatusBanners.tsx` 显示"吸取生命：选择2格内的友方单位消灭"和"攻击前技能：吸取生命已就绪"；`useCellInteraction.ts` 高亮2格内友方单位。"可以"语义 → 有按钮触发，非自动执行 ✅。 |
| i18n层 | ✅ | zh-CN 和 en 均有 `life_drain` 的 name/description、`abilityButtons.lifeDrain`、`statusBanners.ability.lifeDrain`、`statusBanners.beforeAttack.lifeDrain`。 |
| 测试层 | ✅ | `abilities-necromancer-execute.test.ts`：3个测试覆盖正常流程（消灭+翻倍）、DECLARE_ATTACK 集成（骰子数=4）、距离超限验证拒绝。`entity-chain-integrity.test.ts` 覆盖 beforeAttack 链路。均验证最终状态。 |

### 暴怒（rage）

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `abilities.ts` 中 `rage` AbilityDef：trigger='onDamageCalculation', effects=[modifyStrength(self, attribute(self, 'damage'))]。无 UI 按钮（被动效果）。 |
| 注册层 | ✅ | `NECROMANCER_ABILITIES` 注册到 `abilityRegistry`。无需执行器注册（被动效果在 `calculateEffectiveStrength` 中处理）。 |
| 执行层 | ✅ | `abilityResolver.ts` `calculateEffectiveStrength`：遍历 abilities，对 trigger='onDamageCalculation' 的效果，evaluateExpression 计算 `{ type: 'attribute', target: 'self', attr: 'damage' }` → 返回 `unit.damage`，加到 strength。 |
| 状态层 | ✅ | 无状态变更（被动效果在查询时计算，不持久化）。 |
| 验证层 | ✅ | 无需验证（被动效果，无命令）。 |
| UI层 | ✅ | `StrengthBoostIndicator.tsx` 使用 `getStrengthBoostForDisplay(unit, core)` 显示战力增幅，该函数调用 `calculateEffectiveStrength` 包含 rage 加成。 |
| i18n层 | ✅ | zh-CN 和 en 均有 `rage` 的 name/description。 |
| 测试层 | ✅ | `entity-chain-integrity.test.ts`：测试 damage=2 时战力=2+2=4（骰子数验证）；边界测试 damage=0 时战力=基础值。均验证最终状态（diceCount）。 |

---

## 第三步：grep 消费点

### fire_sacrifice_summon
- `abilities.ts`：定义 ✅
- `executors/necromancer.ts`：执行器 ✅
- `useCellInteraction.ts`：UI 交互 ✅
- `StatusBanners.tsx`：状态提示 ✅
- `entity-chain-integrity.test.ts`：测试 ✅
- `abilities-necromancer-execute.test.ts`：测试 ✅
- 消费链路完整 ✅

### life_drain
- `abilities.ts`：定义 ✅
- `executors/necromancer.ts`：执行器 ✅
- `execute.ts`：DECLARE_ATTACK beforeAttack 分支 ✅
- `validate.ts`：DECLARE_ATTACK beforeAttack 验证 ✅
- `useCellInteraction.ts`：UI 交互 ✅
- `StatusBanners.tsx`：状态提示 ✅
- `modeTypes.ts`：类型定义 ✅
- 消费链路完整 ✅

### rage
- `abilities.ts`：定义 ✅
- `abilityResolver.ts`：calculateEffectiveStrength 消费 ✅
- `StrengthBoostIndicator.tsx`：UI 显示 ✅
- 消费链路完整 ✅

---

## 第四步：交叉影响检查

1. **火祀召唤消灭友方 → 触发献祭（sacrifice）**：`emitDestroyWithTriggers` 会触发被消灭单位的 onDeath 效果。如果被消灭的是地狱火教徒（有 sacrifice 技能），会对相邻敌方造成1伤。✅ 正确处理。

2. **火祀召唤消灭友方 → 触发血腥狂怒（blood_rage）**：任意单位被消灭时，场上有 blood_rage 的单位获得充能。✅ 通过 `emitDestroyWithTriggers` 正确触发。

3. **吸取生命消灭友方 → 触发献祭/血腥狂怒**：同上，`emitDestroyWithTriggers` 正确处理。✅

4. **暴怒 + 交缠颂歌共享**：如果古尔-达斯通过交缠颂歌获得其他被动技能，`calculateEffectiveStrength` 使用 `getUnitAbilities(unit, state)` 包含共享技能。✅

5. **暴怒 + 吸取生命叠加**：德拉戈斯不可能同时拥有 rage 和 life_drain（除非交缠共享），但如果通过交缠获得 rage，`calculateEffectiveStrength` 会先计算 rage 加成再被 life_drain 翻倍。✅ 正确。

---

## 第五步：数据查询一致性

rage 的战力加成通过 `calculateEffectiveStrength` 统一入口计算，UI 层通过 `getStrengthBoostForDisplay` 调用。无绕过。✅

---

## 发现的问题

### 已修复

| # | 严重度 | 描述 | 修复 |
|---|--------|------|------|
| 1 | low | `abilityResolver.ts` 的 `getUnitAbilities` 交缠颂歌共享只读 `partner.card.abilities`，不含 `tempAbilities` | 修改为同时读取 `card.abilities` 和 `tempAbilities`，与 `helpers.ts` 保持一致 |
| 2 | low | `abilities-necromancer-execute.test.ts` 火祀召唤测试使用 `phase='attack'`，但技能要求 `phase='summon'` | 修改为 `phase='summon'` |

### 无问题确认

- 火祀召唤"可以"语义 → 有按钮触发，非自动执行 ✅
- 吸取生命"可以"语义 → 有按钮触发，非自动执行 ✅
- 暴怒被动效果 → 无需交互确认 ✅
- 限定条件（2格内友方）在验证层和执行层双重约束 ✅
- 所有测试覆盖"命令→事件→状态变更"全链路 ✅
