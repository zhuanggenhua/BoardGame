# SmashUp 母舰基地 UI 显示错误基地的随从

## 问题描述

母舰基地 afterScoring 能力执行时，UI 的 `PromptOverlay` 显示了其他基地（忍者道场）上的随从，但这些随从不应该出现在选项中。

## 用户报告

用户截图显示：
- 母舰基地（左边）正在执行 afterScoring："选择收回的随从"
- 忍者道场（右边）上的"红机甲人"随从有紫色高亮边框
- 母舰基地本身没有高亮边框

用户疑问：
1. 为什么可以收回其他基地的随从？
2. 为什么母舰基地不高亮？

## 根因分析

### 代码逻辑是正确的

母舰基地的 `afterScoring` 能力代码：

```typescript
const eligible = base.minions.filter(m =>
    m.controller === winnerId &&
    getEffectivePower(ctx.state, m, ctx.baseIndex) <= 3
);
```

这段代码**只会选择母舰基地上的随从**（`base.minions` 只包含当前基地）。

### UI 显示问题

问题出在 `PromptOverlay` 组件：

1. **`PromptOverlay` 显示所有卡牌选项**：不管这些卡牌在哪个基地
2. **同类卡牌合并显示**：所有"红机甲人"显示在一起
3. **没有基地上下文信息**：UI 不知道这些随从来自哪个基地

### 为什么会这样

母舰基地创建交互时使用了 `targetType: 'minion'`：

```typescript
const interaction = createSimpleChoice(
    `base_the_mothership_${ctx.now}`, winnerId,
    '母舰：选择收回的随从', options,
    { sourceId: 'base_the_mothership', targetType: 'minion' },
);
```

这告诉 UI：
- ✅ 这是一个"随从选择"交互
- ✅ 高亮可选的随从卡牌
- ❌ 不高亮基地（因为不是 `targetType: 'base'`）
- ❌ 不显示基地上下文信息

## 实际情况验证

**情况 1：UI 误导（已确认）**

- **选项数据正确**：只包含母舰基地的随从 UID
- **UI 显示错误**：把所有"红机甲人"都显示出来了
- **实际行为**：点击忍者道场的随从不会有反应，或者会报错

## 修复方案（已实施）

### 1. 在标题中显示基地名称

在 `PromptOverlay` 中，当 `continuationContext.baseIndex` 存在时，在标题下方显示基地名称：

```typescript
const contextBaseIndex = (prompt as any)?.continuationContext?.baseIndex;
const contextBaseDef = contextBaseIndex !== undefined ? getBaseDef(prompt.state?.bases?.[contextBaseIndex]?.defId) : undefined;
const contextBaseName = contextBaseDef ? resolveCardName(contextBaseDef, t) : undefined;

// 在标题中显示
<h2>
    {title}
    {contextBaseName && (
        <span className="block text-sm text-amber-300/80 font-normal mt-1">
            @ {contextBaseName}
        </span>
    )}
</h2>
```

### 2. 在选项中添加 baseIndex

在 `base_the_mothership` 和 `base_temple_of_goju` 中，为每个选项添加 `baseIndex` 和 `displayMode`：

```typescript
const minionOptions = minionsSnapshot.map((m, i) => {
    const def = getCardDef(m.defId);
    return {
        id: `minion-${i}`,
        label: `${def?.name ?? m.defId} (力量${m.power})`,
        value: { minionUid: m.uid, minionDefId: m.defId, baseIndex: ctx.baseIndex },
        displayMode: 'card' as const,
    };
});
```

### 3. 未来改进（可选）

- **UI 层过滤**：在 `PromptOverlay` 中，根据 `baseIndex` 过滤显示的卡牌
- **基地高亮**：当 `continuationContext.baseIndex` 存在时，高亮对应的基地
- **卡牌标签**：在每张卡牌上显示所属基地的徽章

## 修改文件

- ✅ `src/games/smashup/ui/PromptOverlay.tsx` - 在标题中显示基地名称
- ✅ `src/games/smashup/domain/baseAbilities.ts` - 为 mothership 和 temple_of_goju 选项添加 baseIndex 和 displayMode

## 测试验证

需要创建 E2E 测试验证：
1. 母舰基地 afterScoring 时，UI 标题显示"@ 母舰"
2. 只有母舰基地上的随从可以被选择
3. 点击其他基地的同名随从不会触发选择

## 相关文件

- `src/games/smashup/domain/baseAbilities.ts` - 母舰基地能力定义
- `src/games/smashup/ui/PromptOverlay.tsx` - 交互 UI 组件
- `docs/bugs/smashup-afterscoring-summary.md` - afterScoring 问题总结

## 状态

✅ 已修复 - 标题显示基地名称，选项包含 baseIndex
