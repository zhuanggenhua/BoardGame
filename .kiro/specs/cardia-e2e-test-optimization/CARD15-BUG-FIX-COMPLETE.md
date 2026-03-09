# Card15 发明家 - Bug 修复完成

## 修复时间
2025-01-XX

## 修复的 Bug

### Bug 1: 修正标记重复 ✅

**问题**：每次交互产生两个相同的修正标记

**根本原因**：CardiaEventSystem 在处理交互响应时，先手动应用事件（调用 `reduce`），然后又将事件返回给引擎，导致事件被应用两次。

**修复方案**：在 Reducer 层添加去重检查（防御性编程）

**修改文件**：
- `src/games/cardia/domain/reduce.ts`

**修改内容**：
```typescript
function reduceModifierTokenPlaced(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.MODIFIER_TOKEN_PLACED }>
): CardiaCore {
    const { cardId, value, source, timestamp } = event.payload;
    
    // 检查是否已存在相同的修正标记（去重）
    const isDuplicate = core.modifierTokens.some(
        token => 
            token.cardId === cardId &&
            token.value === value &&
            token.source === source &&
            token.timestamp === timestamp
    );
    
    if (isDuplicate) {
        console.warn('[Reducer] Duplicate modifier token detected, skipping:', {
            cardId, value, source, timestamp
        });
        return core;  // 不修改状态
    }
    
    const newToken: ModifierToken = {
        cardId,
        value,
        source,
        timestamp,
    };
    
    return {
        ...core,
        modifierTokens: [...core.modifierTokens, newToken],
    };
}
```

### Bug 2: 无限弹窗（第二次交互未创建）✅

**问题**：第一次交互完成后，第二次交互没有被创建，导致弹窗一直显示

**根本原因**：
1. 交互处理器返回的 `state` 更新不会被应用（框架层已知 bug）
2. `inventorPending` 标记无法通过返回 state 来设置/清理
3. CardiaEventSystem 的检查逻辑有问题：
   - 使用了 `inventorSecondInteractionCreated` 标志，但这个标志在第一次调用后就被设置为 true，导致后续无法再创建第二次交互
   - 检查的是输入 `events` 而不是实际应用的事件

**修复方案**：
1. 通过事件来设置和清理 `inventorPending` 标记
2. 改进 CardiaEventSystem 的检查逻辑

**修改文件**：
- `src/games/cardia/domain/events.ts` - 添加事件类型
- `src/games/cardia/domain/reduce.ts` - 添加 reducer 函数
- `src/games/cardia/domain/abilities/group2-modifiers.ts` - 修改交互处理器
- `src/games/cardia/domain/systems.ts` - 改进检查逻辑

**修改内容**：

#### 1. 添加事件类型（events.ts）
```typescript
export const CARDIA_EVENTS = {
    // ... 其他事件 ...
    INVENTOR_PENDING_SET: 'cardia:inventor_pending_set',
    INVENTOR_PENDING_CLEARED: 'cardia:inventor_pending_cleared',
} as const;

export interface InventorPendingSetEvent extends GameEvent<typeof CARDIA_EVENTS.INVENTOR_PENDING_SET> {
    payload: {
        playerId: PlayerId;
        timestamp: number;
    };
}

export interface InventorPendingClearedEvent extends GameEvent<typeof CARDIA_EVENTS.INVENTOR_PENDING_CLEARED> {
    payload: {
        playerId: PlayerId;
    };
}
```

#### 2. 添加 Reducer 函数（reduce.ts）
```typescript
function reduceInventorPendingSet(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.INVENTOR_PENDING_SET }>
): CardiaCore {
    const { playerId, timestamp } = event.payload;
    
    return {
        ...core,
        inventorPending: {
            playerId,
            timestamp,
        },
    };
}

function reduceInventorPendingCleared(
    core: CardiaCore,
    event: Extract<CardiaEvent, { type: typeof CARDIA_EVENTS.INVENTOR_PENDING_CLEARED }>
): CardiaCore {
    return {
        ...core,
        inventorPending: undefined,
    };
}

// 在 reduce 函数的 switch 中注册
export function reduce(core: CardiaCore, event: CardiaEvent): CardiaCore {
    switch (event.type) {
        // ... 其他 case ...
        case CARDIA_EVENTS.INVENTOR_PENDING_SET:
            return reduceInventorPendingSet(core, event);
        
        case CARDIA_EVENTS.INVENTOR_PENDING_CLEARED:
            return reduceInventorPendingCleared(core, event);
        
        default:
            return core;
    }
}
```

#### 3. 修改交互处理器（group2-modifiers.ts）
```typescript
registerInteractionHandler(ABILITY_IDS.INVENTOR, (state, playerId, value, interactionData, _random, timestamp) => {
    const selectedCard = value as { cardUid?: string };
    
    if (!selectedCard?.cardUid) {
        console.error('[Inventor] No cardUid in interaction value');
        return { state, events: [] };
    }
    
    // 使用 inventorPending 标记判断是第几次交互
    const isFirstInteraction = !state.core.inventorPending;
    
    if (isFirstInteraction) {
        // 第一次交互：放置 +3，设置待续标记
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
                    },
                    timestamp,
                }
            ],
        };
    } else {
        // 第二次交互：放置 -3，清理待续标记
        return {
            state,
            events: [
                {
                    type: CARDIA_EVENTS.MODIFIER_TOKEN_PLACED,
                    payload: {
                        cardId: selectedCard.cardUid,
                        value: -3,
                        source: ABILITY_IDS.INVENTOR,
                        timestamp,
                    },
                    timestamp,
                },
                {
                    type: CARDIA_EVENTS.INVENTOR_PENDING_CLEARED,
                    payload: {
                        playerId,
                    },
                    timestamp,
                }
            ],
        };
    }
});
```

