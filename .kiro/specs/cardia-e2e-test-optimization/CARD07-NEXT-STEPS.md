# Card07 宫廷卫士测试失败 - 下一步调试计划

## 当前状态
- 测试能够成功执行 UI 交互（派系选择弹窗、选项点击、弹窗关闭）
- 但修正标记（+7影响力）没有被添加到 `modifierTokens` 数组中
- 添加了客户端日志监听器，但没有看到任何 `[CardiaEventSystem]` 日志
- 这说明 `afterEvents` hook 可能根本没有被调用，或者事件数组为空

## 可能的根本原因

### 假设 1：交互没有被正确解决
**症状**：UI 弹窗关闭了，但 `INTERACTION_EVENTS.RESOLVED` 事件没有被触发

**验证方法**：
1. 在 `InteractionSystem` 中添加日志，确认 `RESOLVED` 事件是否被触发
2. 检查 `sourceId` 是否正确传递

**如果是这个问题**：
- 需要检查 `wrapCardiaInteraction` 中的 `sourceId` 提取逻辑
- 需要确认 `createSimpleChoice` 的第4个参数（metadata）是否正确传递

### 假设 2：`sourceId` 不匹配
**症状**：`RESOLVED` 事件被触发，但 `getInteractionHandler(sourceId)` 返回 `undefined`

**验证方法**：
1. 打印 `payload.sourceId` 的值
2. 打印 `ABILITY_IDS.COURT_GUARD` 的值
3. 检查交互处理器注册表中是否有对应的 handler

**如果是这个问题**：
- `interactionId` 格式可能不是 `"${abilityId}_${timestamp}"`
- `sourceId` 提取逻辑 `interactionId.replace(/_\d+$/, '')` 可能不正确
- 交互处理器可能没有被正确注册

### 假设 3：交互处理器返回了空事件
**症状**：Handler 被调用，但返回的 `events` 数组为空

**验证方法**：
1. 在交互处理器中添加日志，打印 `value` 和 `interactionData`
2. 检查 `value` 的格式是否符合预期（应该是 `{ faction: 'swamp' }`）
3. 检查 `interactionData.cardId` 是否存在

**如果是这个问题**：
- `value` 格式不对（可能是 `'faction_swamp'` 而不是 `{ faction: 'swamp' }`）
- `interactionData.cardId` 缺失
- 交互处理器的逻辑有问题

### 假设 4：事件被返回但没有被 reduce
**症状**：Handler 返回了事件，但 `modifierTokens` 数组仍然为空

**验证方法**：
1. 在 `reduce` 函数中添加日志，确认 `MODIFIER_TOKEN_PLACED` 事件是否被处理
2. 检查 reducer 的逻辑是否正确

**如果是这个问题**：
- Reducer 逻辑有 bug
- 事件的 payload 格式不对
- 状态没有正确同步到客户端

## 推荐的调试步骤

### 第1步：验证交互是否被解决
在 `src/engine/systems/InteractionSystem.ts` 中添加日志：

```typescript
// 在 resolveInteraction 函数中
console.log('[InteractionSystem] Resolving interaction:', {
    interactionId: interaction.id,
    sourceId: interaction.sourceId,
    playerId,
    optionId,
    value,
});
```

### 第2步：验证 sourceId 提取逻辑
在 `src/games/cardia/domain/systems.ts` 中添加日志：

```typescript
// 在 wrapCardiaInteraction 函数中
const sourceId = cardiaInteraction.interactionId.replace(/_\d+$/, '');
console.log('[wrapCardiaInteraction] Extracted sourceId:', {
    interactionId: cardiaInteraction.interactionId,
    sourceId,
    expectedAbilityId: 'ability_i_court_guard',
});
```

### 第3步：验证交互处理器是否被调用
在 `src/games/cardia/domain/systems.ts` 的 `afterEvents` hook 中添加更多日志：

```typescript
if (event.type === INTERACTION_EVENTS.RESOLVED) {
    console.log('[CardiaEventSystem] INTERACTION_RESOLVED:', {
        sourceId: payload.sourceId,
        playerId: payload.playerId,
        value: payload.value,
        interactionData: payload.interactionData,
    });

    if (payload.sourceId) {
        const handler = getInteractionHandler(payload.sourceId);
        console.log('[CardiaEventSystem] Handler found:', !!handler, 'for sourceId:', payload.sourceId);
        
        if (handler) {
            const result = handler(...);
            console.log('[CardiaEventSystem] Handler result:', {
                hasState: !!result?.state,
                eventsCount: result?.events?.length || 0,
                events: result?.events?.map(e => e.type),
            });
        } else {
            console.log('[CardiaEventSystem] No handler found for sourceId:', payload.sourceId);
            console.log('[CardiaEventSystem] Available handlers:', Object.keys(getAllHandlers()));
        }
    }
}
```

### 第4步：验证 reducer 是否被调用
在 `src/games/cardia/domain/reduce.ts` 中添加日志：

```typescript
function reduceModifierTokenPlaced(core: CardiaCore, event: CardiaEvent): CardiaCore {
    console.log('[Reducer] MODIFIER_TOKEN_PLACED:', event.payload);
    // ... 现有逻辑
}
```

## 最可能的问题

基于当前的证据，我认为最可能的问题是：

**`sourceId` 不匹配**

原因：
1. `wrapCardiaInteraction` 中的 `sourceId` 提取逻辑可能不正确
2. `interactionId` 的格式可能不是 `"${abilityId}_${timestamp}"`
3. 实际的 `interactionId` 可能是 `"ability_i_court_guard_faction_selection_1234567890"`

解决方案：
1. 打印 `interactionId` 的实际值
2. 调整 `sourceId` 提取逻辑，使用更健壮的方法（例如从 `cardiaInteraction` 中直接获取 `abilityId`）

## 下一步行动

1. **立即添加日志**：在 `wrapCardiaInteraction` 和 `afterEvents` hook 中添加详细日志
2. **重新运行测试**：查看日志输出，确定问题的根本原因
3. **根据日志结果**：选择对应的修复方案

## 备选方案：直接从 cardiaInteraction 获取 abilityId

如果 `interactionId` 的格式不可靠，可以考虑在 `CardiaInteraction` 接口中添加 `abilityId` 字段：

```typescript
export interface CardiaInteraction {
    interactionId: string;
    abilityId: string;  // ← 新增字段
    playerId: string;
    title: string;
    type: 'card_selection' | 'faction_selection' | 'modifier_selection';
    // ...
}
```

然后在 `wrapCardiaInteraction` 中直接使用：

```typescript
const interaction = createSimpleChoice(
    cardiaInteraction.interactionId,
    cardiaInteraction.playerId,
    cardiaInteraction.title,
    options,
    {
        sourceId: cardiaInteraction.abilityId,  // ← 直接使用 abilityId
        targetType: 'generic',
    }
);
```

这样可以避免依赖 `interactionId` 的格式约定。
