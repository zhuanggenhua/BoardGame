# DiceThrone 动画跳字与日志同步修复

## 问题描述

用户反馈：行为日志显示正确（扣除护盾后的最终伤害），但动画跳字（伤害数字飘出动画）显示的数值不对，没有与日志统一。

## 根本原因

**日志层**（`game.ts` 中的 `formatDiceThroneActionEntry`）和**动画层**（`useAnimationEffects.ts` 中的 `resolveAnimationDamage`）使用了不同的计算逻辑：

### 日志层（正确）

```typescript
// 1. 扣除百分比护盾
const shieldAbsorbed = shieldPercent > 0 ? Math.ceil(rawDealt * shieldPercent / 100) : 0;
const dealtFromSameBatchShield = rawDealt - shieldAbsorbed;

// 2. 扣除固定值护盾
const fixedShieldAbsorbed = shieldsConsumed?.reduce((sum, shield) => {
    return shield.value != null ? sum + shield.absorbed : sum;
}, 0) ?? 0;

// 3. 最终伤害 = 基础伤害 - 百分比护盾 - 固定值护盾
const dealt = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);
```

### 动画层（错误）

```typescript
// 1. 扣除百分比护盾
const shieldAbsorbed = reductionPercent != null
    ? Math.ceil(rawDamage * reductionPercent / 100)
    : 0;
const dealtFromSameBatchShield = rawDamage - shieldAbsorbed;

// 2. ❌ 没有扣除固定值护盾！
// 3. 如果有 ATTACK_RESOLVED.totalDamage，使用它
const resolvedDamage = resolvedDamageByTarget?.get(targetId);
return resolvedDamage != null
    ? Math.max(0, resolvedDamage)
    : dealtFromSameBatchShield;  // ❌ 没有扣除固定值护盾
```

**问题**：动画层只处理了百分比护盾（如"打不到我"50%），没有处理固定值护盾（如"下次一定"6点、"神圣防御"3点），导致动画显示的伤害数字与日志不一致。

## 修复方案

### 1. 扩展 `DamageAnimationContext` 接口

```typescript
export interface DamageAnimationContext {
    shieldedTargets: Set<string>;
    percentShields: Map<string, number>;
    resolvedDamageByTarget: Map<string, number>;
    /** 固定值护盾消耗信息（targetId → 总吸收量） */
    fixedShieldsByTarget: Map<string, number>;  // 新增
}
```

### 2. 在 `collectDamageAnimationContext` 中收集固定值护盾信息

```typescript
// 收集固定值护盾消耗信息（从 DAMAGE_DEALT 事件的 shieldsConsumed 字段）
for (const entry of newEntries) {
    const event = entry.event as DamageDealtEvent;
    if (event.type !== 'DAMAGE_DEALT') continue;

    const targetId = event.payload.targetId;
    const shieldsConsumed = event.payload.shieldsConsumed;
    if (!shieldsConsumed || shieldsConsumed.length === 0) continue;

    // 统计固定值护盾的总吸收量（过滤掉百分比护盾）
    const fixedShieldAbsorbed = shieldsConsumed.reduce((sum, shield) => {
        return shield.value != null ? sum + shield.absorbed : sum;
    }, 0);

    if (fixedShieldAbsorbed > 0) {
        const current = fixedShieldsByTarget.get(targetId) ?? 0;
        fixedShieldsByTarget.set(targetId, current + fixedShieldAbsorbed);
    }
}
```

### 3. 更新 `resolveAnimationDamage` 函数

```typescript
/**
 * 计算伤害动画应展示的净伤害。
 * 
 * 计算顺序（与日志层保持一致）：
 * 1. 扣除百分比护盾（如打不到我 50%）
 * 2. 扣除固定值护盾（如下次一定 6 点、神圣防御 3 点）
 * 3. 如果有 ATTACK_RESOLVED.totalDamage，使用它作为最终值
 */
export function resolveAnimationDamage(
    rawDamage: number,
    targetId: string,
    percentShields?: Map<string, number>,
    resolvedDamageByTarget?: Map<string, number>,
    fixedShieldsByTarget?: Map<string, number>,  // 新增参数
): number {
    // 1. 扣除百分比护盾
    const reductionPercent = percentShields?.get(targetId);
    const shieldAbsorbed = reductionPercent != null
        ? Math.ceil(rawDamage * reductionPercent / 100)
        : 0;
    const dealtFromSameBatchShield = rawDamage - shieldAbsorbed;

    // 2. 扣除固定值护盾（新增）
    const fixedShieldAbsorbed = fixedShieldsByTarget?.get(targetId) ?? 0;
    const dealtAfterAllShields = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);

    // 3. 如果有 ATTACK_RESOLVED.totalDamage，使用它（权威值）
    const resolvedDamage = resolvedDamageByTarget?.get(targetId);
    return resolvedDamage != null
        ? Math.max(0, resolvedDamage)
        : dealtAfterAllShields;  // 修复：使用扣除所有护盾后的值
}
```

### 4. 更新所有调用点

- `buildDamageStep` 函数签名：新增 `fixedShieldsByTarget` 参数
- 调用 `buildDamageStep` 时传入 `fixedShieldsByTarget`
- 调用 `resolveAnimationDamage` 时传入 `fixedShieldsByTarget`
- 更新测试文件中的所有调用

