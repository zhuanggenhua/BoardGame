# 审计 4.4：堕落王国事件卡

## 审计发现汇总

| # | 严重度 | 描述 | 状态 |
|---|--------|------|------|
| 1 | medium | 单位被摧毁时附加的事件卡（如狱火铸剑）未弃置到弃牌堆 | ✅ 已修复 |
| 2 | medium | 除灭（annihilate）selectDamageTarget 步骤缺少跳过按钮（描述中"你可以"表示可选） | ✅ 已修复 |

---

## 事件卡 1：狱火铸剑（NECRO_HELLFIRE_BLADE）

### 第零步：锁定权威描述

**来源**：`config/factions/necromancer.ts` → `EVENT_CARDS[1].effect`
> 将本事件放置到一个友方士兵的底层。该单位获得战斗力+2和以下技能：
> 诅咒：在本单位攻击之后，对其造成点数等于所掷出⚔数量的伤害。

**卡牌属性**：费用 0，施放阶段 build（建造阶段），普通事件

### 第一步：拆分独立交互链

#### 交互链 A：附加到友方士兵
**触发条件**：建造阶段，玩家从手牌施放
**原子步骤**：
1. 「将本事件放置到一个友方士兵的底层」→ 选择友方 common 单位 → EVENT_ATTACHED 事件
2. 「该单位获得战斗力+2」→ calculateEffectiveStrength 检查 attachedCards

#### 交互链 B：诅咒效果（被动）
**触发条件**：附加了狱火铸剑的单位攻击后
**原子步骤**：
1. 「在本单位攻击之后」→ 攻击流程结束后检查 hasHellfireBlade
2. 「对其造成点数等于所掷出⚔数量的伤害」→ 统计 melee 骰面数 → UNIT_DAMAGED(reason='curse')

#### 交互链 C：单位被摧毁时弃置（隐含规则）
**触发条件**：附加了狱火铸剑的单位被摧毁
**原子步骤**：
1. 规则："被摧毁卡牌下的卡牌会被弃置" → attachedCards 应进入弃牌堆

### 自检

| 原文片段 | 覆盖链 |
|----------|--------|
| 放置到一个友方士兵的底层 | A-1 |
| 获得战斗力+2 | A-2 |
| 在本单位攻击之后 | B-1 |
| 对其造成点数等于所掷出⚔数量的伤害 | B-2 |
| （规则：被摧毁卡牌下的卡牌弃置） | C-1 |

✅ 原文每句话均被覆盖。

### 第二步：八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `necromancer.ts`: id='necro-hellfire-blade', cost=0, playPhase='build', effect 描述完整 |
| 注册层 | ✅ | `ids.ts`: CARD_IDS.NECRO_HELLFIRE_BLADE = 'necro-hellfire-blade'；`eventCards.ts` switch-case 匹配 |
| 执行层 | ✅ | `eventCards.ts`: isAttachment=true → EVENT_PLAYED(isAttachment=true) + EVENT_ATTACHED(targetPosition)；`execute.ts`: hasHellfireBlade 检查 → meleeHits 统计 → UNIT_DAMAGED(reason='curse')；`abilityResolver.ts`: calculateEffectiveStrength 中 attachedCards 检查 +2 |
| 状态层 | ✅ | `reduce.ts`: EVENT_PLAYED(isAttachment=true) → 从手牌移除但不放入弃牌堆/主动区；EVENT_ATTACHED → unit.attachedCards 追加；UNIT_DESTROYED → attachedEventCards 弃置（**本次修复**） |
| 验证层 | ✅ | `validate.ts`: PLAY_EVENT 通用验证（手牌存在、费用、阶段匹配）；`useEventCardModes.ts`: 过滤 unitClass==='common' |
| UI层 | ✅ | `useEventCardModes.ts`: 'necro-hellfire-blade' case → 过滤友方 common 单位 → setEventTargetMode；选择目标后发送 PLAY_EVENT(targets=[position]) |
| i18n层 | ✅ | zh-CN: statusBanners.annihilate 等条目存在；en: 对应条目存在。狱火铸剑本身无独立 UI 提示（选择目标用通用 eventTargetMode） |
| 测试层 | ⚠️ | E2E 测试覆盖（e2e/summonerwars.e2e.ts 教程流程中使用狱火铸剑）；单元测试中无独立的狱火铸剑执行测试（附加+战力+诅咒全链路）。建议后续补充 |

---

## 事件卡 2：殉葬火堆（NECRO_FUNERAL_PYRE）

### 第零步：锁定权威描述

