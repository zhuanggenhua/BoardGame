# abilityId 字段审计报告

## 问题背景

Card02 虚空法师和 Card15 发明家的 bug 修复过程中发现：**创建交互时缺少 `abilityId` 字段**会导致交互处理器无法被调用。

`wrapCardiaInteraction` 函数从 `cardiaInteraction.abilityId` 读取 `sourceId`，如果 `abilityId` 为 `undefined`，则 `sourceId` 也为 `undefined`，导致 `CardiaEventSystem` 无法找到对应的交互处理器。

## 审计范围

所有在 `src/games/cardia/domain/abilities/` 目录下创建交互的代码。

## 审计结果

### ✅ 已修复

1. **Card02 虚空法师** (`group4-card-ops.ts`)
   - 位置：第 160 行
   - 状态：✅ 已添加 `abilityId: ctx.abilityId`

2. **Card15 发明家** (`group2-modifiers.ts`)
   - 位置：第一次交互和第二次交互
   - 状态：✅ 已添加 `abilityId` 字段

### ❌ 需要修复

3. **Card13 沼泽守卫** (`group4-card-ops.ts`)
   - 位置：第 44-56 行
   - 问题：❌ 缺少 `abilityId` 字段
   - 交互类型：`card_selection`
   - 修复：添加 `abilityId: ctx.abilityId`

4. **Card07 宫廷卫士** (`group2-modifiers.ts`)
   - 位置1：第 833-860 行（对手选择是否弃牌）
   - 位置2：第 903-918 行（选择要弃掉的牌）
   - 问题：❌ 两处都缺少 `abilityId` 字段
   - 交互类型：`choice` 和 `card_selection`
   - 修复：添加 `abilityId: ABILITY_IDS.COURT_GUARD`

### ⚠️ 需要进一步检查

5. **Card09 伏击者** (`group5-copy.ts`)
   - 位置：第 103、208、333 行
   - 代码：`interaction: result.interaction`
   - 状态：✅ **已确认正确**
   - 说明：
     - 伏击者自己创建的交互使用 `createCardSelectionInteraction(ctx.abilityId, ...)`，已包含 `abilityId`
     - 复制的交互 `result.interaction` 来自被复制能力的执行器，如果被复制能力（虚空法师、沼泽守卫）已修复，则复制的交互也包含 `abilityId`
     - **注意**：复制的交互的 `abilityId` 是被复制能力的 ID（如 `ability_i_void_mage`），而不是伏击者的 ID

6. **Card10 傀儡师** (`group5-copy.ts`)
   - 状态：✅ **已确认正确**（同 Card09）

7. **Card14 女导师** (`group5-copy.ts`)
   - 状态：✅ **已确认正确**（同 Card09）

## 修复优先级

1. **高优先级**：✅ Card13 沼泽守卫、Card07 宫廷卫士（已修复）
2. **中优先级**：✅ Card09/10/14（已确认正确，无需修复）

## 修复状态

✅ **所有问题已修复**

- Card02 虚空法师：✅ 已修复
- Card07 宫廷卫士：✅ 已修复（两处交互）
- Card13 沼泽守卫：✅ 已修复
- Card15 发明家：✅ 已修复
- Card09/10/14：✅ 已确认正确（使用 `createCardSelectionInteraction`，已包含 `abilityId`）

## 通用修复模式

```typescript
// ❌ 错误：缺少 abilityId
const interaction: any = {
    type: 'card_selection',
    interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
    playerId: ctx.playerId,
    title: '...',
    description: '...',
    availableCards: [...],
    minSelect: 1,
    maxSelect: 1,
};

// ✅ 正确：添加 abilityId
const interaction: CardiaInteraction = {
    type: 'card_selection',
    interactionId: `${ctx.abilityId}_${ctx.timestamp}`,
    playerId: ctx.playerId,
    abilityId: ctx.abilityId,  // ← 添加这一行
    title: '...',
    description: '...',
    availableCards: [...],
    minSelect: 1,
    maxSelect: 1,
};
```

## 注意事项

1. **类型声明**：使用 `CardiaInteraction` 类型而不是 `any`，确保类型安全
2. **一致性**：所有交互创建点都必须包含 `abilityId` 字段
3. **测试验证**：修复后必须运行对应的 E2E 测试验证
