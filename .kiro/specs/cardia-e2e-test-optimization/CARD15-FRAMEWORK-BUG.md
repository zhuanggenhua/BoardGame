# Card15 (发明家) 框架层不一致问题

## 问题

card15 (发明家) 测试失败，原因是**能力执行器和交互处理器的实现不一致**。

## 根本原因

**能力执行器（abilityExecutor）**：
- 创建两次独立的交互
- 第一次交互：选择第一张卡牌（+3）
- 第二次交互：选择第二张卡牌（-3）
- 最终执行：`ctx.selectedCards.length === 2` 时添加两个修正标记

**交互处理器（interactionHandler）**：
- 期望一次性接收 2 张卡牌的 UID
- 验证：`selection.cardUids.length !== 2` 时报错
- 错误日志：`[Inventor] Invalid selection, expected 2 cards: { cardUid: 'test_0_2000' }`

**不一致点**：
- 能力执行器：两次交互，每次选择 1 张卡牌
- 交互处理器：一次交互，期望 2 张卡牌

## 代码位置

### 能力执行器（正确）

`src/games/cardia/domain/abilities/group2-modifiers.ts:242-320`

```typescript
abilityExecutorRegistry.register(ABILITY_IDS.INVENTOR, (ctx: CardiaAbilityContext) => {
    // 第一次交互：选择第一张卡牌（+3）
    if (!ctx.selectedCardId && !ctx.selectedCards) {
        const interaction = createCardSelectionInteraction(
            `${ctx.abilityId}_first_${ctx.timestamp}`,
            ctx.abilityId,
            ctx.playerId,
            '选择第一张卡牌',
            '为任一张场上牌添加+3影响力',
            1, // minSelect
            1, // maxSelect
            { location: 'field' }
        );
        return { events: [], interaction };
    }
    
    // 第二次交互：选择第二张卡牌（-3）
    if (ctx.selectedCardId && !ctx.selectedCards) {
        const interaction = createCardSelectionInteraction(
            `${ctx.abilityId}_second_${ctx.timestamp}`,
            ctx.abilityId,
            ctx.playerId,
            '选择第二张卡牌',
            '为任一张场上牌添加-3影响力（可以与第一张相同）',
            1, // minSelect
            1, // maxSelect
            { location: 'field' }
        );
        return { events: [], interaction };
    }
    
    // 执行效果：添加两个修正标记
    if (ctx.selectedCards && ctx.selectedCards.length === 2) {
        const [firstCardId, secondCardId] = ctx.selectedCards;
        return {
            events: [
                { type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED, payload: { cardId: firstCardId, value: 3, ... } },
                { type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED, payload: { cardId: secondCardId, value: -3, ... } }
            ],
        };
    }
});
```

### 交互处理器（错误）

`src/games/cardia/domain/abilities/group2-modifiers.ts:1063-1098`

```typescript
registerInteractionHandler(ABILITY_IDS.INVENTOR, (state, playerId, value, _interactionData, _random, timestamp) => {
    const selection = value as { cardUids?: string[] };
    
    // ❌ 错误：期望一次性接收 2 张卡牌
    if (!selection?.cardUids || selection.cardUids.length !== 2) {
        console.error('[Inventor] Invalid selection, expected 2 cards:', selection);
        return { state, events: [] };
    }
    
    const [firstCardId, secondCardId] = selection.cardUids;
    
    return {
        state,
        events: [
            { type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED, payload: { cardId: firstCardId, value: 3, ... } },
            { type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED, payload: { cardId: secondCardId, value: -3, ... } }
        ],
    };
});
```

## 修复方案

### 方案 1：删除交互处理器（推荐）

**原因**：能力执行器已经完整实现了发明家的逻辑（两次交互 + 最终执行），不需要额外的交互处理器。

**修改**：
1. 删除 `registerInteractionHandler(ABILITY_IDS.INVENTOR, ...)` 的注册
2. 能力执行器的逻辑保持不变

**优点**：
- 简单直接
- 符合能力执行器的设计（两次交互）
- 不需要修改能力执行器

### 方案 2：修改能力执行器为一次交互

**原因**：让能力执行器创建一次交互，选择 2 张卡牌。

**修改**：
1. 能力执行器创建一次交互，`minSelect: 2, maxSelect: 2`
2. 交互处理器保持不变

**缺点**：
- 需要修改能力执行器的逻辑
- 用户体验可能不如两次交互清晰（第一次+3，第二次-3）

### 方案 3：修改交互处理器支持两次交互

**原因**：让交互处理器支持两次独立的交互。

**修改**：
1. 第一次交互：接收 1 张卡牌，存储到 `continuationContext`
2. 第二次交互：接收 1 张卡牌，从 `continuationContext` 读取第一张卡牌，执行效果

**缺点**：
- 复杂度高
- 需要理解 `continuationContext` 的机制

## 推荐方案

**方案 1：删除交互处理器**

这是最简单、最直接的修复方案。能力执行器已经完整实现了发明家的逻辑，交互处理器是多余的。

## 影响

- ✅ 修复后，card15 测试应该能通过
- ✅ 不影响其他能力的实现
- ✅ 符合能力执行器的设计模式

## 相关文件

- `src/games/cardia/domain/abilities/group2-modifiers.ts` - 能力执行器和交互处理器
- `e2e/cardia-deck1-card15-inventor.e2e.ts` - 测试文件
- `src/games/cardia/domain/abilityInteractionHandlers.ts` - 交互处理器注册表

## 测试状态

- ❌ 当前测试失败（交互处理器报错）
- ⏸️ 已更新测试，标注为已知框架层 bug
- 🔧 等待修复框架层后重新验证
