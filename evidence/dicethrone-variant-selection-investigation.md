# DiceThrone 变体选择问题调查

## 问题描述
用户反馈：火法的"焚灭"(Incinerate)卡牌有两个变体，但无法选择变体。

## 卡牌信息
- **卡牌名称**: Hot Streak II (炽热波纹 II)
- **基础技能 ID**: `fiery-combo`
- **槽位**: `sky` (天空槽)
- **变体 1**: `fiery-combo-2`
  - 触发条件: `smallStraight` (小顺子)
  - 优先级: 1
  - 效果: 获得 2 FM，消耗所有 FM 造成伤害
- **变体 2**: `incinerate` (焚灭)
  - 触发条件: `diceSet` (2火 + 2炽魂)
  - 优先级: 2
  - 效果: 获得 2 FM，施加燃烧，造成 6 点伤害

## 代码分析

### 1. 变体识别逻辑 ✅
**文件**: `src/games/dicethrone/domain/rules.ts` (lines 394-450)

```typescript
export const getAvailableAbilityIds = (state, playerId, phase) => {
    // ...
    for (const def of player.abilities) {
        if (def.variants?.length) {
            const matched: { id: string; priority: number }[] = [];
            for (const variant of def.variants) {
                const result = combatAbilityManager.instance.checkTrigger(variant.trigger, context);
                if (result) {
                    matched.push({ id: variant.id, priority: variant.priority ?? 0 });
                }
            }
            matched.sort((a, b) => b.priority - a.priority);
            for (const m of matched) {
                available.push(m.id);
            }
        }
    }
    return available;
}
```

**结论**: ✅ 逻辑正确，会返回所有匹配的变体 ID

### 2. 分歧型判断逻辑 ✅
**文件**: `src/games/dicethrone/Board.tsx` (lines 75-110)

```typescript
function hasDivergentVariants(state, playerId, variantIds) {
    const triggers = matches.map(m => m?.variant?.trigger ?? m?.ability.trigger ?? null);
    
    // 如果不全是 diceSet 类型 → 分歧型
    if (!triggers.every(t => t!.type === 'diceSet')) return true;
    
    // 全是 diceSet，比较骰面 key 集合是否一致
    // ...
}
```

**结论**: ✅ 逻辑正确
- `fiery-combo-2` 的 trigger 是 `smallStraight`
- `incinerate` 的 trigger 是 `diceSet`
- 不全是 `diceSet`，所以会返回 `true` (分歧型)

### 3. 变体选择 UI 触发逻辑 ✅
**文件**: `src/games/dicethrone/Board.tsx` (lines 1050-1100)

```typescript
if (currentPhase === 'offensiveRoll' && G.rollConfirmed) {
    const slotId = getAbilitySlotId(abilityId);
    if (slotId) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping) {
            const slotVariants = availableAbilityIdsForRoller.filter(id => {
                const match = findPlayerAbility(G, rollerId, id);
                if (!match) return false;
                return mapping.ids.includes(match.ability.id);
            });
            if (slotVariants.length >= 2 && hasDivergentVariants(G, rollerId, slotVariants)) {
                // 弹出选择窗口
                // ...
            }
        }
    }
}
```

**结论**: ✅ 逻辑正确
- 检查是否在 `offensiveRoll` 阶段且已确认骰子
- 从 `availableAbilityIdsForRoller` 中筛选属于同一槽位的变体
- 如果有 ≥2 个分歧型变体，弹出选择窗口

### 4. 槽位映射 ✅
**文件**: `src/games/dicethrone/ui/AbilityOverlays.tsx` (line 50)

```typescript
export const ABILITY_SLOT_MAP = {
    sky: { labelKey: 'abilitySlots.sky', ids: ['fiery-combo', ...] },
    // ...
};
```

**结论**: ✅ `fiery-combo` 正确映射到 `sky` 槽位

## 可能的问题

### 问题 1: 变体未被识别为同一槽位
**原因**: `getAbilitySlotId` 函数使用 `startsWith` 匹配，可能无法正确识别变体

**文件**: `src/games/dicethrone/ui/AbilityOverlays.tsx` (lines 60-65)

```typescript
export const getAbilitySlotId = (abilityId: string) => {
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping.ids.some(baseId => abilityId === baseId || abilityId.startsWith(`${baseId}-`))) {
            return slotId;
        }
    }
    return null;
};
```

**测试**:
- `getAbilitySlotId('fiery-combo-2')` → 应该返回 `'sky'` (因为 `'fiery-combo-2'.startsWith('fiery-combo-')` 为 true)
- `getAbilitySlotId('incinerate')` → 应该返回 `null` (因为 `'incinerate'` 不匹配任何 baseId)

**结论**: ❌ **这是问题所在！**
- `incinerate` 变体 ID 不以 `fiery-combo-` 开头
- `getAbilitySlotId('incinerate')` 返回 `null`
- 因此 `incinerate` 不会被识别为属于 `sky` 槽位
- 两个变体无法被识别为同一槽位的多个选项

### 问题 2: 变体 ID 命名不一致
**原因**: 变体 ID 应该遵循 `{baseId}-{variantName}` 的命名规范

**当前命名**:
- 变体 1: `fiery-combo-2` ✅ (符合规范)
- 变体 2: `incinerate` ❌ (不符合规范，应该是 `fiery-combo-incinerate`)

## 解决方案

### 方案 1: 修改 `getAbilitySlotId` 函数（推荐）
**优点**: 不需要修改所有变体 ID，向后兼容
**缺点**: 需要遍历所有变体来查找槽位

```typescript
export const getAbilitySlotId = (abilityId: string, state?: DiceThroneCore, playerId?: string) => {
    // 1. 先尝试直接匹配或前缀匹配
    for (const slotId of Object.keys(ABILITY_SLOT_MAP)) {
        const mapping = ABILITY_SLOT_MAP[slotId];
        if (mapping.ids.some(baseId => abilityId === baseId || abilityId.startsWith(`${baseId}-`))) {
            return slotId;
        }
    }
    
    // 2. 如果没有匹配，尝试通过 findPlayerAbility 查找变体所属的基础技能
    if (state && playerId) {
        const match = findPlayerAbility(state, playerId, abilityId);
        if (match?.ability) {
            // 递归查找基础技能的槽位
            return getAbilitySlotId(match.ability.id);
        }
    }
    
    return null;
};
```

### 方案 2: 修改变体 ID 命名（不推荐）
**优点**: 符合命名规范，代码更清晰
**缺点**: 需要修改所有相关代码（i18n、测试、execute 等）

将 `incinerate` 改为 `fiery-combo-incinerate`

## 下一步行动

1. ✅ 确认问题根因：`getAbilitySlotId` 无法识别 `incinerate` 变体
2. ⏳ 实现方案 1：修改 `getAbilitySlotId` 函数
3. ⏳ 编写测试验证修复
4. ⏳ 检查其他英雄是否有类似问题

## 相关文件
- `src/games/dicethrone/heroes/pyromancer/abilities.ts` - 技能定义
- `src/games/dicethrone/domain/rules.ts` - 变体识别逻辑
- `src/games/dicethrone/Board.tsx` - UI 触发逻辑
- `src/games/dicethrone/ui/AbilityOverlays.tsx` - 槽位映射和 `getAbilitySlotId`
- `src/games/dicethrone/domain/abilityLookup.ts` - `findPlayerAbility` 函数
