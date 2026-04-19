# SmashUp afterScoring 时序测试结果

## 测试目标

验证 afterScoring 响应窗口打开时，基地上的随从是否还在。

## 测试方法

直接查看现有测试 `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`，该测试验证了：

1. afterScoring 响应窗口打开时，`sys.afterScoringInitialPowers` 被设置
2. 响应窗口关闭时，`SmashUpEventSystem` 监听 `RESPONSE_WINDOW_CLOSED` 事件
3. 补发 `BASE_CLEARED` 和 `BASE_REPLACED` 事件

## 关键发现

### 1. 响应窗口打开时的状态

测试中的初始状态：

```typescript
const initialState = {
    core: {
        bases: [
            {
                defId: 'base_the_jungle',
                breakpoint: 12,
                minions: [],  // ← 注意：测试中基地上没有随从
                ongoingCards: [],
            },
        ],
        // ...
    },
    sys: {
        responseWindow: {
            current: {
                id: 'afterScoring-0',
                windowType: 'afterScoring',
                // ...
            },
        },
        afterScoringInitialPowers: {
            baseIndex: 0,
            powers: { '0': 0, '1': 0 },
        },
    },
};
```

**问题**：这个测试的初始状态中，基地上已经没有随从了！

**原因**：这个测试的目的是验证"响应窗口关闭后补发 BASE_CLEARED"，而不是验证"响应窗口打开时随从还在"。

### 2. 计分流程分析

根据 `src/games/smashup/domain/index.ts` 中的 `scoreOneBase` 函数：

```typescript
// 如果需要打开 afterScoring 响应窗口
if (playersWithAfterScoringCards.length > 0) {
    // 记录初始力量
    ms = {
        ...ms,
        sys: {
            ...ms.sys,
            afterScoringInitialPowers: {
                baseIndex,
                powers: Object.fromEntries(initialPowers.entries()),
            } as any,
        },
    };
    
    // 打开响应窗口
    const afterScoringWindowEvt = openAfterScoringWindow(...);
    events.push(afterScoringWindowEvt);
    
    // 【关键】立即 return，延迟发出 BASE_CLEARED/BASE_REPLACED
    return { events, newBaseDeck, matchState: ms };
}

// 只有不需要打开响应窗口时，才会立即发出 BASE_CLEARED
events.push(...postScoringEvents); // 包含 BASE_CLEARED 和 BASE_REPLACED
```

**结论**：当打开 afterScoring 响应窗口时，`scoreOneBase` 函数会立即 `return`，不会发出 BASE_CLEARED 事件。

**这意味着：响应窗口打开时，基地上的随从还在！**

### 3. 响应窗口关闭后的处理

`SmashUpEventSystem` 监听 `RESPONSE_WINDOW_CLOSED` 事件：

```typescript
// 监听 RESPONSE_WINDOW_CLOSED → 补发 afterScoring 延迟事件
if (event.type === RESPONSE_WINDOW_EVENTS.CLOSED) {
    // 检查是否是 afterScoring 响应窗口关闭
    if (newState.sys.afterScoringInitialPowers) {
        const { baseIndex: scoredBaseIndex } = newState.sys.afterScoringInitialPowers as any;
        const currentBase = newState.core.bases[scoredBaseIndex];
        
        if (currentBase) {
            // 发出 BASE_CLEARED 事件
            const clearEvt: BaseClearedEvent = { ... };
            nextEvents.push(clearEvt);
            
            // 替换基地
            if (newState.core.baseDeck.length > 0) {
                const replaceEvt: BaseReplacedEvent = { ... };
                nextEvents.push(replaceEvt);
            }
        }
    }
}
```

**结论**：响应窗口关闭后，才会补发 BASE_CLEARED 和 BASE_REPLACED 事件。

## 最终结论

**计分流程不需要重构！** 当前的流程是正确的：

1. BASE_SCORED
2. 触发 afterScoring 基地能力和 ongoing
3. **打开 afterScoring 响应窗口**（BASE_CLEARED 延迟）
4. **玩家打出 afterScoring 卡牌**（基地上的随从还在）
5. **响应窗口关闭后**，补发 BASE_CLEARED 和 BASE_REPLACED

## 用户问题的真正原因

用户反馈"计分后牌打出没效果"，可能的原因：

1. **前置条件不满足**：
   - "承受压力"需要"从计分基地上的随从转移力量指示物到其他基地的随从"
   - "重返深海"需要"基地上有同名随从"
   - "我们乃最强"需要"基地上有己方有力量指示物的随从"

2. **反馈不足**：
   - "承受压力"有反馈（"场上没有符合条件的目标"）✅
   - "重返深海"没有反馈 ❌
   - "我们乃最强"没有反馈 ❌

## 需要修复的问题

**改进反馈机制**：当 afterScoring 卡牌无法找到目标时，生成 `ABILITY_FEEDBACK` 事件，告诉用户"为什么没有效果"。

**不需要重构计分流程**：当前的流程已经是正确的。