**来源**：`config/factions/necromancer.ts` → `EVENT_CARDS[0].effect`
> 持续：每当一个单位被消灭时，对本事件充能。当本事件被弃除时，指定一个单位为目标。本事件每有1点充能，则从目标上移除1点伤害。

**卡牌属性**：费用 1，施放阶段 summon（召唤阶段），传奇事件，isActive=true

### 第一步：拆分独立交互链

#### 交互链 A：施放并放入主动区域
**触发条件**：召唤阶段，玩家从手牌施放
**原子步骤**：
1. 「持续」→ isActive=true → 放入主动事件区

#### 交互链 B：单位被消灭时充能（自动触发）
**触发条件**：任意单位被消灭
**原子步骤**：
1. 「每当一个单位被消灭时」→ execute.ts 后处理扫描 UNIT_DESTROYED 事件
2. 「对本事件充能」→ getFuneralPyreChargeEvents → FUNERAL_PYRE_CHARGED

#### 交互链 C：弃除时治疗（玩家交互）
**触发条件**：回合开始弃置主动事件时（有充能则等待玩家选择）
**原子步骤**：
1. 「当本事件被弃除时」→ flowHooks.ts: 有充能时不自动弃置，由 UI 触发 FUNERAL_PYRE_HEAL
2. 「指定一个单位为目标」→ UI funeralPyreMode 让玩家点击受伤单位
3. 「本事件每有1点充能，则从目标上移除1点伤害」→ UNIT_HEALED(amount=charges)
4. 弃置殉葬火堆 → ACTIVE_EVENT_DISCARDED
5. 玩家可跳过治疗 → skip=true → 直接弃置

### 自检

| 原文片段 | 覆盖链 |
|----------|--------|
| 持续 | A-1 |
| 每当一个单位被消灭时 | B-1 |
| 对本事件充能 | B-2 |
| 当本事件被弃除时 | C-1 |
| 指定一个单位为目标 | C-2 |
| 每有1点充能，移除1点伤害 | C-3 |

✅ 原文每句话均被覆盖。

### 第二步：八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `necromancer.ts`: id='necro-funeral-pyre', cost=1, playPhase='summon', eventType='legendary', isActive=true |
| 注册层 | ✅ | `ids.ts`: CARD_IDS.NECRO_FUNERAL_PYRE；`execute/helpers.ts`: getFuneralPyreChargeEvents 通过 name 或 baseId 匹配 |
| 执行层 | ✅ | `execute.ts` 后处理：扫描 UNIT_DESTROYED 数量 → 每个调用 getFuneralPyreChargeEvents（双方主动区都检查）；FUNERAL_PYRE_HEAL：有充能+目标 → UNIT_HEALED(amount=charges) + ACTIVE_EVENT_DISCARDED；skip → 仅 ACTIVE_EVENT_DISCARDED |
| 状态层 | ✅ | `reduce.ts`: FUNERAL_PYRE_CHARGED → 更新 activeEvents 中的 charges（支持绝对值和+1两种模式）；UNIT_HEALED → 减少 damage；ACTIVE_EVENT_DISCARDED → 从 activeEvents 移到 discard |
| 验证层 | ✅ | `validate.ts`: FUNERAL_PYRE_HEAL → 检查主动事件区存在、skip 直接通过、非 skip 检查充能>0+目标有单位+目标有伤害 |
| UI层 | ✅ | `useEventCardModes.ts`: useEffect 检测主动区有充能的殉葬火堆 → setFuneralPyreMode；StatusBanners 显示治疗提示+跳过按钮；点击受伤单位 → FUNERAL_PYRE_HEAL |
| i18n层 | ✅ | zh-CN: statusBanners.funeralPyre.message, actionLog.funeralPyreSkip/funeralPyreHeal, actionLog.funeralPyreCharged；en: 对应条目均存在 |
| 测试层 | ✅ | `abilities-advanced.test.ts`: 3个测试覆盖充能+治疗+跳过全链路（命令→事件→状态变更）；`reduce.test.ts`: FUNERAL_PYRE_CHARGED 2个测试；`validate.test.ts`: FUNERAL_PYRE_HEAL 5个测试；`flowHooks.test.ts`: 3个测试覆盖弃置时机 |

---

## 事件卡 3：除灭（NECRO_ANNIHILATE）

### 第零步：锁定权威描述

**来源**：`config/factions/necromancer.ts` → `EVENT_CARDS[2].effect`
> 指定任意数量的友方单位为目标。对于每个目标，你可以对其相邻的一个单位造成2点伤害。消灭所有目标。

