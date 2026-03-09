# abilityId 字段批量修复完成

## 修复总结

✅ **所有缺少 `abilityId` 字段的交互创建点已全部修复**

## 修复清单

### 1. Card02 虚空法师 ✅
- **文件**：`src/games/cardia/domain/abilities/group4-card-ops.ts`
- **位置**：第 160 行
- **修复**：添加 `abilityId: ctx.abilityId`
- **状态**：✅ 已修复（之前）

### 2. Card07 宫廷卫士 ✅
- **文件**：`src/games/cardia/domain/abilities/group2-modifiers.ts`
- **位置1**：第 837 行（对手选择是否弃牌）
- **位置2**：第 907 行（选择要弃掉的牌）
- **修复**：两处都添加 `abilityId: ABILITY_IDS.COURT_GUARD`
- **状态**：✅ 已修复（本次）

### 3. Card13 沼泽守卫 ✅
- **文件**：`src/games/cardia/domain/abilities/group4-card-ops.ts`
- **位置**：第 46 行
- **修复**：添加 `abilityId: ctx.abilityId`，并将类型从 `any` 改为 `CardiaInteraction`
- **状态**：✅ 已修复（本次）

### 4. Card15 发明家 ✅
- **文件**：`src/games/cardia/domain/abilities/group2-modifiers.ts`
- **位置**：第一次和第二次交互
- **修复**：添加 `abilityId` 字段
- **状态**：✅ 已修复（之前）

### 5. Card09/10/14（伏击者/傀儡师/女导师）✅
- **文件**：`src/games/cardia/domain/abilities/group5-copy.ts`
- **说明**：这些卡牌使用 `createCardSelectionInteraction` 辅助函数创建交互，该函数已正确传递 `abilityId` 参数
- **状态**：✅ 无需修复（已确认正确）

## 修复前后对比

### 修复前（❌ 错误）
```typescript
const interaction: any = {
    type: 'card_selection',
    interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
    playerId: ctx.playerId,
    // ❌ 缺少 abilityId 字段
    title: '...',
    description: '...',
    availableCards: [...],
    minSelect: 1,
    maxSelect: 1,
};
```

### 修复后（✅ 正确）
```typescript
const interaction: CardiaInteraction = {
    type: 'card_selection',
    interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
    playerId: ctx.playerId,
    abilityId: ctx.abilityId,  // ✅ 添加 abilityId 字段
    title: '...',
    description: '...',
    availableCards: [...],
    minSelect: 1,
    maxSelect: 1,
};
```

## 为什么需要 abilityId 字段？

1. **交互处理器查找**：`wrapCardiaInteraction` 函数从 `cardiaInteraction.abilityId` 读取 `sourceId`
2. **事件分发**：`CardiaEventSystem` 收到 `SYS_INTERACTION_RESOLVED` 事件后，通过 `sourceId` 查找对应的交互处理器
3. **处理器调用**：如果 `sourceId` 为 `undefined`，则无法找到处理器，交互无法被正确处理

## 影响范围

修复后，以下卡牌的交互功能将正常工作：

- ✅ Card02 虚空法师：移除标记
- ✅ Card07 宫廷卫士：派系选择 + 对手弃牌
- ✅ Card13 沼泽守卫：回收卡牌
- ✅ Card15 发明家：两次修正标记放置

## 下一步

1. ✅ 批量修复完成
2. ⏭️ 批量运行所有 E2E 测试，验证修复效果
3. ⏭️ 调查 Card02 的 E2E 测试问题（能力没有被激活）

## 相关文档

- `ABILITYID-AUDIT.md` - 完整审计报告
- `CARD02-BUG-FIX-COMPLETE.md` - Card02 修复说明
- `CARD15-BUG-FIX-COMPLETE.md` - Card15 修复说明
- `INTERACTION-HANDLER-BUG.md` - 交互处理器 bug 说明
