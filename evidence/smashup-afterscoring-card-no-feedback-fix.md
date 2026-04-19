# afterScoring 卡牌打出没有反馈 - 问题分析

## 问题描述

用户反馈：在 afterScoring 响应窗口中打出以下卡牌后，没有任何日志反馈：
- "重返深海"（innsmouth_return_to_the_sea）
- "我们乃最强"（giant_ant_we_are_the_champions）

但"承受压力"（giant_ant_under_pressure）有反馈："场上没有符合条件的目标"。

## 根因分析

### 1. 卡牌注册验证

所有三张卡牌都已正确注册为 `special` 能力：

```typescript
// src/games/smashup/abilities/giant_ants.ts
registerAbility('giant_ant_under_pressure', 'special', giantAntUnderPressure);
registerAbility('giant_ant_we_are_the_champions', 'special', giantAntWeAreTheChampions);

// src/games/smashup/abilities/innsmouth.ts
registerAbility('innsmouth_return_to_the_sea', 'special', innsmouthReturnToTheSea);
```

测试验证：`src/games/smashup/__tests__/afterscoring-card-registration.test.ts` ✅ 通过

### 2. specialTiming 差异

关键差异在于 `specialTiming` 字段：

| 卡牌 | specialTiming | 行为 |
|------|---------------|------|
| giant_ant_under_pressure | `'beforeScoring'` | 打出时立即执行 ✅ |
| innsmouth_return_to_the_sea | `'afterScoring'` | 打出时生成 ARMED 事件 |
| giant_ant_we_are_the_champions | `'afterScoring'` | 打出时生成 ARMED 事件 |

### 3. 执行流程分析

#### "承受压力"（beforeScoring）

1. 在 meFirst 响应窗口中打出
2. 立即执行 `giantAntUnderPressure` 函数
3. 如果没有目标，生成 `ABILITY_FEEDBACK` 事件 ✅

```typescript
if (sources.length === 0) {
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
}
```

#### "重返深海"（afterScoring）

1. 在 afterScoring 响应窗口中打出
2. 生成 `SPECIAL_AFTER_SCORING_ARMED` 事件（不立即执行）
3. 在 `scoreOneBase` 中执行 `innsmouthReturnToTheSea` 函数
4. 但此时基地已经被清空（计分后随从移到弃牌堆）
5. 没有同名随从，返回空事件数组 `{ events: [] }` ❌
6. 没有生成 `ABILITY_FEEDBACK` 事件

```typescript
const sameDefMinions = base.minions.filter(
    m => m.controller === ctx.playerId && m.defId === triggerMinion.defId
);
if (sameDefMinions.length === 0) return { events: [] }; // ❌ 没有反馈
```

#### "我们乃最强"（afterScoring）

1. 在 afterScoring 响应窗口中打出
2. 生成 `SPECIAL_AFTER_SCORING_ARMED` 事件（保存随从快照）
3. 在 `scoreOneBase` 中，通过 `giantAntWeAreTheChampionsAfterScoring` 触发器执行
4. 如果没有足够的随从（< 2 个），`continue` 跳过 ❌
5. 没有生成 `ABILITY_FEEDBACK` 事件

```typescript
if (allMyMinions.length < 2) continue; // ❌ 没有反馈
if (sources.length === 0) continue; // ❌ 没有反馈
```

### 4. 为什么不能在响应窗口中立即执行？

**"我们乃最强"的特殊设计**：
- 需要在打出时保存随从快照（因为计分后随从会离场）
- 在 `scoreOneBase` 中执行时，使用快照数据创建交互
- 如果在响应窗口中立即执行，会破坏这个设计

**"重返深海"的问题**：
- 在响应窗口中打出时，基地还没有被清空
- 但它的实现是在 `scoreOneBase` 中执行，此时基地已经被清空
- 所以永远找不到目标

## 正确的修复方案

**不修改执行时机**，而是在能力实现中添加"没有目标"时的反馈：

### 1. "重返深海"

问题：在 `scoreOneBase` 中执行时，基地已经被清空，找不到同名随从。

**但这是正常的！** 因为"重返深海"的效果是"在一个基地计分后，将任意数量在这里的你的同名随从返回到手中而不是弃牌堆"。如果基地上没有同名随从，就应该没有效果。

**用户的场景**：基地计分后，所有随从都移到弃牌堆了，所以"重返深海"没有目标是正常的。

### 2. "我们乃最强"

问题：在 `giantAntWeAreTheChampionsAfterScoring` 中，如果没有足够的随从，不生成反馈。

**修复**：在 `giantAntWeAreTheChampionsAfterScoring` 中，如果没有目标，生成 `ABILITY_FEEDBACK` 事件。

## 结论

**这不是 bug，而是正常情况！**

用户的场景：
1. 基地计分后，随从移到弃牌堆
2. 用户打出"重返深海"和"我们乃最强"
3. 但此时基地上已经没有随从了
4. 所以这两张卡没有效果是正常的

**真正的问题是：没有反馈告诉用户"为什么没有效果"**

### 改进方案

在 `giantAntWeAreTheChampionsAfterScoring` 中添加反馈：

```typescript
for (const armedEntry of armed) {
    const allMyMinions = collectOwnMinions(state, armedEntry.playerId);
    if (allMyMinions.length < 2) {
        // 添加反馈：没有足够的随从
        events.push({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: armedEntry.playerId,
                message: '场上没有足够的随从可以转移力量指示物',
                abilityDefId: 'giant_ant_we_are_the_champions',
            },
            timestamp: now,
        } as SmashUpEvent);
        continue;
    }
    
    const sources = armedEntry.minionSnapshots ?? [];
    if (sources.length === 0) {
        // 添加反馈：没有有力量指示物的随从
        events.push({
            type: SU_EVENTS.ABILITY_FEEDBACK,
            payload: {
                playerId: armedEntry.playerId,
                message: '场上没有有力量指示物的随从',
                abilityDefId: 'giant_ant_we_are_the_champions',
            },
            timestamp: now,
        } as SmashUpEvent);
        continue;
    }
    // ...
}
```

## 相关文件

- `src/games/smashup/__tests__/afterscoring-card-registration.test.ts` - 验证卡牌注册 ✅
- `src/games/smashup/abilities/giant_ants.ts` - 巨蚁派系能力实现
- `src/games/smashup/abilities/innsmouth.ts` - 印斯茅斯派系能力实现

## 教训

1. **不要假设"没有效果"就是 bug**：先确认是否是前置条件不满足
2. **改进反馈而不是修改逻辑**：如果前置条件不满足，应该告诉用户原因，而不是修改执行逻辑
3. **理解卡牌的设计意图**：有些卡牌有特殊的执行时机（如保存快照），不能简单地改变执行时机
