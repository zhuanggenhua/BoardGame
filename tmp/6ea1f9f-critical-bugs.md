# Commit 6ea1f9f 严重 Bug 分析

## 概述

Commit 6ea1f9f (POD faction support) 引入了多个严重的 bug，主要是将 `powerCounters`（力量指示物）错误地替换为 `powerModifier`（临时力量修正）。

## 发现的 Bug

### 1. ✅ 已修复：Killer Queen talent 误删 `playedThisTurn` 过滤条件

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `giantAntKillerQueenTalent`

**问题**：
```typescript
// 错误（6ea1f9f）
.filter(m => m.controller === ctx.playerId)

// 正确（应该是）
.filter(m => m.controller === ctx.playerId && m.playedThisTurn && m.uid !== ctx.cardUid)
```

**影响**：允许选择非本回合打出的随从，且包含 Killer Queen 自己

**状态**：✅ 已修复

---

### 2. ❌ 未修复：兵蚁（Soldier）talent 检查错误字段

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `giantAntSoldierTalent`

**问题**：
```typescript
// 错误（6ea1f9f）
if (soldier.powerModifier < 1) {
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
}

// 正确（应该是）
if ((soldier.powerCounters ?? 0) < 1) {
    return { events: [buildAbilityFeedback(ctx.playerId, 'feedback.no_power_counters', ctx.now)] };
}
```

**影响**：
- 兵蚁 talent 检查的是临时力量修正而非力量指示物
- 即使有力量指示物，如果没有临时 buff 也会提示"没有力量指示物"
- 反之，如果有临时 buff 但没有力量指示物，会错误地允许激活

**卡牌描述**：兵蚁 talent 应该"移除此随从上的 1 个力量指示物，给另一个随从放置 1 个力量指示物"

---

### 3. ❌ 未修复：兵蚁 interaction handler 检查错误字段

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `handleSoldierChooseMinion`

**问题**：
```typescript
// 错误（6ea1f9f）
if (!soldier || !target || soldier.controller !== playerId || soldier.powerModifier < 1) 
    return { state, events: [] };

// 正确（应该是）
if (!soldier || !target || soldier.controller !== playerId || (soldier.powerCounters ?? 0) < 1) 
    return { state, events: [] };
```

**影响**：同上，交互响应时检查错误字段

---

### 4. ❌ 未修复：雄蜂（Drone）protection 检查错误字段

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `handleDronePreventDestroy`

**问题**：
```typescript
// 错误（6ea1f9f）
if (!drone || !target || drone.controller !== playerId || drone.powerModifier <= 0) {

// 正确（应该是）
if (!drone || !target || drone.controller !== playerId || (drone.powerCounters ?? 0) <= 0) {
```

**影响**：
- 雄蜂的保护能力检查错误字段
- 即使有力量指示物也无法触发保护（如果没有临时 buff）

**卡牌描述**：雄蜂 ongoing "你的一个随从被消灭时，你可以移除此随从上的 1 个力量指示物来防止"

---

### 5. ❌ 未修复：如同魔法（A Kind of Magic）收集错误字段

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `giantAntAKindOfMagic`

**问题**：
```typescript
// 错误（6ea1f9f）
count: ctx.state.bases[m.baseIndex]?.minions.find(x => x.uid === m.uid)?.powerModifier ?? 0,

// 正确（应该是）
count: ctx.state.bases[m.baseIndex]?.minions.find(x => x.uid === m.uid)?.powerCounters ?? 0,
```

**影响**：
- 移除的是临时力量修正而非力量指示物
- 重新分配的数量错误

**卡牌描述**："移除你所有随从上的所有力量指示物。将这些力量指示物重新分配到你的随从上"

---

### 6. ❌ 未修复：我们将震撼你（We Will Rock You）使用错误字段

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `giantAntWeWillRockYou`

**问题**：
```typescript
// 错误（6ea1f9f）
if (m.powerModifier <= 0) continue;
events.push(addTempPower(m.uid, i, m.powerModifier, 'giant_ant_we_will_rock_you', ctx.now));

// 正确（应该是）
if ((m.powerCounters ?? 0) <= 0) continue;
events.push(addTempPower(m.uid, i, m.powerCounters ?? 0, 'giant_ant_we_will_rock_you', ctx.now));
```

**影响**：
- 给予的临时力量基于当前临时力量而非力量指示物
- 完全违背卡牌效果

**卡牌描述**："直到回合结束，你的每个随从获得等同于其上力量指示物数量的 +力量"

---

### 7. ❌ 未修复：承受压力（Under Pressure）多处错误

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `giantAntUnderPressure` 及相关 handlers

**问题**：多处使用 `powerModifier` 替代 `powerCounters`

**影响**：
- 选项生成时检查错误字段
- 转移数量计算错误
- 标签显示错误数量

**卡牌描述**："从计分基地上你的一个随从转移任意数量的力量指示物到另一个基地上你的一个随从"

---

### 8. ❌ 未修复：我们乃最强（We Are The Champions）多处错误

**位置**：`src/games/smashup/abilities/giant_ants.ts` - `giantAntWeAreTheChampions` 及相关 handlers

**问题**：多处使用 `powerModifier` 替代 `powerCounters`

**影响**：
- 快照保存错误字段
- 转移数量计算错误
- 标签显示错误数量

**卡牌描述**："计分后：从此基地上你的一个随从转移任意数量的力量指示物到另一个基地上你的一个随从"

---

### 9. ❌ 未修复：海盗船长（Pirate King）talent 检查错误

**位置**：需要检查 `src/games/smashup/abilities/pirates.ts`

**问题**：可能也有类似的 `powerCounters` → `powerModifier` 错误替换

---

### 10. ❌ 未修复：其他派系可能的类似问题

需要全面检查所有使用力量指示物的派系能力。

## 根本原因

这个提交在添加 POD 支持时，错误地进行了全局替换，将所有 `powerCounters` 替换为 `powerModifier`，但这两个字段的语义完全不同：

- **powerCounters**：永久的力量指示物（存储在随从数据中，需要通过事件添加/移除）
- **powerModifier**：临时的力量修正（通常是 buff/debuff，回合结束清除，是计算属性）

## 修复优先级

### P0（立即修复）
1. ✅ Killer Queen `playedThisTurn` 过滤（已修复）
2. ❌ 兵蚁 talent 和 handler
3. ❌ 雄蜂 protection
4. ❌ 如同魔法
5. ❌ 我们将震撼你
6. ❌ 承受压力
7. ❌ 我们乃最强

### P1（尽快修复）
8. 检查海盗派系
9. 检查其他所有派系

## 修复策略

1. **立即回滚所有 `powerModifier` → `powerCounters` 的错误替换**
2. **运行完整的测试套件**，特别是巨蚁派系测试
3. **添加回归测试**，确保力量指示物和临时力量修正的区别
4. **审查整个提交**，查找其他可能的错误替换

## 测试覆盖

需要确保以下测试覆盖：
- [ ] 兵蚁 talent 需要力量指示物才能激活
- [ ] 雄蜂 protection 需要力量指示物才能触发
- [ ] 如同魔法正确移除和重新分配力量指示物
- [ ] 我们将震撼你基于力量指示物给予临时力量
- [ ] 承受压力正确转移力量指示物
- [ ] 我们乃最强正确转移力量指示物（计分后）

## 相关文件

- `src/games/smashup/abilities/giant_ants.ts` - 主要问题文件
- `src/games/smashup/__tests__/newFactionAbilities.test.ts` - 测试文件
- `src/games/smashup/domain/types.ts` - 类型定义
