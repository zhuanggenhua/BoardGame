# 引擎层方案 vs 游戏层实现对比

## 概述

DiceThrone 护盾 bug 修复后，引擎层新增了通用辅助函数。本文档对比引擎层提供的方案和 DiceThrone 当前实现的差异。

---

## 核心差异总结

| 维度 | DiceThrone 当前实现 | 引擎层通用方案 | 评价 |
|------|-------------------|--------------|------|
| **最终伤害计算** | 手动计算（基于当前事件） | `calculateTotalDamageFromEvents()` | 游戏层更精确 |
| **护盾处理** | 游戏特化逻辑（百分比+固定值） | 不处理（由 reducer 统一） | 游戏层必须特化 |
| **累计伤害统计** | 手动从事件流计算 | `calculateTotalDamageFromEvents()` | 引擎层更通用 |
| **代码复杂度** | 高（~100 行） | 低（~10 行） | 引擎层更简洁 |
| **适用场景** | DiceThrone 特有机制 | 通用场景 | 各有优势 |

---

## 详细对比

### 1. 最终伤害计算

#### DiceThrone 当前实现（游戏特化）

```typescript
// 手动计算百分比护盾减免
const shieldEvent = events.find(
    (e): e is DamageShieldGrantedEvent =>
        e.type === 'DAMAGE_SHIELD_GRANTED' &&
        e.payload.targetId === targetId &&
        e.payload.reductionPercent != null
);
const shieldPercent = shieldEvent?.payload.reductionPercent ?? 0;
const shieldAbsorbed = shieldPercent > 0 ? Math.ceil(rawDealt * shieldPercent / 100) : 0;
const dealtFromSameBatchShield = rawDealt - shieldAbsorbed;

// 手动计算固定值护盾消耗
const fixedShieldAbsorbed = shieldsConsumed?.reduce((sum, shield) => {
    return shield.value != null ? sum + shield.absorbed : sum;
}, 0) ?? 0;

// 最终伤害
const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
```

**特点**：
- ✅ 精确处理 DiceThrone 的双重护盾机制（百分比 + 固定值）
- ✅ 正确处理护盾处理顺序（百分比先，固定值后）
- ✅ 只依赖当前事件数据，撤回安全
- ⚠️ 游戏特化逻辑，其他游戏无法复用

#### 引擎层通用方案（不处理护盾）

```typescript
// 引擎层不提供护盾计算，因为护盾机制高度游戏特化
// 只提供累计伤害统计（用于其他场景）
const totalDamage = calculateTotalDamageFromEvents(events, targetId);
```

**特点**：
- ✅ 通用，适用于所有游戏
- ✅ 简洁，一行代码
- ❌ 不处理护盾（护盾由 reducer 统一处理）
- ❌ 不适用于 DiceThrone 的日志格式化场景

**结论**：DiceThrone 的护盾处理必须保持游戏特化实现，引擎层无法提供通用方案。

---

### 2. 累计伤害统计

#### DiceThrone 当前实现（隐式）

```typescript
// DiceThrone 没有显式统计累计伤害
// 而是在每个 DAMAGE_DEALT 事件中单独计算最终伤害
// 如果需要统计"本次攻击总伤害"，需要手动遍历事件
```

**问题**：
- ❌ 如果需要显示"本次攻击总伤害"，需要手动遍历事件
- ❌ 容易错误地依赖累计状态（`attackResolved.payload.totalDamage`）

#### 引擎层通用方案（显式）

```typescript
// 从事件流计算累计伤害（替代读取累计状态）
const totalDamage = calculateTotalDamageFromEvents(
    events,
    defenderId,
    // 可选：只统计特定来源的伤害
    (e) => e.payload.sourceAbilityId === 'fireball'
);
```

**优点**：
- ✅ 显式 API，意图清晰
- ✅ 支持过滤器，灵活
- ✅ 防止错误依赖累计状态
- ✅ 适用于所有游戏

