# 大杀四方"我们乃最强"计分时机修复

## 问题描述

用户反馈："我们乃最强"在计分前打出了，但没有区分计分前和计分后。

## 根因分析

### 卡牌定义对比

**承受压力**（`giant_ant_under_pressure`）：
```typescript
{
    id: 'giant_ant_under_pressure',
    type: 'action',
    subtype: 'special',
    specialTiming: 'beforeScoring',  // ✅ 有这个字段
    specialNeedsBase: true,
    // ...
}
```

**我们乃最强**（`giant_ant_we_are_the_champions`）：
```typescript
{
    id: 'giant_ant_we_are_the_champions',
    type: 'action',
    subtype: 'special',
    // ❌ 缺少 specialTiming 字段
    specialNeedsBase: true,
    // ...
}
```

### 问题根源

"我们乃最强"的卡牌定义中**缺少 `specialTiming: 'afterScoring'` 字段**，导致系统无法正确识别它应该在计分后触发。

虽然代码实现中有 `afterScoring` 触发器（`giantAntWeAreTheChampionsAfterScoring`），但卡牌定义中缺少 `specialTiming` 字段，导致：
1. 卡牌可以在任何时候打出（包括计分前）
2. 系统无法正确验证打出时机
3. 与"承受压力"（计分前）的区分不明确

## 修复方案

为"我们乃最强"和"我们乃最强_POD"添加 `specialTiming: 'afterScoring'` 字段。

### 修改文件

1. `src/games/smashup/data/factions/giant-ants.ts`
2. `src/games/smashup/data/factions/giant-ants_pod.ts`

### 修改内容

```typescript
{
    id: 'giant_ant_we_are_the_champions',
    type: 'action',
    subtype: 'special',
    name: '我们乃最强',
    nameEn: 'We Are the Champions',
    faction: 'giant_ants',
    abilityTags: ['special'],
    specialTiming: 'afterScoring',  // ✅ 新增字段
    specialNeedsBase: true,
    count: 1,
    previewRef: { type: 'atlas', atlasId: SMASHUP_ATLAS_IDS.CARDS5, index: 46 },
}
```

## 验证

### TypeScript 编译检查
```bash
npx tsc --noEmit
```
✅ 通过，无类型错误

### ESLint 检查
```bash
npx eslint src/games/smashup/data/factions/giant-ants.ts src/games/smashup/data/factions/giant-ants_pod.ts
```
✅ 通过，无 lint 错误

## 预期效果

修复后：
1. ✅ "我们乃最强"只能在计分后打出（通过 `specialTiming: 'afterScoring'` 验证）
2. ✅ 与"承受压力"（计分前）明确区分
3. ✅ 系统正确识别打出时机，拒绝在错误时机打出

## 相关卡牌

| 卡牌 | specialTiming | 效果时机 |
|------|---------------|----------|
| 承受压力 | `beforeScoring` | 基地**即将计分前** |
| 我们乃最强 | `afterScoring` | 基地**计分后** |

## 总结

这是一个数据定义缺失导致的问题。虽然代码实现正确（有 `afterScoring` 触发器），但卡牌定义中缺少 `specialTiming` 字段，导致系统无法正确验证打出时机。修复后，"我们乃最强"只能在计分后打出，与"承受压力"（计分前）明确区分。
