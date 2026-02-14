# 审计报告 2.3：召唤、建造、魔力、抽牌机制

## 第零步：锁定权威描述

来源：`src/games/summonerwars/rule/召唤师战争规则.md`

### 召唤机制
> 从你的手牌中召唤任意数量的单位到战场上。要召唤一个单位：
> 1. 支付其费用，消耗等同于单位费用的魔力值
> 2. 将单位放置在你控制的城门相邻的空格上
> 召唤的单位立即可用（无召唤延迟）

### 建造机制
> 从你的手牌中建造任意数量的城门或其他建筑到战场上。要建造一个建筑：
> 1. 支付其费用
> 2. 将其放置在你的召唤师相邻的空格上，或者在你的后方3行

### 魔力机制
> 魔力轨道：0-15
> 魔力阶段：从你的手牌中弃置任意数量的卡牌（面朝下）。每弃置一张卡牌，获得1点魔力。
> 摧毁敌方卡牌：每次你摧毁一张敌方卡牌时，获得1点魔力。

### 抽牌机制
> 如果你的手牌少于5张，抽牌至5张。
> 如果抽牌堆不足，先抽完剩余卡牌，然后停止（不洗混弃牌堆）。
> 如果抽牌堆为空，无法抽牌。

---

## 第一步：拆分独立交互链

### 召唤机制
- **链 S1**：支付魔力费用（扣除 cost 点魔力）
- **链 S2**：将单位放置到城门相邻空格（含活体传送门 living_gate）
- **链 S3**：召唤无延迟（立即可用）

### 建造机制
- **链 B1**：支付魔力费用
- **链 B2**：放置到召唤师相邻或后方3行空格

### 魔力机制
- **链 M1**：弃牌换魔力（每张+1，上限15）
- **链 M2**：摧毁敌方+1魔力（在 UNIT_DESTROYED/STRUCTURE_DESTROYED 中处理）

### 抽牌机制
- **链 D1**：手牌<5时抽牌至5张
- **链 D2**：牌库不足时只抽剩余
- **链 D3**：牌库空时不抽牌，不洗混弃牌堆

### 自检
原文每句话均被覆盖。✅

---

## 第二步：逐链追踪八层

### 一、召唤机制

#### 链 S1：支付魔力费用

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `UnitCard.cost` 定义在 `types.ts`，数值来自阵营配置 |
| 注册层 | ✅ | `SW_COMMANDS.SUMMON_UNIT` 注册在 `game.ts` commandTypes |
| 执行层 | ✅ | `execute.ts` L89-100：`unitCard.cost > 0` 时发射 `MAGIC_CHANGED { delta: -cost }` |
| 状态层 | ✅ | `reduce.ts` `MAGIC_CHANGED`：`clampMagic(player.magic + delta)` 正确扣除 |
| 验证层 | ✅ | `validate.ts` L107：`hasEnoughMagic(core, playerId, unitCard.cost)` 检查魔力充足 |
| UI层 | ✅ | `useCellInteraction.ts` L103-143：`validSummonPositions` 计算合法位置，`hasAvailableActions` 检查是否有可召唤单位 |
| i18n层 | ✅ | zh-CN/en 均有 `phaseDesc.summon` 描述 |
| 测试层 | ✅ | `validate.test.ts` 覆盖魔力不足拒绝；`flow.test.ts` 覆盖召唤流程；`boundaryEdgeCases.test.ts` 覆盖城门全满 |

#### 链 S2：城门相邻放置（含活体传送门）

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `getValidSummonPositions` 在 `helpers.ts` L355-388 |
| 注册层 | ✅ | 同上 |
| 执行层 | ✅ | `execute.ts` 发射 `UNIT_SUMMONED { position }` |
| 状态层 | ✅ | `reduce.ts` `UNIT_SUMMONED`：在 `newBoard[position.row][position.col]` 放置单位，从手牌移除 |
| 验证层 | ✅ | `validate.ts` L130-148：计算 validPositions（含重燃希望扩展、编织颂歌扩展），检查 position 在合法列表中 |
| UI层 | ✅ | `useCellInteraction.ts` 计算 `validSummonPositions`（含重燃希望/编织颂歌扩展），`BoardGrid.tsx` 高亮合法格子 |
| i18n层 | ✅ | 有"放置在城门相邻的空格"描述 |
| 测试层 | ✅ | `validate.test.ts` 覆盖无效位置拒绝；`boundaryEdgeCases.test.ts` 覆盖城门全满；`abilities-barbaric.test.ts` 覆盖编织颂歌扩展 |

**`getValidSummonPositions` 实现审查**：
- 遍历玩家所有城门（`getPlayerGates`），收集相邻空格 ✅
- 遍历拥有 `living_gate` 技能的单位（通过 `getUnitAbilities(u, state)` 查询，含交缠共享），收集相邻空格 ✅
- 使用 Set 去重 ✅
- 使用 `isCellEmpty` 检查空格 ✅

