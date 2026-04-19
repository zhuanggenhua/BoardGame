# DiceThrone 焚灭变体选择问题 - 调试日志

## 问题描述

用户反馈：DiceThrone 游戏中无法选择"焚灭"(Incinerate)变体。Hot Streak II 有两个变体：
1. `fiery-combo-2`（小顺子）
2. `incinerate`（焚灭，2火+2炽魂）

当两个变体的触发条件都满足时，应该弹出选择窗口让玩家选择使用哪个变体，但实际上没有弹出。

## 变体选择逻辑

### 触发条件

变体选择窗口的触发条件（`Board.tsx` 第 1086 行）：
1. 当前阶段是 `offensiveRoll`（进攻阶段）
2. 骰子已确认（`G.rollConfirmed === true`）
3. 同一个技能槽位有 2 个或更多可用变体
4. 这些变体是"分歧型"（通过 `hasDivergentVariants` 判断）

### 分歧型判断逻辑

`hasDivergentVariants` 函数（`Board.tsx` 第 83 行）判断变体是否为"分歧型"：

**增量型**（自动选最高优先级，不弹窗）：
- 所有 trigger 都是 `diceSet` 类型
- 骰面 key 集合相同（如都是 `fire`）
- effect 类型集合相同
- 只是数量递增（如 3火/4火/5火）

**分歧型**（弹窗选择）：
- trigger 类型不同（如 `smallStraight` vs `diceSet`）
- 骰面 key 集合不同（如 `fire` vs `fire,fierySoul`）
- effect 类型集合不同（如造伤害 vs 施加状态）

### Hot Streak II 的两个变体

1. **fiery-combo-2**（小顺子）：
   - trigger: `{ type: 'smallStraight' }`
   - effects: 获得 2 FM + 消耗所有 FM 造成伤害

2. **incinerate**（焚灭）：
   - trigger: `{ type: 'diceSet', faces: { fire: 2, fierySoul: 2 } }`
   - effects: 获得 2 FM + 施加燃烧 + 造成 6 点伤害

**判断结果**：trigger 类型不同（`smallStraight` vs `diceSet`），应该被判定为"分歧型"，会弹出选择窗口。

## 可能的原因

### 1. 骰子未确认

如果 `G.rollConfirmed === false`，变体选择逻辑不会触发。

### 2. 技能槽位映射错误

如果 `getAbilitySlotId(baseAbilityId)` 返回 `null`，或者 `ABILITY_SLOT_MAP[slotId]` 不存在，变体选择逻辑不会触发。

### 3. 可用变体列表为空

如果 `availableAbilityIdsForRoller` 中没有包含两个变体，变体选择逻辑不会触发。

### 4. 变体归属判断错误

如果 `mapping.ids.includes(match.ability.id)` 判断错误，导致 `slotVariants` 中只有一个变体，变体选择逻辑不会触发。

## 已添加调试日志

在 `Board.tsx` 的 `onSelectAbility` 回调中添加了详细的日志：

### 日志 1：技能选择触发
```typescript
console.log('[Board] 🔵 onSelectAbility called', {
    abilityId,
    currentPhase,
    rollConfirmed: G.rollConfirmed
});
```

### 日志 2：变体检查
```typescript
console.log('[Board] 🔵 Variant check', {
    abilityId,
    baseAbilityId,
    slotId,
    hasMatch: !!match
});
```

### 日志 3：槽位变体列表
```typescript
console.log('[Board] 🔵 Slot variants', {
    slotId,
    slotVariants,
    availableAbilityIdsForRoller
});
```

### 日志 4：弹出选择窗口
```typescript
console.log('[Board] 🟢 Multiple divergent variants found, showing choice modal');
```

## 如何使用日志排查

1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 投出满足两个变体触发条件的骰子（小顺子 + 2火+2炽魂）
4. 确认骰子
5. 点击 Hot Streak II 技能槽位
6. 查看控制台日志

### 预期日志流程

如果一切正常，应该看到以下日志：

