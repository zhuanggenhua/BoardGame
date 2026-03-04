# Bug: 忍者特殊能力限制错误 ✅ 已修复

## 状态

✅ **已修复** - 2025-02-28

## 问题描述

当前实现中，所有忍者特殊卡牌（影舞者、便衣忍者、忍者侍从）共享同一个 `specialLimitGroup: 'ninja_special'`，导致在同一个基地上使用了一张忍者特殊卡牌后，无法使用其他忍者特殊卡牌。

## 用户报告

用户反馈：先使用了影舞者的能力，然后尝试在同一个基地使用便衣忍者时，提示"该基地本回合已使用过同组特殊能力"。

## 官方规则

根据 [Board Games Stack Exchange](https://boardgames.stackexchange.com/questions/25643/doubts-with-the-before-a-base-scores-part/25645) 的官方规则说明：

> "Yes, you can use any number of special cards as long as they are relevant. However, **some cards have their own limitations on this** (e.g. you can only use one Shinobi per base)."

这意味着：
- **可以使用任意数量的特殊卡牌**（只要它们相关）
- **某些卡牌有自己的限制**（例如：每个基地只能使用一个影舞者）
- **不同的特殊卡牌之间不应该共享限制**

## 当前实现

### 卡牌定义（`src/games/smashup/data/factions/ninjas.ts`）

```typescript
{
    id: 'ninja_shinobi',
    type: 'minion',
    name: '影舞者',
    specialLimitGroup: 'ninja_special',  // ❌ 错误：共享限制组
    beforeScoringPlayable: true,
    // ...
},
{
    id: 'ninja_hidden_ninja',
    type: 'action',
    subtype: 'special',
    name: '便衣忍者',
    specialLimitGroup: 'ninja_special',  // ❌ 错误：共享限制组
    // ...
},
{
    id: 'ninja_acolyte',
    type: 'minion',
    name: '忍者侍从',
    specialLimitGroup: 'ninja_special',  // ❌ 错误：共享限制组
    // ...
}
```

### 限制检查逻辑（`src/games/smashup/domain/abilityHelpers.ts`）

```typescript
export function isSpecialLimitBlocked(state: SmashUpCore, defId: string, baseIndex: number): boolean {
    const def = getCardDef(defId);
    if (!def) return false;
    const limitGroup = (def as MinionCardDef | ActionCardDef).specialLimitGroup;
    if (!limitGroup) return false;
    const used = state.specialLimitUsed?.[limitGroup];
    return used?.includes(baseIndex) ?? false;
}
```

当前逻辑：
1. 所有忍者特殊卡牌共享 `'ninja_special'` 限制组
2. 使用任意一张后，`state.specialLimitUsed['ninja_special']` 会记录该基地索引
3. 尝试使用其他忍者特殊卡牌时，检查到该基地已使用过 `'ninja_special'` 组，拒绝使用

## 修复方案

已采用方案 A：每张卡牌独立限制

### 修改内容

1. **卡牌定义**（`src/games/smashup/data/factions/ninjas.ts`）：
   - 影舞者：`specialLimitGroup: 'ninja_shinobi'`
   - 便衣忍者：`specialLimitGroup: 'ninja_hidden_ninja'`
   - 忍者侍从：`specialLimitGroup: 'ninja_acolyte'`

2. **能力注释**（`src/games/smashup/abilities/ninjas.ts`）：
   - 更新注释说明每张卡牌有独立的限制组

3. **测试用例**（`src/games/smashup/__tests__/ninja-special-limit-fix.test.ts`）：
   - 验证三张卡牌的 `specialLimitGroup` 互不相同
   - 验证不再使用共享的 `'ninja_special'`

### 修复效果

- ✅ 同一个基地可以使用影舞者 + 便衣忍者 + 忍者侍从（不同卡牌）
- ✅ 同一个基地不能使用 2 个影舞者（相同卡牌）
- ✅ 同一个基地不能使用 2 个便衣忍者（相同卡牌）
- ✅ 同一个基地不能使用 2 个忍者侍从（相同卡牌）

## 相关文件

- ✅ `src/games/smashup/data/factions/ninjas.ts` - 卡牌定义（已修改）
- ✅ `src/games/smashup/abilities/ninjas.ts` - 能力注释（已更新）
- ✅ `src/games/smashup/__tests__/ninja-special-limit-fix.test.ts` - 测试用例（已添加）
- `src/games/smashup/domain/abilityHelpers.ts` - 限制检查逻辑（无需修改）
- `src/games/smashup/domain/commands.ts` - 命令验证（无需修改）

---

## 原始分析（已归档）

```typescript
{
    id: 'ninja_shinobi',
    specialLimitGroup: 'ninja_shinobi',  // ✅ 独立限制
},
{
    id: 'ninja_hidden_ninja',
    specialLimitGroup: 'ninja_hidden_ninja',  // ✅ 独立限制
},
{
    id: 'ninja_acolyte',
    specialLimitGroup: 'ninja_acolyte',  // ✅ 独立限制
}
```

这样：
- 每个基地可以使用 1 个影舞者 + 1 个便衣忍者 + 1 个忍者侍从
- 但不能使用 2 个影舞者（因为 `specialLimitGroup` 相同）

### 方案 B：移除限制组（如果官方规则允许多次使用）

如果官方规则允许在同一个基地多次使用同一张特殊卡牌，则：

```typescript
{
    id: 'ninja_shinobi',
    // specialLimitGroup: undefined,  // ✅ 无限制
},
{
    id: 'ninja_hidden_ninja',
    // specialLimitGroup: undefined,  // ✅ 无限制
},
{
    id: 'ninja_acolyte',
    // specialLimitGroup: undefined,  // ✅ 无限制
}
```

## 需要确认

1. **官方规则是否允许在同一个基地多次使用同一张特殊卡牌？**
   - 如果不允许 → 使用方案 A（每张卡牌独立限制）
   - 如果允许 → 使用方案 B（移除限制组）

2. **是否有其他派系的特殊卡牌也有类似的限制？**
   - 需要审查所有使用 `specialLimitGroup` 的卡牌

## 影响范围

- 忍者派系的所有特殊卡牌（影舞者、便衣忍者、忍者侍从）
- 可能影响其他派系的特殊卡牌（如果也使用了共享限制组）

## 修复步骤

1. 确认官方规则（查阅规则书或官方 FAQ）
2. 根据规则选择方案 A 或方案 B
3. 修改 `src/games/smashup/data/factions/ninjas.ts` 中的 `specialLimitGroup` 配置
4. 更新相关测试用例
5. 更新规则文档 `src/games/smashup/rule/大杀四方规则.md`

## 相关文件

- `src/games/smashup/data/factions/ninjas.ts` - 卡牌定义
- `src/games/smashup/domain/abilityHelpers.ts` - 限制检查逻辑
- `src/games/smashup/domain/commands.ts` - 命令验证
- `src/games/smashup/abilities/ninjas.ts` - 能力实现
- `src/games/smashup/__tests__/specialInteractionChain.test.ts` - 测试用例
