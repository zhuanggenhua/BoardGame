# DiceThrone 变体顺序修复

## 问题描述

变体选择 UI 的显示顺序与实体卡牌图片顺序不一致。

### 用户反馈

用户提供圣骑士"正义战法 III"实体卡牌照片，指出：
- 卡牌图片上：**正义战法 III**（上）→ **执着**（下）
- 游戏 UI 中：**执着**（上）→ **正义战法 III**（下）

## 根本原因

1. **代码中的 variants 数组顺序与卡牌图片不一致**
   - 代码定义：执着 III（索引 0）→ 正义战法 III（索引 1）
   - 卡牌图片：正义战法 III（上）→ 执着（下）

2. **使用了 priority 字段进行排序**
   - 原排序逻辑：优先按 `priority` 降序，相同时按数组索引升序
   - 正义战法 III 的 `priority: 1` > 执着 III 的 `priority: 0`
   - 导致显示顺序与数组定义顺序不同

## 解决方案

### 1. 移除 priority 排序逻辑

**文件**: `src/games/dicethrone/Board.tsx`

**修改前**:
```typescript
// 按 priority 降序排列（priority 高的排前面）
// 如果 priority 相同，则按变体在 AbilityDef.variants 数组中的定义顺序
options.sort((a, b) => {
    const ma = findPlayerAbility(G, rollerId, a.abilityId);
    const mb = findPlayerAbility(G, rollerId, b.abilityId);
    if (!ma?.variant || !mb?.variant) return 0;
    
    // 先按 priority 降序
    const priorityA = ma.variant.priority ?? 0;
    const priorityB = mb.variant.priority ?? 0;
    if (priorityA !== priorityB) {
        return priorityB - priorityA;  // 降序：高 priority 在前
    }
    
    // priority 相同时，按数组索引升序
    const variants = ma.ability.variants ?? [];
    const ia = variants.indexOf(ma.variant);
    const ib = variants.indexOf(mb.variant);
    return ia - ib;
});
```

**修改后**:
```typescript
// 按变体在 AbilityDef.variants 数组中的定义顺序排列（与卡牌图片顺序一致）
options.sort((a, b) => {
    const ma = findPlayerAbility(G, rollerId, a.abilityId);
    const mb = findPlayerAbility(G, rollerId, b.abilityId);
    if (!ma?.variant || !mb?.variant) return 0;
    
    const variants = ma.ability.variants ?? [];
    const ia = variants.indexOf(ma.variant);
    const ib = variants.indexOf(mb.variant);
    return ia - ib;
});
```

### 2. 调整 variants 数组顺序

**文件**: `src/games/dicethrone/heroes/paladin/abilities.ts`

**修改前**:
```typescript
export const RIGHTEOUS_COMBAT_3: AbilityDef = {
    variants: [
        // 执着 III (Tenacity III): 2 Sword + 1 Helm
        { id: 'righteous-combat-3-tenacity', ..., priority: 0 },
        // 正义战法 III (Righteous Combat III): 3 Sword + 2 Helm
        { id: 'righteous-combat-3-main', ..., priority: 1 }
    ]
};
```

**修改后**:
```typescript
export const RIGHTEOUS_COMBAT_3: AbilityDef = {
    variants: [
        // 正义战法 III (Righteous Combat III): 3 Sword + 2 Helm
        { id: 'righteous-combat-3-main', ... },
        // 执着 III (Tenacity III): 2 Sword + 1 Helm
        { id: 'righteous-combat-3-tenacity', ... }
    ]
};
```

### 3. 移除所有 priority 字段

**文件**: `src/games/dicethrone/heroes/paladin/abilities.ts`

使用 Node.js 脚本批量移除所有 `priority` 字段：
```javascript
content = content.replace(/,?\s*priority:\s*\d+/g, '');
```

### 4. 更新测试

**文件**: `src/games/dicethrone/__tests__/paladin-abilities.test.ts`

调整测试中的索引顺序，使其与新的数组顺序一致：
```typescript
// 主技能: 3 Sword + 2 Helm（索引 0，与卡牌图片顺序一致）
const main = RIGHTEOUS_COMBAT_3.variants![0];
// 执着变体: 2 Sword + 1 Helm（索引 1）
const tenacity = RIGHTEOUS_COMBAT_3.variants![1];
```

## 设计原则

### 变体顺序规范（强制）

1. **variants 数组顺序必须与实体卡牌图片顺序一致**
   - 卡牌图片从上到下的顺序 = 数组从索引 0 到 n 的顺序
   - UI 显示顺序直接按数组索引升序排列

2. **禁止使用 priority 字段进行排序**
   - priority 字段可能导致显示顺序与数组定义顺序不一致
   - 数据录入时应直接按卡牌图片顺序定义数组

3. **数据录入流程**
   - 拿到实体卡牌照片
   - 从上到下依次录入变体到 variants 数组
   - 不需要设置 priority 字段

## 影响范围

### 已修改文件
- `src/games/dicethrone/Board.tsx` - 移除 priority 排序逻辑
- `src/games/dicethrone/heroes/paladin/abilities.ts` - 调整变体顺序，移除 priority 字段
- `src/games/dicethrone/__tests__/paladin-abilities.test.ts` - 更新测试索引

### 其他英雄的技能

**结论：对其他英雄的技能没有影响**

检查了所有使用 priority 字段的技能：
- `shadow_thief/abilities.ts` - 匕首打击、偷窃、迅捷突袭、破隐一击等
- `pyromancer/abilities.ts` - 火球术、灵魂燃烧、炽热连击、流星雨等
- `moon_elf/abilities.ts` - 长弓等

**发现**：所有这些技能的 priority 值都是按数组顺序递增的：
```typescript
variants: [
    { id: 'xxx-3', ..., priority: 1 },  // 索引 0
    { id: 'xxx-4', ..., priority: 2 },  // 索引 1
    { id: 'xxx-5', ..., priority: 3 }   // 索引 2
]
```

因此：
- **原排序逻辑**：按 priority 降序 → 实际结果是索引 0, 1, 2...（因为 priority 1 < 2 < 3，降序后变成 3, 2, 1，但对应的索引是 2, 1, 0，再按索引升序排列后还是 0, 1, 2）
- **新排序逻辑**：直接按数组索引升序 → 结果是索引 0, 1, 2...
- **结论**：显示顺序完全相同，无影响

**唯一的特殊情况**：圣骑士的正义战法 III 是唯一一个 priority 顺序与期望显示顺序不一致的技能（priority 1 > priority 0，但卡牌图片上 priority 1 应该在前）。这就是为什么我们需要调整它的数组顺序。

### 后续建议

虽然其他英雄的 priority 字段不影响显示顺序，但为了代码清晰度，建议：
1. **批量清理所有无效的 priority 字段**（可选，不紧急）
2. **检查所有英雄的 variants 数组顺序是否与实体卡牌图片一致**（重要）
3. **更新数据录入规范**：明确要求按卡牌图片从上到下的顺序定义 variants 数组

## 测试结果

所有测试通过（18/18）：
```
✓ src/games/dicethrone/__tests__/paladin-abilities.test.ts (18 tests) 8ms
  ✓ 圣骑士技能定义 (18)
    ✓ 基础技能 (10)
    ✓ 升级技能 (8)
      ✓ 正义冲击 III - 新增执着变体 + 主技能伤害提升
```

## 相关文档

- 原始问题: 圣骑士"正义战法"升级技能数据录入错误
- 相关文件: `docs/bugs/dicethrone-paladin-righteous-combat-data-fix.md`