```
[Board] 🔵 onSelectAbility called { abilityId: 'fiery-combo-2' 或 'incinerate', currentPhase: 'offensiveRoll', rollConfirmed: true }
[Board] 🔵 Variant check { abilityId: '...', baseAbilityId: 'fiery-combo', slotId: 'hot-streak', hasMatch: true }
[Board] 🔵 Slot variants { slotId: 'hot-streak', slotVariants: ['fiery-combo-2', 'incinerate'], availableAbilityIdsForRoller: [...] }
[Board] 🟢 Multiple divergent variants found, showing choice modal
```

### 可能的异常情况

#### 情况 1：没有任何日志
- 原因：`onSelectAbility` 回调没有被触发
- 可能：技能槽位点击事件被拦截或禁用

#### 情况 2：只有日志 1，没有日志 2
- 原因：`currentPhase !== 'offensiveRoll'` 或 `G.rollConfirmed === false`
- 解决：确认当前阶段和骰子确认状态

#### 情况 3：有日志 1 和 2，没有日志 3
- 原因：`slotId` 为 `null` 或 `mapping` 不存在
- 解决：检查 `getAbilitySlotId` 和 `ABILITY_SLOT_MAP`

#### 情况 4：有日志 1、2、3，但 `slotVariants` 只有一个元素
- 原因：`availableAbilityIdsForRoller` 中只有一个变体
- 解决：检查 `getAvailableAbilityIds` 函数

#### 情况 5：有日志 1、2、3，`slotVariants` 有两个元素，但没有日志 4
- 原因：`hasDivergentVariants` 返回 `false`
- 解决：检查 `hasDivergentVariants` 函数的判断逻辑

## 下一步

等待用户反馈控制台日志，确定具体原因。

## 相关文件

- `src/games/dicethrone/Board.tsx` - 变体选择逻辑
- `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 火法技能定义
- `src/games/dicethrone/domain/rules.ts` - 可用技能计算逻辑


## 第一轮排查结果

### 用户日志

```
[Board] 🔵 onSelectAbility called {abilityId: 'fiery-combo-2', currentPhase: 'offensiveRoll', rollConfirmed: true}
[Board] 🔵 Variant check {abilityId: 'fiery-combo-2', baseAbilityId: 'fiery-combo', slotId: 'sky', hasMatch: true}
[Board] 🔵 Slot variants {slotId: 'sky', slotVariants: Array(1), availableAbilityIdsForRoller: Array(2)}
```

### 问题分析

1. ✅ `onSelectAbility` 被正确触发
2. ✅ `currentPhase === 'offensiveRoll'` 且 `rollConfirmed === true`
3. ✅ `baseAbilityId === 'fiery-combo'` 正确
4. ✅ `slotId === 'sky'` 正确（`ABILITY_SLOT_MAP['sky'].ids` 包含 `'fiery-combo'`）
5. ❌ **问题**：`slotVariants` 只有 1 个元素，但 `availableAbilityIdsForRoller` 有 2 个元素

### 根本原因

`slotVariants` 的过滤逻辑有问题：

```typescript
const slotVariants = availableAbilityIdsForRoller.filter(id => {
    const match = findPlayerAbility(G, rollerId, id);
    if (!match) return false;
    return mapping.ids.includes(match.ability.id);
});
```

这个逻辑检查 `match.ability.id` 是否在 `mapping.ids` 中。

**可能的原因**：
- `'fiery-combo-2'` 的 `match.ability.id` 是 `'fiery-combo'` ✅
- `'incinerate'` 的 `match.ability.id` 可能不是 `'fiery-combo'` ❌

如果 `'incinerate'` 被定义为独立的技能（而不是 `fiery-combo` 的变体），那么 `match.ability.id` 就不是 `'fiery-combo'`，导致过滤失败。

### 已添加更详细的日志

在过滤逻辑中添加了详细的日志：

```typescript
console.log('[Board] 🔵 Checking variant', {
    variantId: id,
    abilityId: match.ability.id,
    mappingIds: mapping.ids,
    included
});
```

这会显示每个变体的 `abilityId` 和是否被包含在 `mapping.ids` 中。

## 下一步

请再次点击 Hot Streak II 技能槽位，查看新的日志，特别是 `🔵 Checking variant` 日志。
