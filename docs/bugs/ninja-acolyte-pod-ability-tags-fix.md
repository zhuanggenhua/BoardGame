# Ninja Acolyte POD 版本 abilityTags 不一致修复

## 问题描述

用户反馈：Ninja Acolyte（忍者侍从）POD 版本有问题，"要不基本版错误，要不是没和基本一致"。

## 根本原因

### 基础版 `ninja_acolyte`
```typescript
abilityTags: ['special'],
specialLimitGroup: 'ninja_acolyte',
```

### POD 版 `ninja_acolyte_pod`（修复前）
```typescript
abilityTags: ['talent'],  // ❌ 错误！应该是 'special'
// ❌ 缺少 specialLimitGroup
```

## 问题分析

1. **abilityTags 不一致**：
   - 基础版：`'special'`（点击场上随从激活）
   - POD 版：`'talent'`（打出时自动触发）
   - 实际机制：需要点击激活，应该是 `'special'`

2. **缺少 specialLimitGroup**：
   - POD 版没有 `specialLimitGroup: 'ninja_acolyte'`
   - 导致限制检查失效（每个基地应该只能使用一次）

3. **卡牌描述与实现不符**：
   - 卡牌描述：**Talent**: If you have not played a minion on this turn...
   - 实际实现：`special` 能力（需要点击激活）
   - 注释：虽然描述是 Talent，但实际机制是 special

## 解决方案

修改 `src/games/smashup/data/factions/ninjas_pod.ts`：

```typescript
{
    id: 'ninja_acolyte_pod',
    type: 'minion',
    name: '忍者侍从',
    nameEn: 'Ninja Acolyte',
    faction: 'ninjas_pod',
    power: 2,
    // Talent: If you have not played a minion on this turn, you may return this minion
    // to your hand and play an extra minion here immediately.
    // 注意：虽然描述是 Talent，但实际机制是 special（需要点击激活），与基础版一致
    abilityTags: ['special'],
    specialLimitGroup: 'ninja_acolyte',
    count: 4,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS1, index: 15 },
},
```

## 修复结果

- ✅ POD 版 `abilityTags` 改为 `['special']`，与基础版一致
- ✅ POD 版添加 `specialLimitGroup: 'ninja_acolyte'`，与基础版一致
- ✅ 测试通过：`ninja-acolyte-pod-consistency.test.ts` 3 个测试全部通过

## 测试覆盖

创建了 `src/games/smashup/__tests__/ninja-acolyte-pod-consistency.test.ts`：

1. ✅ 基础版和 POD 版的 abilityTags 应该一致
2. ✅ 基础版和 POD 版的 specialLimitGroup 应该一致
3. ✅ 基础版和 POD 版的 power 应该一致

## 相关文档

- `docs/refactor/pod-auto-mapping.md` - POD 自动映射系统
- `docs/refactor/pod-stub-cleanup.md` - POD stub 清理
- `src/games/smashup/abilities/ninjas.ts` - 忍者侍从能力实现

## 教训

1. **POD 版本必须与基础版一致**：除非有明确的规则差异，否则 POD 版应该与基础版完全一致
2. **卡牌描述与实现可能不符**：Talent 描述不一定意味着 `abilityTags: ['talent']`，需要根据实际机制判断
3. **自动映射只处理能力注册**：数据定义（abilityTags、specialLimitGroup）不会自动映射，需要手动保持一致
4. **测试必须覆盖数据一致性**：不仅要测试能力执行，还要测试数据定义的一致性
