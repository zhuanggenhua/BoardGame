# Card15 发明家 Bug 3 修复完成

## 问题描述

发明家（Card15）的第三个 bug：第一次和第二次选择的牌不能重复。

根据规则："添加+3影响力到任一张牌，并添加-3影响力到**另外**任一张牌"，第二次选择必须排除第一次选择的卡牌。

## 根本原因

当前实现允许第一次和第二次交互选择同一张卡牌，违反了"另外任一张牌"的规则要求。

## 修复方案

### 1. 修改 `inventorPending` 结构

**文件**: `src/games/cardia/domain/core-types.ts`

```typescript
inventorPending?: {
    playerId: PlayerId;
    timestamp: number;
    firstCardId: string;  // 添加：第一次选择的卡牌 ID
};
```

### 2. 修改事件类型

**文件**: `src/games/cardia/domain/events.ts`

```typescript
export interface InventorPendingSetEvent extends GameEvent<typeof CARDIA_EVENTS.INVENTOR_PENDING_SET> {
    payload: {
        playerId: PlayerId;
        timestamp: number;
        firstCardId: string;  // 添加：第一次选择的卡牌 ID
    };
}
```

### 3. 修改 Reducer

**文件**: `src/games/cardia/domain/reduce.ts`

```typescript
function reduceInventorPendingSet(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.INVENTOR_PENDING_SET }>
): CardiaCore {
    const { playerId, timestamp, firstCardId } = event.payload;
    
    return {
        ...core,
        inventorPending: {
            playerId,
            timestamp,
            firstCardId,  // 存储第一次选择的卡牌 ID
        },
    };
}
```

### 4. 修改交互处理器

**文件**: `src/games/cardia/domain/abilities/group2-modifiers.ts`

```typescript
if (isFirstInteraction) {
    return {
        state,
        events: [
            {
                type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                payload: {
                    cardId: selectedCard.cardUid,
                    value: 3,
                    source: ABILITY_IDS.INVENTOR,
                    timestamp,
                },
                timestamp,
            },
            {
                type: CARDIA_EVENTS.INVENTOR_PENDING_SET,
                payload: {
                    playerId,
                    timestamp,
                    firstCardId: selectedCard.cardUid,  // 记录第一次选择的卡牌
                },
                timestamp,
            }
        ],
    };
}
```

### 5. 修改 CardiaEventSystem

**文件**: `src/games/cardia/domain/systems.ts`

```typescript
if (hasInventorPendingSet && newState.core.inventorPending) {
    // 获取所有场上卡牌，排除第一次选择的卡牌
    const availableCards = filterCards(newState.core, {
        location: 'field',
    }).filter(cardId => cardId !== newState.core.inventorPending!.firstCardId);
    
    // 创建第二次交互
    const secondInteraction = createCardSelectionInteraction(
        `${ABILITY_IDS.INVENTOR}_second_${Date.now()}`,
        ABILITY_IDS.INVENTOR,
        newState.core.inventorPending.playerId,
        '选择第二张卡牌',
        '为第二张卡牌添加-3影响力（不能选择第一张卡牌）',
        1,
        1,
        { location: 'field' }
    );
    
    secondInteraction.availableCards = availableCards;
    // ...
}
```

## 测试验证

### 测试文件

`e2e/cardia-deck1-card15-inventor-fixed.e2e.ts`

### 测试场景

1. P1 打出发明家（影响力15），P2 打出精灵（影响力16）
2. P1 失败，激活发明家能力
3. 第一次交互：选择 P1 的外科医生（test_0_2000）
4. 验证第二次交互不包含外科医生
5. 第二次交互：选择 P1 的发明家（test_0_0）
6. 验证两个修正标记在不同的卡牌上

### 测试结果

```
✅ 第二次交互不包含第一张卡牌
✅ 找到 +3 修正标记
✅ 找到 -3 修正标记
✅ +3 和 -3 修正标记在不同的卡牌上
✅ 所有断言通过
```

## 修复效果

- ✅ 第一次交互：可以选择任意场上卡牌（4 张）
- ✅ 第二次交互：只能选择除第一张外的卡牌（3 张）
- ✅ 两个修正标记正确放置在不同的卡牌上
- ✅ 符合规则："另外任一张牌"

## 相关文件

- `src/games/cardia/domain/core-types.ts` - 类型定义
- `src/games/cardia/domain/events.ts` - 事件类型
- `src/games/cardia/domain/reduce.ts` - Reducer
- `src/games/cardia/domain/abilities/group2-modifiers.ts` - 交互处理器
- `src/games/cardia/domain/systems.ts` - CardiaEventSystem
- `e2e/cardia-deck1-card15-inventor-fixed.e2e.ts` - 测试文件

## 总结

发明家的三个 bug 已全部修复：

1. ✅ Bug 1: 修正标记重复 - 通过 reducer 去重检查修复
2. ✅ Bug 2: 无限弹窗 - 通过事件驱动的 inventorPending 标记修复
3. ✅ Bug 3: 第一次和第二次选择的牌不能重复 - 通过 firstCardId 过滤修复

所有修复均通过 E2E 测试验证。