#### 链 S3：召唤无延迟

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 状态层 | ✅ | `reduce.ts` `UNIT_SUMMONED`：新单位 `hasMoved: false, hasAttacked: false`，当回合可移动和攻击 |

---

### 二、建造机制

#### 链 B1：支付魔力费用

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `StructureCard.cost` 定义在 `types.ts` |
| 注册层 | ✅ | `SW_COMMANDS.BUILD_STRUCTURE` 注册在 `game.ts` commandTypes |
| 执行层 | ✅ | `execute.ts` L137-160：`structureCard.cost > 0` 时发射 `MAGIC_CHANGED { delta: -cost }` |
| 状态层 | ✅ | `reduce.ts` `MAGIC_CHANGED`：正确扣除 |
| 验证层 | ✅ | `validate.ts` L162：`hasEnoughMagic(core, playerId, structureCard.cost)` |
| UI层 | ✅ | `useCellInteraction.ts` L144-149：`validBuildPositions` 计算合法位置 |
| i18n层 | ✅ | zh-CN/en 均有 `phaseDesc.build` 描述 |
| 测试层 | ✅ | `validate.test.ts` 覆盖非建造阶段拒绝、无效卡牌拒绝；`boundaryEdgeCases.test.ts` 覆盖建造位置全满 |

#### 链 B2：召唤师相邻或后方3行

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `getValidBuildPositions` 在 `helpers.ts` L399-427 |
| 执行层 | ✅ | `execute.ts` 发射 `STRUCTURE_BUILT { position }` |
| 状态层 | ✅ | `reduce.ts` `STRUCTURE_BUILT`：在棋盘放置建筑，从手牌移除 |
| 验证层 | ✅ | `validate.ts` L163-166：检查 position 在 `getValidBuildPositions` 返回的列表中 |
| UI层 | ✅ | `useCellInteraction.ts` 使用 `getValidBuildPositions` 计算高亮 |
| 测试层 | ✅ | `boundaryEdgeCases.test.ts` 覆盖建造位置全满 |

**`getValidBuildPositions` 实现审查**：
- `getPlayerBackRows('0')` → `[5, 6, 7]`（底部3行）✅
- `getPlayerBackRows('1')` → `[0, 1, 2]`（顶部3行）✅
- 遍历后3行所有列，收集空格 ✅
- 召唤师相邻空格（去重后加入）✅
- 使用 `isCellEmpty` 检查 ✅

---

### 三、魔力机制

#### 链 M1：弃牌换魔力

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `SW_COMMANDS.DISCARD_FOR_MAGIC` 定义在 `types.ts` |
| 注册层 | ✅ | 注册在 `game.ts` commandTypes |
| 执行层 | ✅ | `execute.ts` L653-672：过滤有效卡牌 ID，发射 `MAGIC_CHANGED { delta: validCards.length }` + 逐张 `CARD_DISCARDED` |
| 状态层 | ✅ | `reduce.ts` `MAGIC_CHANGED`：`clampMagic(magic + delta)` 确保不超过15；`CARD_DISCARDED`：从手牌移到弃牌堆 |
| 验证层 | ⚠️ | **缺少 validate 校验**：`validate.ts` 没有 `DISCARD_FOR_MAGIC` case，走 `default: return { valid: true }`。理论上可在非魔力阶段发送此命令。但 execute 层只过滤有效卡牌 ID，不检查阶段。**风险等级：低**——UI 层只在魔力阶段显示弃牌按钮，联机模式下恶意客户端可绕过。 |
| UI层 | ✅ | `useCellInteraction.ts` L716-720：`handleConfirmDiscard` 发送命令，仅在魔力阶段可见 |
| i18n层 | ✅ | zh-CN/en 均有 `phaseDesc.magic` 描述 |
| 测试层 | ✅ | `flow.test.ts` 覆盖弃牌换魔力（0魔力弃牌、多张弃牌、上限15、不弃牌跳过、无效卡牌ID）；`boundaryEdgeCases.test.ts` 覆盖空列表和无效ID |

**`clampMagic` 实现审查**：
- `Math.max(0, Math.min(15, value))` ✅
- MAGIC_MIN = 0, MAGIC_MAX = 15 ✅

#### 链 M2：摧毁敌方+1魔力

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 状态层 | ✅ | `reduce.ts` `UNIT_DESTROYED`：`killerPlayerId !== actualOwner && !skipMagicReward` 时 `clampMagic(magic + 1)` |
| 状态层 | ✅ | `reduce.ts` `STRUCTURE_DESTROYED`：同上逻辑 |
| 测试层 | ✅ | `boundaryEdgeCases.test.ts` 覆盖击杀奖励使魔力超过15上限时被钳制 |

---

### 四、抽牌机制

