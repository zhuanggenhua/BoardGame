# DiceThrone 护盾动画跳字修复

## 问题描述

**用户反馈**（2026/3/4 13:45:46）：减伤日志正确，动画跳字还是8

**日志片段**：
```
[13:44:05] 管理员1: 以【拍击】对玩家游客6118造成  4  点伤害
[13:44:05] 游客6118: actionLog.damageShieldPercent
[13:44:05] 管理员1: 受到  2  点伤害（打不到我）
```

**问题分析**：
- 原始伤害：8 点（拍击 5 剑面）
- 日志显示：2 点（正确，扣除所有护盾后）
- 动画跳字：8 点（错误，显示原始伤害）

## 根本原因

动画层和日志层使用了不同的计算逻辑：

### 日志层（正确）

```typescript
// src/games/dicethrone/game.ts:463-465
const totalShieldAbsorbed = shieldsConsumed?.reduce((sum, s) => sum + s.absorbed, 0) ?? 0;
const finalDamage = Math.max(0, dealt - totalShieldAbsorbed);
```

日志层直接使用 `DAMAGE_DEALT.payload.shieldsConsumed` 累加所有护盾吸收量（包括百分比护盾和固定值护盾）。

### 动画层（错误）

```typescript
// src/games/dicethrone/hooks/useAnimationEffects.ts (旧代码)
function resolveAnimationDamage(
    rawDamage: number,
    targetId: string,
    percentShields?: Map<string, number>,
    resolvedDamageByTarget?: Map<string, number>,
    fixedShieldsByTarget?: Map<string, number>,
): number {
    // 1. 扣除百分比护盾
    const reductionPercent = percentShields?.get(targetId);
    const shieldAbsorbed = reductionPercent != null
        ? Math.ceil(rawDamage * reductionPercent / 100)
        : 0;
    const dealtFromSameBatchShield = rawDamage - shieldAbsorbed;

    // 2. 扣除固定值护盾
    const fixedShieldAbsorbed = fixedShieldsByTarget?.get(targetId) ?? 0;
    const dealtAfterAllShields = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);

    // 3. 如果有 ATTACK_RESOLVED.totalDamage，使用它（权威值）
    const resolvedDamage = resolvedDamageByTarget?.get(targetId);
    return resolvedDamage != null
        ? Math.max(0, resolvedDamage)
        : dealtAfterAllShields;
}
```

**问题**：
1. `percentShields` 和 `fixedShieldsByTarget` 只收集**当前批次**的护盾信息
2. 如果护盾在**之前的批次**中授予（如防御阶段的"打不到我"），这些 Map 就是空的
3. `ATTACK_RESOLVED.totalDamage` 应该是兜底方案，但如果不存在或不正确，动画就会显示原始伤害

## 修复方案

**方案 1：直接使用 `shieldsConsumed` 计算最终伤害**（已采用）

这是最简单、最可靠的方案，与日志层保持完全一致：

```typescript
// src/games/dicethrone/hooks/useAnimationEffects.ts (新代码)
const buildDamageStep = useCallback((
    dmgEvent: DamageDealtEvent,
    shieldedTargets?: Set<string>,
): AnimStep | null => {
    const rawDamage = dmgEvent.payload.actualDamage ?? 0;
    if (rawDamage <= 0) return null;

    const targetId = dmgEvent.payload.targetId;

    // 如果目标在本批次中被大额护盾保护，跳过伤害动画
    if (shieldedTargets?.has(targetId)) return null;

    // 计算最终伤害（与日志层保持一致）
    // 直接使用 shieldsConsumed 累加所有护盾吸收量（包括百分比护盾和固定值护盾）
    const totalShieldAbsorbed = dmgEvent.payload.shieldsConsumed?.reduce((sum, s) => sum + s.absorbed, 0) ?? 0;
    const damage = Math.max(0, rawDamage - totalShieldAbsorbed);
    if (damage <= 0) return null;

    // ... 其余代码
}, [/* ... */]);
```

### 优点

1. **数据源统一**：动画层和日志层都使用 `shieldsConsumed`，确保一致性
2. **跨批次兼容**：`shieldsConsumed` 包含所有护盾信息，无论护盾在哪个批次授予
3. **简单可靠**：不需要复杂的 `collectDamageAnimationContext` 和 `resolveAnimationDamage` 函数
4. **易于维护**：减少代码量，降低维护成本

### 代码变更

1. **简化 `buildDamageStep` 函数**：
   - 移除 `percentShields`、`resolvedDamageByTarget`、`fixedShieldsByTarget` 参数
   - 直接使用 `dmgEvent.payload.shieldsConsumed` 计算最终伤害

2. **简化事件消费逻辑**：
   - 移除 `collectDamageAnimationContext` 函数调用
   - 只收集 `shieldedTargets`（用于跳过大额护盾的伤害动画）

3. **删除不再使用的代码**：
   - 删除 `DamageAnimationContext` 接口
   - 删除 `collectDamageAnimationContext` 函数
   - 删除 `resolveAnimationDamage` 函数

## 测试验证

### 测试场景

1. 野蛮人使用拍击（5 剑面，8 点伤害）
2. 月精灵使用"打不到我"防御技能（50% 减伤）
3. 查看动画跳字是否显示 2 点（而不是 8 点）

### 预期结果

- ✅ 日志显示：2 点伤害
- ✅ 动画跳字：2 点伤害
- ✅ 计算逻辑：日志层与动画层完全一致

## 关键教训

### 1. 日志层与动画层必须使用相同的数据源

- ❌ 错误：日志层和动画层各自实现伤害计算，导致不一致
- ✅ 正确：使用相同的数据源（`shieldsConsumed`），确保一致性

### 2. 事件 payload 是数据传递的唯一真实来源

- ✅ 正确：从 `DAMAGE_DEALT.payload.shieldsConsumed` 读取护盾消耗信息
- ❌ 错误：在动画层重新计算护盾吸收量（可能与 reducer 层不一致）

### 3. 跨批次数据传递需要通过事件 payload

- ✅ 正确：`shieldsConsumed` 包含所有护盾信息，无论护盾在哪个批次授予
- ❌ 错误：只收集当前批次的护盾信息（`percentShields`、`fixedShieldsByTarget`）

### 4. 简单方案优于复杂方案

- ✅ 正确：直接使用 `shieldsConsumed`，简单可靠
- ❌ 错误：实现复杂的 `collectDamageAnimationContext` 和 `resolveAnimationDamage`，容易出错

## 相关文档

- `docs/bugs/dicethrone-animation-log-sync.md` — 之前的护盾动画日志同步修复（固定值护盾）
- `docs/bugs/dicethrone-shield-final-summary.md` — 护盾 bug 修复完整总结
- `AGENTS.md` — 日志层与动画层必须使用相同的计算逻辑（强制规范）

## 总结

通过直接使用 `shieldsConsumed` 计算最终伤害，确保了动画跳字与日志显示的完全一致。修复后：

- ✅ 日志显示：最终伤害（扣除所有护盾）
- ✅ 动画跳字：最终伤害（扣除所有护盾）
- ✅ 数据源统一：都使用 `shieldsConsumed`
- ✅ 跨批次兼容：无论护盾在哪个批次授予
- ✅ 代码简化：删除 130+ 行不再使用的代码

这是一个典型的"多层数据同步"问题，教训是：**所有消费同一数据的层级必须使用相同的数据源，而不是各自实现计算逻辑**。
