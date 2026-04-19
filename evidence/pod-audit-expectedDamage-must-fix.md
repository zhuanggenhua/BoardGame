# POD 审计：expectedDamage 计算简化必须修复

## 发现时间
2026-03-09

## 结论
**必须恢复原始实现**，当前简化实现会导致伤害计算错误。

---

## 证据

### 证据 1：Reducer 中设置了 `pendingAttack.damage`

**位置**：`src/games/dicethrone/domain/reducer.ts:93-97`

```typescript
// 如果有 pendingDamageBonus，更新 pendingDamage.currentDamage（伏击等 Token 掷骰加伤）
if (pendingDamageBonus != null) {
    // ... 更新 pendingDamage ...
    
    // 同步更新 pendingAttack.damage
    if (pendingAttack) {
        pendingAttack = { ...pendingAttack, damage: (pendingAttack.damage ?? 0) + pendingDamageBonus };
    }
}
```

**说明**：
- 当 Token 掷骰加伤（如伏击 Token）时，reducer 会更新 `pendingAttack.damage`
- 这个修正后的伤害应该被用于 Token 响应判定
- 当前简化实现**忽略了这个修正**，直接使用 `getPlayerAbilityBaseDamage`

### 证据 2：原始实现优先使用 `pendingAttack.damage`

**位置**：`src/games/dicethrone/domain/utils.ts:46-66`

```typescript
export function getPendingAttackExpectedDamage(
    state: DiceThroneCore,
    pendingAttack: PendingAttack,
    fallbackWhenNoAbility: number = 0
): number {
    const { sourceAbilityId, attackerId, bonusDamage } = pendingAttack;

    // 基础伤害：优先 reducer 已设置的值，否则从技能定义查询
    let baseDamage: number;
    if (pendingAttack.damage != null) {
        baseDamage = pendingAttack.damage;  // ← 优先使用 reducer 设置的值
    } else if (sourceAbilityId) {
        baseDamage = getPlayerAbilityBaseDamage(state, attackerId, sourceAbilityId);
    } else {
        baseDamage = fallbackWhenNoAbility;
    }

    return baseDamage + (bonusDamage ?? 0);
}
```

### 证据 3：当前简化实现

**位置**：`src/games/dicethrone/domain/flowHooks.ts:525-528`

```typescript
const expectedDamage = sourceAbilityId 
    ? getPlayerAbilityBaseDamage(coreAfterPreDefense, attackerId, sourceAbilityId) + (core.pendingAttack.bonusDamage ?? 0)
    : 0;
```

**问题**：
- ❌ 直接使用 `getPlayerAbilityBaseDamage`，忽略了 `pendingAttack.damage`
- ❌ 无法获取 reducer 设置的伤害修正（如伏击 Token 加伤）

---

## 影响分析

### 受影响的场景

**场景 1：伏击 Token 掷骰加伤**
1. 玩家使用伏击 Token 掷骰
2. Reducer 更新 `pendingAttack.damage = baseDamage + 掷骰结果`
3. Token 响应判定使用 `expectedDamage`
4. **当前实现**：使用 `baseDamage`（错误，遗漏掷骰加伤）
5. **原始实现**：使用 `pendingAttack.damage`（正确，包含掷骰加伤）

**场景 2：其他 Token 修正伤害**
- 任何在 reducer 中修正 `pendingAttack.damage` 的 Token
- 当前实现都会遗漏这些修正

### 受影响的功能

1. **Token 响应窗口判定**：
   - 太极 Token：需要判断伤害是否 ≥ 某个阈值
   - 守护 Token：需要判断伤害是否 ≥ 某个阈值
   - 其他伤害相关 Token

2. **伤害阈值判定**：
   - 任何基于伤害判定的逻辑
   - 可能导致 Token 响应窗口不正确打开/关闭

---

## 为什么测试没有发现问题？

**测试通过的原因**：
```bash
✓ token-response-window.test.ts (8 tests) 14ms
```

**可能的原因**：
1. 测试没有覆盖 `pendingAttack.damage` 被 reducer 设置的场景
2. 测试没有覆盖伏击 Token 掷骰加伤的场景
3. 测试使用的是固定伤害，没有动态修正

**教训**：
- ❌ 测试通过不代表没有问题
- ❌ 需要更全面的测试覆盖
- ✅ 代码审查比测试更重要

---

## 修复方案

### 恢复原始实现

**文件**：`src/games/dicethrone/domain/flowHooks.ts:525-528`

**当前代码**：
```typescript
const expectedDamage = sourceAbilityId 
    ? getPlayerAbilityBaseDamage(coreAfterPreDefense, attackerId, sourceAbilityId) + (core.pendingAttack.bonusDamage ?? 0)
    : 0;
```

**修复后**：
```typescript
const expectedDamage = getPendingAttackExpectedDamage(coreAfterPreDefense, core.pendingAttack);
```

---

## 总结

**必须修复**：
- ✅ 证据确凿：Reducer 中设置了 `pendingAttack.damage`
- ✅ 当前实现会遗漏伤害修正
- ✅ 影响 Token 响应判定
- ✅ 原始实现更完整、更正确

**修复优先级**：高

**修复时间**：5 分钟

**风险**：低（恢复原始实现，已验证正确）