#### 链 D1：手牌<5时抽牌至5张

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `getDrawCount` 在 `helpers.ts` L528-531：`Math.max(0, HAND_SIZE - handSize)`，HAND_SIZE = 5 |
| 执行层 | ✅ | `execute.ts` L726-735（END_PHASE draw 阶段）：`drawCount = Math.max(0, HAND_SIZE - player.hand.length)`，`actualDraw = Math.min(drawCount, player.deck.length)` |
| 执行层 | ✅ | `flowHooks.ts` L138-149（onPhaseExit draw）：同样逻辑，`drawCount = Math.max(0, HAND_SIZE - player.hand.length)`，`actualDraw = Math.min(drawCount, player.deck.length)` |
| 状态层 | ✅ | `reduce.ts` `CARD_DRAWN`：`drawFromTop(player.deck, count)` 从牌库顶部抽取，加入手牌 |
| UI层 | ✅ | 抽牌阶段自动执行，`hasAvailableActions` 对 draw 阶段返回 `false`（自动跳过） |
| i18n层 | ✅ | zh-CN/en 均有 `phaseDesc.draw` 描述 |
| 测试层 | ✅ | `flowHooks.test.ts` 覆盖抽牌阶段退出自动抽牌；`boundaryEdgeCases.test.ts` 覆盖牌库恰好等于需求量、手牌已满、手牌超过5张 |

**注意**：抽牌逻辑在两处实现——`execute.ts` END_PHASE 和 `flowHooks.ts` onPhaseExit。`flowHooks` 是引擎层的阶段退出钩子，`execute.ts` 是命令执行层。两处逻辑一致，但存在冗余。经检查，实际运行时由 flowHooks 触发（引擎层优先），execute.ts 中的逻辑是备用路径。

#### 链 D2/D3：牌库不足/空时处理

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 执行层 | ✅ | `actualDraw = Math.min(drawCount, player.deck.length)` — 牌库不足时只抽剩余 |
| 执行层 | ✅ | `if (actualDraw > 0)` — 牌库空时不发射抽牌事件 |
| 状态层 | ✅ | `drawFromTop` 引擎原语正确处理不足情况 |
| 状态层 | ✅ | **不洗混弃牌堆**：代码中没有任何"洗混弃牌堆到牌库"的逻辑 ✅ |
| 测试层 | ✅ | `boundaryEdgeCases.test.ts` 覆盖牌库恰好等于需求量 |

---

## 第三步：grep 消费点

所有四个机制的核心函数（`getValidSummonPositions`、`getValidBuildPositions`、`clampMagic`、`getDrawCount`）在 validate/execute/UI 层均有正确消费。无遗漏。

## 第四步：交叉影响检查

- **重燃希望（PALADIN_REKINDLE_HOPE）**：扩展召唤位置到召唤师相邻，validate.ts 和 UI 层均正确处理 ✅
- **编织颂歌（BARBARIC_CHANT_OF_WEAVING）**：扩展召唤位置到目标单位相邻，validate.ts 和 UI 层均正确处理 ✅
- **活体传送门（living_gate）**：`getValidSummonPositions` 通过 `getUnitAbilities(u, state)` 查询（含交缠共享），正确扩展 ✅
- **无魂（soulless）**：摧毁疫病体时 `skipMagicReward: true`，reduce 层正确跳过魔力奖励 ✅
- **不屈不挠（GOBLIN_RELENTLESS）**：友方士兵被消灭返回手牌而非弃牌堆，不影响魔力奖励逻辑 ✅

## 第五步：数据查询一致性

- `getValidSummonPositions` 使用 `getUnitAbilities(u, state)` 查询 living_gate ✅
- 召唤/建造/魔力/抽牌机制不涉及 `.card.abilities`/`.card.strength`/`.card.life` 的直接访问（这些是战斗相关查询）

---

## 发现的问题

### 问题 1：DISCARD_FOR_MAGIC 缺少阶段验证（中等严重度）

- **严重度**：medium
- **类别**：logic_error
- **位置**：`domain/validate.ts` — 缺少 `SW_COMMANDS.DISCARD_FOR_MAGIC` case
- **描述**：`DISCARD_FOR_MAGIC` 命令在 `validate.ts` 中没有对应的 case，走 `default: return { valid: true }`。这意味着理论上可以在非魔力阶段发送弃牌换魔力命令。虽然 UI 层只在魔力阶段显示弃牌按钮，但联机模式下恶意客户端可绕过。
- **规则引用**：阶段5：魔力 — 弃牌换魔力只在魔力阶段执行
- **修复方案**：在 `validate.ts` 中添加 `DISCARD_FOR_MAGIC` case，检查当前阶段为 `magic`

---

## 总结

| 机制 | 链路数 | 全部 ✅ | 问题数 |
|------|--------|---------|--------|
| 召唤 | 3 | ✅ | 0 |
| 建造 | 2 | ✅ | 0 |
| 魔力 | 2 | ⚠️ | 1（DISCARD_FOR_MAGIC 缺少阶段验证） |
| 抽牌 | 3 | ✅ | 0 |
