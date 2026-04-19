# DiceThrone 焚灭变体未加入可用技能列表 - 根因分析

## 问题描述

用户反馈：DiceThrone 游戏中无法选择"焚灭"(Incinerate)变体。

## 排查过程

### 第一轮：变体选择逻辑检查

最初怀疑是变体选择弹窗没有弹出，但日志显示：

```
[Board] 🔵 Checking variant {variantId: 'fireball-3', abilityId: 'fireball', mappingIds: Array(6), included: false}
[Board] 🔵 Checking variant {variantId: 'fiery-combo-2', abilityId: 'fiery-combo', mappingIds: Array(6), included: true}
[Board] 🔵 Slot variants {slotId: 'sky', slotVariants: Array(1), availableAbilityIdsForRoller: Array(2)}
```

**发现**：`availableAbilityIdsForRoller` 包含的是 `'fireball-3'` 和 `'fiery-combo-2'`，**不包含** `'incinerate'`！

### 根本原因

`getAvailableAbilityIds` 函数（`src/games/dicethrone/domain/rules.ts`）没有把 `'incinerate'` 加入可用技能列表。

可能的原因：
1. **触发条件检查失败**：`combatAbilityManager.instance.checkTrigger(variant.trigger, context)` 返回 `false`
2. **骰面计数错误**：`faceCounts` 中没有正确计算火焰面和炽魂面的数量
3. **触发条件配置错误**：`incinerate` 的 `trigger` 配置不正确

## Hot Streak II 的变体配置

```typescript
export const HOT_STREAK_2: AbilityDef = {
    id: 'fiery-combo',
    variants: [
        {
            id: 'fiery-combo-2',
            trigger: { type: 'smallStraight' },
            priority: 1
        },
        {
            id: 'incinerate',
            trigger: { type: 'diceSet', faces: { [PYROMANCER_DICE_FACE_IDS.FIRE]: 2, [PYROMANCER_DICE_FACE_IDS.FIERY_SOUL]: 2 } },
            priority: 2
        }
    ]
};
```

配置看起来是正确的。

## 已添加调试日志

在 `getAvailableAbilityIds` 函数中添加了详细的日志：

### 日志 1：检查有变体的技能
```typescript
console.log('[rules] 🔵 Checking ability with variants', {
    abilityId: def.id,
    variantCount: def.variants.length
});
```

### 日志 2：变体触发条件检查
```typescript
console.log('[rules] 🔵 Variant trigger check', {
    variantId: variant.id,
    trigger: variant.trigger,
    faceCounts: context.faceCounts,
    result
});
```

### 日志 3：匹配的变体列表
```typescript
console.log('[rules] 🔵 Matched variants', {
    abilityId: def.id,
    matched: matched.map(m => m.id)
});
```

## 下一步

请再次投出满足两个变体触发条件的骰子（小顺子 + 2火+2炽魂），确认骰子，然后查看控制台中 `[rules] 🔵` 标记的日志。

特别关注：
1. `faceCounts` 中火焰面和炽魂面的数量是否正确
2. `incinerate` 的 `trigger` 检查结果是 `true` 还是 `false`
3. `matched` 列表中是否包含 `'incinerate'`

## 相关文件

- `src/games/dicethrone/domain/rules.ts` - 可用技能计算逻辑
- `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 火法技能定义
- `src/games/dicethrone/Board.tsx` - 变体选择逻辑