**卡牌属性**：费用 0，施放阶段 move（移动阶段），普通事件

### 第一步：拆分独立交互链

#### 交互链 A：选择友方单位目标（多选）
**触发条件**：移动阶段，玩家从手牌施放
**原子步骤**：
1. 「指定任意数量的友方单位为目标」→ annihilateMode selectTargets 步骤，过滤非召唤师

#### 交互链 B：为每个目标选择伤害目标（可选）
**触发条件**：确认友方目标后
**原子步骤**：
1. 「对于每个目标」→ 逐个遍历 selectedTargets
2. 「你可以」→ **可选**，玩家可跳过（**本次修复：添加跳过按钮**）
3. 「对其相邻的一个单位造成2点伤害」→ 高亮相邻有单位的格子 → UNIT_DAMAGED(damage=2, source='annihilate')

#### 交互链 C：消灭所有目标
**触发条件**：伤害分配完成后
**原子步骤**：
1. 「消灭所有目标」→ 对每个 selectedTarget 发射 emitDestroyWithTriggers

### 自检

| 原文片段 | 覆盖链 |
|----------|--------|
| 指定任意数量的友方单位为目标 | A-1 |
| 对于每个目标 | B-1 |
| 你可以 | B-2 |
| 对其相邻的一个单位造成2点伤害 | B-3 |
| 消灭所有目标 | C-1 |

✅ 原文每句话均被覆盖。

### 第二步：八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `necromancer.ts`: id='necro-annihilate', cost=0, playPhase='move' |
| 注册层 | ✅ | `ids.ts`: CARD_IDS.NECRO_ANNIHILATE；`eventCards.ts` switch-case 匹配 |
| 执行层 | ✅ | `eventCards.ts`: 先遍历 targets 对 damageTargets 造成2伤害（检查 damageTarget 非 null），再遍历 targets 消灭友方单位（emitDestroyWithTriggers）。**执行顺序正确**：先伤害后消灭 ✅。damageTarget 为 null 时跳过伤害 ✅ |
| 状态层 | ✅ | `reduce.ts`: UNIT_DAMAGED → 增加 damage；UNIT_DESTROYED → 弃置卡牌+魔力奖励（友方消灭不奖励魔力，因为 killerPlayerId === owner） |
| 验证层 | ✅ | `validate.ts`: PLAY_EVENT 通用验证（费用0、阶段 move） |
| UI层 | ✅ | `useEventCardModes.ts`: annihilateMode 三步流程（selectTargets→selectDamageTarget→提交）；StatusBanners 显示选择提示+确认/跳过/取消按钮（**本次修复：添加 selectDamageTarget 跳过按钮**） |
| i18n层 | ✅ | zh-CN: statusBanners.annihilate.selectTargets/selectDamageTarget；en: 对应条目存在 |
| 测试层 | ⚠️ | 无独立的除灭执行测试（选择目标→伤害分配→消灭全链路）。建议后续补充 |

---

## 事件卡 4：血契召唤（NECRO_BLOOD_SUMMON）

### 第零步：锁定权威描述

**来源**：`config/factions/necromancer.ts` → `EVENT_CARDS[3].effect`
> 结算以下效果任意次数：指定一个友方单位为目标。从你的手牌选择一个费用为2点或更低的单位，放置到目标相邻的区格。对目标造成2点伤害。

**卡牌属性**：费用 0，施放阶段 summon（召唤阶段），普通事件

### 第一步：拆分独立交互链

#### 交互链 A：单次血契召唤流程（可重复）
**触发条件**：召唤阶段，玩家从手牌施放
**原子步骤**：
1. 「指定一个友方单位为目标」→ bloodSummonMode selectTarget 步骤
2. 「从你的手牌选择一个费用为2点或更低的单位」→ selectCard 步骤，过滤 cost≤2
3. 「放置到目标相邻的区格」→ selectPosition 步骤，高亮目标相邻空格
4. 「对目标造成2点伤害」→ UNIT_DAMAGED(damage=2, reason='blood_summon')
5. 「结算以下效果任意次数」→ confirm 步骤提供"继续"按钮

### 自检

| 原文片段 | 覆盖链 |
|----------|--------|
| 结算以下效果任意次数 | A-5 |
| 指定一个友方单位为目标 | A-1 |
| 从你的手牌选择一个费用为2点或更低的单位 | A-2 |
| 放置到目标相邻的区格 | A-3 |
| 对目标造成2点伤害 | A-4 |