**结论**：引擎层方案更通用，DiceThrone 可以在需要时使用。

---

### 3. 代码复杂度对比

#### DiceThrone 当前实现

```typescript
// 伤害日志格式化（~100 行）
if (event.type === 'DAMAGE_DEALT') {
    // 1. 提取数据（~10 行）
    const { targetId, amount, actualDamage, ... } = damageEvent.payload;
    
    // 2. 计算百分比护盾（~10 行）
    const shieldEvent = events.find(...);
    const shieldPercent = ...;
    const shieldAbsorbed = ...;
    
    // 3. 计算固定值护盾（~10 行）
    const fixedShieldAbsorbed = shieldsConsumed?.reduce(...);
    
    // 4. 计算最终伤害（~5 行）
    const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
    
    // 5. 构建 breakdown（~20 行）
    const breakdownSeg = buildDamageBreakdownSegment(...);
    
    // 6. 追加护盾行（~15 行）
    if (shieldsConsumed && shieldsConsumed.length > 0) { ... }
    
    // 7. 强制更新 displayText（~5 行）
    if (breakdownSeg.type === 'breakdown' && shieldsConsumed) { ... }
    
    // 8. 构建 segments（~25 行）
    let segments: ActionLogSegment[];
    if (isSelfDamage) { ... } else { ... }
}
```

**总计**：~100 行，高度游戏特化

#### 引擎层通用方案（假设场景）

```typescript
// 如果 DiceThrone 不需要特殊护盾处理（假设）
if (event.type === 'DAMAGE_DEALT') {
    const { targetId, actualDamage, sourceAbilityId } = event.payload;
    
    // 使用引擎层工具（~10 行）
    const breakdownSeg = buildDamageBreakdownSegment(
        actualDamage,
        event.payload,
        dtDamageSourceResolver,
        DT_NS
    );
    
    const segments = [
        i18nSeg('actionLog.damageBefore.dealt', { targetPlayerId: targetId }),
        breakdownSeg,
        i18nSeg('actionLog.damageAfter.dealt', { targetPlayerId: targetId }),
    ];
}
```

**总计**：~10 行，但不支持 DiceThrone 的护盾机制

**结论**：引擎层方案更简洁，但 DiceThrone 的护盾机制需要游戏特化实现。

---

## 为什么 DiceThrone 不能直接使用引擎层方案？

### 原因 1：护盾机制高度游戏特化

DiceThrone 的护盾有两种类型：
1. **百分比护盾**（`reductionPercent`）：基于基础伤害计算，先处理
2. **固定值护盾**（`value`）：吸收剩余伤害，后处理

这种双重护盾机制是 DiceThrone 特有的，其他游戏（SmashUp/SummonerWars）没有。

### 原因 2：护盾消耗信息需要回填

DiceThrone 的 reducer 层会将护盾消耗信息回填到事件 payload（`shieldsConsumed`），日志层需要读取这些信息来显示护盾减免明细。

这种"reducer 回填 → 日志读取"的模式是 DiceThrone 特有的。

### 原因 3：最终伤害需要手动计算

由于护盾处理顺序的复杂性，DiceThrone 必须手动计算最终伤害：
```typescript
const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
```

引擎层的 `calculateTotalDamageFromEvents()` 只能统计 `actualDamage`，无法处理这种复杂计算。

---

## 引擎层方案的适用场景

### ✅ 适用场景

1. **统计累计伤害**（替代读取累计状态）
   ```typescript
   // 显示"本次攻击总伤害"
   const totalDamage = calculateTotalDamageFromEvents(events, defenderId);
   ```

2. **统计累计治疗**
   ```typescript
   // 显示"本回合总治疗量"
   const totalHealing = calculateTotalHealingFromEvents(events, playerId);
   ```