## 测试验证

### 新增测试用例

```typescript
it('固定值护盾应从动画伤害中扣除', () => {
    const damageEvent: DamageDealtEvent = {
        type: 'DAMAGE_DEALT',
        payload: {
            targetId: '1',
            amount: 8,
            actualDamage: 8,
            sourceAbilityId: 'shadow-shank',
            shieldsConsumed: [
                { id: 'card-next-time', absorbed: 6, value: 6, name: 'card-next-time' },
                { id: 'holy-defense', absorbed: 2, value: 3, name: 'holy-defense' },
            ],
        },
        timestamp: 11,
    };

    const entries: EventStreamEntry[] = [
        { id: 1, event: damageEvent },
    ];

    const ctx = collectDamageAnimationContext(entries);
    expect(ctx.fixedShieldsByTarget.get('1')).toBe(8); // 6 + 2 = 8
    expect(resolveAnimationDamage(8, '1', ctx.percentShields, ctx.resolvedDamageByTarget, ctx.fixedShieldsByTarget)).toBe(0);
});

it('百分比护盾 + 固定值护盾组合应正确计算动画伤害', () => {
    const damageEvent: DamageDealtEvent = {
        type: 'DAMAGE_DEALT',
        payload: {
            targetId: '1',
            amount: 10,
            actualDamage: 10,
            sourceAbilityId: 'shadow-shank',
            shieldsConsumed: [
                { id: 'card-next-time', absorbed: 5, value: 6, name: 'card-next-time' },
            ],
        },
        timestamp: 11,
    };

    const entries: EventStreamEntry[] = [
        {
            id: 1,
            event: {
                type: 'DAMAGE_SHIELD_GRANTED',
                payload: {
                    targetId: '1',
                    reductionPercent: 50,
                },
                timestamp: 11,
            },
        },
        { id: 2, event: damageEvent },
    ];

    const ctx = collectDamageAnimationContext(entries);
    expect(ctx.percentShields.get('1')).toBe(50);
    expect(ctx.fixedShieldsByTarget.get('1')).toBe(5);
    // 10 伤害 → 50% 护盾吸收 5 → 剩余 5 → 固定值护盾吸收 5 → 最终 0
    expect(resolveAnimationDamage(10, '1', ctx.percentShields, ctx.resolvedDamageByTarget, ctx.fixedShieldsByTarget)).toBe(0);
});
```

### 测试结果

```bash
✓ src/games/dicethrone/__tests__/useAnimationEffects.test.ts (5 tests)
  ✓ Token 响应关闭批次：使用 ATTACK_RESOLVED.totalDamage 作为动画伤害
  ✓ 无 Token 响应关闭时，不应使用 ATTACK_RESOLVED 覆盖动画伤害
  ✓ 同批次百分比护盾应按净伤害播放动画
  ✓ 固定值护盾应从动画伤害中扣除  ← 新增
  ✓ 百分比护盾 + 固定值护盾组合应正确计算动画伤害  ← 新增

✓ src/games/dicethrone/__tests__/shield-*.test.ts (31 tests)
  所有护盾相关测试通过
```

## 关键教训

### 1. 日志层与动画层必须使用相同的计算逻辑

- ❌ 错误：日志层和动画层各自实现伤害计算，导致不一致
- ✅ 正确：提取公共函数，或确保两层使用相同的计算顺序和逻辑

### 2. 护盾计算顺序必须统一

**正确顺序**（与 reducer 层保持一致）：
1. 扣除百分比护盾（如"打不到我"50%）
2. 扣除固定值护盾（如"下次一定"6点、"神圣防御"3点）
3. 如果有 ATTACK_RESOLVED.totalDamage，使用它作为最终值

### 3. 事件 payload 是数据传递的唯一真实来源

- ✅ 正确：从 `DAMAGE_DEALT.payload.shieldsConsumed` 读取护盾消耗信息
- ❌ 错误：在动画层重新计算护盾吸收量（可能与 reducer 层不一致）

### 4. 测试必须覆盖所有护盾类型

- ✅ 百分比护盾（reductionPercent）
- ✅ 固定值护盾（value）
- ✅ 百分比 + 固定值组合
- ✅ 多个固定值护盾叠加

## 相关文档

- `docs/bugs/dicethrone/dicethrone-shield-final-summary.md` — 护盾 bug 修复完整总结
- `docs/bugs/engine-options-pattern-summary.md` — 引擎层 Options Pattern 扩展
- `src/games/dicethrone/hooks/useAnimationEffects.ts` — 动画效果 Hook
- `src/games/dicethrone/game.ts` — 日志格式化

## 总结

通过在动画层添加固定值护盾的处理逻辑，确保了动画跳字与日志显示的一致性。修复后：

- ✅ 日志显示：最终伤害（扣除所有护盾）
- ✅ 动画跳字：最终伤害（扣除所有护盾）
- ✅ 计算逻辑：日志层与动画层完全一致
- ✅ 测试覆盖：所有护盾类型和组合场景

这是一个典型的"多层数据同步"问题，教训是：**所有消费同一数据的层级必须使用相同的计算逻辑，或从同一数据源读取**。