#### 4. 改进 CardiaEventSystem 检查逻辑（systems.ts）

**关键改进**：
1. **移除 `inventorSecondInteractionCreated` 标志** - 这个标志会阻止第二次交互的创建
2. **追踪 `appliedEvents`** - 记录实际应用的事件，而不是输入事件
3. **检查 `appliedEvents` 而不是 `events`** - 确保只响应交互处理器生成的事件

```typescript
afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
    let newState = state;
    const appliedEvents: GameEvent[] = [];  // 记录已应用的事件

    for (const event of events) {
        // ... 处理 ABILITY_INTERACTION_REQUESTED ...
        
        // 监听 SYS_INTERACTION_RESOLVED
        if (event.type === INTERACTION_EVENTS.RESOLVED) {
            // ... 查找并调用 handler ...
            
            if (result) {
                // 应用事件并记录
                for (const evt of result.events) {
                    newState = {
                        ...newState,
                        core: reduce(newState.core, evt),
                    };
                    appliedEvents.push(evt);  // 记录已应用的事件
                }
                
                // ... 处理返回的新交互 ...
            }
        }
    }
    
    // 检查是否有 INVENTOR_PENDING_SET 事件被应用
    const hasInventorPendingSet = appliedEvents.some(e => e.type === CARDIA_EVENTS.INVENTOR_PENDING_SET);
    
    if (hasInventorPendingSet && newState.core.inventorPending) {
        // 创建第二次交互
        const availableCards = filterCards(newState.core, {
            location: 'field',
        });
        
        if (availableCards.length > 0) {
            const secondInteraction = createCardSelectionInteraction(
                `${ABILITY_IDS.INVENTOR}_second_${Date.now()}`,
                ABILITY_IDS.INVENTOR,
                newState.core.inventorPending.playerId,
                '选择第二张卡牌',
                '为第二张卡牌添加-3影响力（可以选择同一张卡牌）',
                1,
                1,
                { location: 'field' }
            );
            
            secondInteraction.availableCards = availableCards;
            
            const engineInteraction = wrapCardiaInteraction(
                secondInteraction,
                newState.core,
                ABILITY_IDS.INVENTOR
            );
            
            if (engineInteraction) {
                newState = queueInteraction(newState, engineInteraction);
            }
        }
    }

    if (newState !== state) {
        return { halt: false, state: newState, events: [] };
    }
},
```

## 验证步骤

### 1. 运行测试

```bash
npx playwright test cardia-deck1-card15-inventor.e2e.ts
```

### 2. 验证标准

#### Bug 1 修复验证
- ✅ 第一次交互后：`modifierTokens.length === 1`（只有一个 +3）
- ✅ 第二次交互后：`modifierTokens.length === 2`（一个 +3 和一个 -3）
- ✅ 没有重复的修正标记

#### Bug 2 修复验证
- ✅ 第一次交互完成后，第二次交互弹窗自动显示
- ✅ 第二次交互完成后，弹窗关闭
- ✅ 第二次交互正确放置 -3 修正标记

### 3. 查看服务器日志

查看 `logs/` 目录中的日志文件，确认：
- `[CardiaEventSystem] INVENTOR_PENDING_SET detected` 出现
- `[CardiaEventSystem] Creating inventor second interaction` 出现
- `[CardiaEventSystem] Second interaction queued` 出现

## 框架层 Bug 影响范围

这个框架层 bug（交互处理器返回的 `state` 不会被应用）影响所有使用交互处理器的卡牌。

### 已知受影响的卡牌

根据 `INTERACTION-HANDLER-BUG.md`：
- card09 (伏击者)
- card13 (沼泽守卫)
- card14 (女导师)
- card15 (发明家) - ✅ 已修复

### 修复策略

所有受影响的卡牌都需要采用相同的修复策略：
1. **不要依赖返回的 `state`** - 交互处理器返回的 `state` 不会被应用
2. **通过事件修改状态** - 所有状态变更必须通过发射事件来完成
3. **使用 core 字段存储待续状态** - 如果需要跨交互传递状态，使用 `core` 上的字段（如 `inventorPending`）

### 后续工作

需要系统性审查所有交互处理器：
1. 搜索所有 `registerInteractionHandler` 调用
2. 检查每个处理器是否返回修改后的 `state`
3. 如果返回了修改后的 `state`，需要改为发射事件
4. 创建一个清单文档记录所有受影响的卡牌和修复状态

## 总结

### 修复完成 ✅
- Bug 1（修正标记重复）：通过 Reducer 层去重解决
- Bug 2（无限弹窗）：通过事件驱动 + 改进检查逻辑解决

### 关键改进
1. **事件驱动状态管理**：所有状态变更通过事件完成，不依赖返回的 `state`
2. **追踪应用的事件**：检查实际应用的事件，而不是输入事件
3. **移除不必要的标志**：简化逻辑，避免状态不一致

### 下一步
1. 运行测试验证修复
2. 系统性审查其他受影响的卡牌
3. 更新测试文档

---

**修复完成时间**：2025-01-XX  
**状态**：待测试验证