✅ 原文每句话均被覆盖。

### 第二步：八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `necromancer.ts`: id='necro-blood-summon', cost=0, playPhase='summon' |
| 注册层 | ✅ | `ids.ts`: CARD_IDS.NECRO_BLOOD_SUMMON；`types.ts`: SW_COMMANDS.BLOOD_SUMMON_STEP 独立命令 |
| 执行层 | ✅ | `execute.ts` BLOOD_SUMMON_STEP: 验证友方单位+手牌单位 → UNIT_SUMMONED(position) → UNIT_DAMAGED(damage=2, reason='blood_summon') → 自动死亡检测（postProcessDeathChecks）。**限定条件全程约束**：cost≤2 在 validate 中检查，相邻在 validate 中检查 ✅ |
| 状态层 | ✅ | `reduce.ts`: UNIT_SUMMONED → 从手牌移除+放置到棋盘；UNIT_DAMAGED → 增加 damage |
| 验证层 | ✅ | `validate.ts` BLOOD_SUMMON_STEP: 阶段=summon、友方单位存在、手牌单位存在且 cardType=unit、cost≤2、相邻、空格。**限定条件全程约束** ✅ |
| UI层 | ✅ | `useEventCardModes.ts`: bloodSummonMode 四步流程（selectTarget→selectCard→selectPosition→confirm）；首次使用时先发送 PLAY_EVENT 再发送 BLOOD_SUMMON_STEP；confirm 步骤提供"继续"按钮 |
| i18n层 | ✅ | zh-CN: statusBanners.bloodSummon.selectTarget/selectCard/selectPosition/confirm, handArea.bloodSummonOnlyLowCost；en: 对应条目均存在 |
| 测试层 | ✅ | `validate.test.ts`: BLOOD_SUMMON_STEP 5个测试（阶段拒绝、无友方拒绝、费用>2拒绝、非相邻拒绝、正常通过）；`boundaryEdgeCases.test.ts`: 费用边界测试（cost=0/2/3） |

---

## 第三步：grep 消费点

已在前序审计中完成全局 grep。本次事件卡涉及的关键消费点：
- `hasHellfireBlade` → 仅在 `execute.ts` 攻击后和 `abilityResolver.ts` calculateEffectiveStrength 中使用 ✅
- `attachedCards` → `reduce.ts` EVENT_ATTACHED 写入、UNIT_DESTROYED 弃置（本次修复）、`abilityResolver.ts` 战力计算 ✅
- `getFuneralPyreChargeEvents` → `execute.ts` 后处理中调用 ✅

## 第四步：交叉影响检查

1. **狱火铸剑 + 献祭**：地狱火教徒附加狱火铸剑后被消灭 → 献祭触发（相邻敌方1伤）+ 狱火铸剑弃置。无冲突 ✅
2. **殉葬火堆 + 除灭**：除灭消灭多个友方单位 → 每个消灭触发殉葬火堆充能。execute.ts 后处理按 UNIT_DESTROYED 数量逐个充能 ✅
3. **血契召唤 + 殉葬火堆**：血契召唤对目标造成2伤害可能导致目标死亡 → 触发殉葬火堆充能 ✅
4. **狱火铸剑 + 不屈不挠**：附加狱火铸剑的士兵被消灭 → 不屈不挠返回手牌（仅返回单位卡，狱火铸剑弃置）✅

## 第五步：数据查询一致性

狱火铸剑的 +2 战力通过 `calculateEffectiveStrength` 中的 `attachedCards` 检查实现，不走 `getUnitAbilities`。这是合理的，因为狱火铸剑不是技能而是附加事件卡效果。所有攻击流程都通过 `calculateEffectiveStrength` 获取战力 ✅

## 修复清单

### 修复 1：附加事件卡弃置（medium）
**文件**：`src/games/summonerwars/domain/reduce.ts`
**问题**：UNIT_DESTROYED 处理中只弃置 `attachedUnitCards`（附加单位卡），未弃置 `attachedCards`（附加事件卡如狱火铸剑）
**修复**：在所有弃置路径中追加 `...attachedEventCards`（4处）

### 修复 2：除灭跳过伤害按钮（medium）
**文件**：`src/games/summonerwars/ui/StatusBanners.tsx`、`src/games/summonerwars/Board.tsx`
**问题**：除灭 selectDamageTarget 步骤无跳过按钮，但描述中"你可以"表示伤害分配是可选的
**修复**：添加 `onSkipAnnihilateDamage` 回调和跳过按钮，跳过时 damageTargets 对应位置设为 null