3. **统计资源变化**
   ```typescript
   // 显示"本回合获得的 CP"
   const totalCp = calculateTotalResourceChangeFromEvents(events, 'CP_CHANGED', playerId);
   ```

4. **简单伤害日志**（无护盾/修改器）
   ```typescript
   // 使用 buildDamageBreakdownSegment 构建 breakdown
   const breakdownSeg = buildDamageBreakdownSegment(
       damage,
       event.payload,
       resolver,
       ns
   );
   ```

### ❌ 不适用场景

1. **复杂护盾机制**（如 DiceThrone 的双重护盾）
2. **需要手动计算最终伤害**（如护盾处理顺序）
3. **需要读取 reducer 回填的信息**（如 `shieldsConsumed`）

---

## 建议

### 对 DiceThrone

**保持当前实现**：
- ✅ 护盾处理逻辑必须保持游戏特化
- ✅ 最终伤害计算必须手动实现
- ⚠️ 可选：使用 `calculateTotalDamageFromEvents()` 统计累计伤害（如果需要）

**示例**：如果需要显示"本次攻击总伤害"
```typescript
// 在 ATTACK_RESOLVED 日志中添加
const totalDamage = calculateTotalDamageFromEvents(
    events,
    attackResolved.payload.defenderId
);
// 显示：对 {defenderId} 造成总计 {totalDamage} 点伤害
```

### 对其他游戏

**优先使用引擎层方案**：
- ✅ 使用 `buildDamageBreakdownSegment()` 构建 breakdown
- ✅ 使用 `calculateTotalDamageFromEvents()` 统计累计伤害
- ✅ 使用 `calculateTotalHealingFromEvents()` 统计累计治疗
- ❌ 避免依赖累计状态（`payload.total*`）

**示例**：SmashUp 的伤害日志
```typescript
if (event.type === 'DAMAGE_DEALT') {
    const breakdownSeg = buildDamageBreakdownSegment(
        event.payload.damage,
        event.payload,
        smashUpDamageSourceResolver,
        SMASHUP_NS
    );
    
    const segments = [
        i18nSeg('actionLog.damageBefore.dealt'),
        breakdownSeg,
        i18nSeg('actionLog.damageAfter.dealt'),
    ];
}
```

---

## 总结

### 核心发现

1. **DiceThrone 的实现是正确的**
   - 护盾处理必须游戏特化
   - 最终伤害计算必须手动实现
   - 不能直接使用引擎层通用方案

2. **引擎层方案是补充，不是替代**
   - 提供通用工具（累计统计、简单 breakdown）
   - 不强制使用，游戏层可选
   - 防止错误依赖累计状态

3. **两者互补，各有优势**
   - 引擎层：通用、简洁、防错
   - 游戏层：精确、灵活、特化

### 最佳实践

**新增游戏时**：
1. 优先使用引擎层工具（`buildDamageBreakdownSegment` 等）
2. 如果有特殊机制（如护盾），游戏层特化实现
3. 避免依赖累计状态，使用 `calculateTotalDamageFromEvents` 替代

**修改现有游戏时**：
- DiceThrone：保持当前实现，不需要迁移
- SmashUp/SummonerWars：可选迁移到引擎层工具（降低复杂度）

### 关键原则

**引擎层提供工具，不强制约束**：
- ✅ 提供最佳实践辅助函数
- ✅ 文档化反模式
- ❌ 不强制使用
- ❌ 不修改引擎核心

**游戏层保持灵活性**：
- ✅ 可以使用引擎层工具
- ✅ 可以游戏特化实现
- ✅ 可以混合使用
- ❌ 不依赖累计状态

---

## 相关文档

- [累计状态解决方案分析](../archive/reports/cumulative-state-solution-history.md)
- [护盾撤回修复说明](./dicethrone/dicethrone-shield-undo-fix.md)
- [累计状态污染分析](./undo-cumulative-state-pattern.md)
- [引擎系统规范](../../.spec/knowledge/standards/engine-systems.md)
