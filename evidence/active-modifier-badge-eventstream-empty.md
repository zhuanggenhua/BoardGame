# ActiveModifierBadge 不显示 - EventStream 为空

## 问题根因

用户日志显示：
```
[useActiveModifiers] 首次挂载，扫描历史事件: {totalEntries: 0, restoredModifiers: Array(0)}
```

**EventStream 是空的**（`totalEntries: 0`），导致 `useActiveModifiers` 无法找到 CARD_PLAYED 事件。

## 可能的原因

### 1. EventStream 在页面加载时是空的（正常）

**预期行为**：
- 页面刚加载时，EventStream 是空的
- 用户打出 Volley 卡牌后，CARD_PLAYED 事件被添加到 EventStream
- `useActiveModifiers` 通过 `useEventStreamCursor` 消费新事件
- 新事件应该触发 `useEffect`，添加修正卡到列表

### 2. consumeNew() 没有返回新事件

**可能原因**：
- `useEventStreamCursor` 的游标没有正确推进
- EventStream 更新后，`useEffect` 没有被触发
- `consumeNew()` 返回空数组

## 调试步骤

### 已添加的日志

1. **首次挂载**：
   ```typescript
   console.log('[useActiveModifiers] 首次挂载，扫描历史事件:', {
       totalEntries: eventStreamEntries.length,
       restoredModifiers,
   });
   ```

2. **consumeNew 结果**：
   ```typescript
   console.log('[useActiveModifiers] consumeNew 结果:', {
       newEntriesCount: newEntries.length,
       didReset,
       totalEntries: eventStreamEntries.length,
   });
   ```

3. **CARD_PLAYED 事件**：
   ```typescript
   console.log('[useActiveModifiers] CARD_PLAYED 事件:', {
       cardId: p.cardId,
       card,
       isAttackModifier: card?.isAttackModifier,
   });
   ```

4. **添加新修正卡**：
   ```typescript
   console.log('[useActiveModifiers] 添加新修正卡:', newModifiers);
   ```

5. **RightSidebar props**：
   ```typescript
   console.log('[RightSidebar] activeModifiers:', activeModifiers);
   console.log('[RightSidebar] bonusDamage:', bonusDamage);
   ```

### 下一步验证

请再次运行游戏，使用 Volley 卡牌，查看控制台日志：

1. **打出 Volley 前**：
   - `[useActiveModifiers] 首次挂载` → 应该显示 `totalEntries: 0`

2. **打出 Volley 后**：
   - `[useActiveModifiers] consumeNew 结果` → 应该显示 `newEntriesCount > 0`
   - `[useActiveModifiers] CARD_PLAYED 事件` → 应该显示 `cardId: 'volley'`
   - `[useActiveModifiers] 添加新修正卡` → 应该显示修正卡列表
   - `[RightSidebar] activeModifiers` → 应该显示修正卡列表

## 预期日志输出

### 正常情况

```
// 页面加载
[useActiveModifiers] 首次挂载，扫描历史事件: {totalEntries: 0, restoredModifiers: []}

// 打出 Volley 卡牌
[useActiveModifiers] consumeNew 结果: {newEntriesCount: 3, didReset: false, totalEntries: 3}
[useActiveModifiers] CARD_PLAYED 事件: {cardId: 'volley', card: {...}, isAttackModifier: true}
[useActiveModifiers] 添加新修正卡: [{cardId: 'volley', ...}]
[RightSidebar] activeModifiers: [{cardId: 'volley', ...}]
[RightSidebar] bonusDamage: 2
```

### 异常情况：consumeNew 返回空数组

```
// 页面加载
[useActiveModifiers] 首次挂载，扫描历史事件: {totalEntries: 0, restoredModifiers: []}

// 打出 Volley 卡牌
[useActiveModifiers] consumeNew 结果: {newEntriesCount: 0, didReset: false, totalEntries: 3}
// 没有后续日志
```

**原因**：`useEventStreamCursor` 的游标没有正确推进，或者 `useEffect` 没有被触发

## 修改文件

- `src/games/dicethrone/hooks/useActiveModifiers.ts`：添加 `consumeNew` 结果日志

## 代码验证

### CARD_PLAYED 事件生成（已确认 ✅）

**位置**：`src/games/dicethrone/domain/executeCards.ts:157-167`

```typescript
const cardPlayedEvent: CardPlayedEvent = {
    type: 'CARD_PLAYED',
    payload: {
        playerId: actingPlayerId,
        cardId: card.id,
        cpCost: 0,
    },
    sourceCommandType: command.type,
    timestamp,
};
events.push(cardPlayedEvent);
```

**结论**：CARD_PLAYED 事件确实被创建并添加到 events 数组中。

### EventStream 集成（需要验证）

**问题**：events 数组是否被正确添加到 EventStream？

**验证方法**：
1. 检查 `executePipeline` 是否将 events 添加到 EventStream
2. 检查 EventStream 的 `entries` 是否包含 CARD_PLAYED 事件

### useEventStreamCursor 行为（需要验证）

**问题**：`consumeNew()` 是否正确返回新事件？

**可能原因**：
1. 首次挂载时调用 `consumeNew()` 推进了游标，跳过了所有历史事件
2. 后续 EventStream 更新时，`useEffect` 依赖项没有正确触发
3. `useEventStreamCursor` 的游标推进逻辑有问题

## 下一步验证

### 方案 A：等待用户日志（推荐）

请打出 Volley 卡牌后，把完整控制台日志发给我，特别是：
- `[useActiveModifiers] consumeNew 结果` 的输出
- 是否有 `[useActiveModifiers] CARD_PLAYED 事件` 的输出
- 是否有 `[useActiveModifiers] 添加新修正卡` 的输出
- `[RightSidebar] activeModifiers` 的输出

### 方案 B：添加更多日志（如果方案 A 不够）

如果日志显示 `consumeNew` 返回空数组，需要在 `useEventStreamCursor` 中添加日志：

```typescript
// src/engine/hooks/useEventStreamCursor.ts
const consumeNew = useCallback((): ConsumeResult => {
    console.log('[useEventStreamCursor] consumeNew called:', {
        entriesLength: entries.length,
        lastSeenId: lastSeenIdRef.current,
        isFirstCall: isFirstCallRef.current,
    });
    
    // ... 现有逻辑 ...
    
    const newEntries = entries.filter(e => e.id > lastSeenIdRef.current);
    console.log('[useEventStreamCursor] filtered newEntries:', {
        newEntriesLength: newEntries.length,
        newEntriesIds: newEntries.map(e => e.id),
        newEntriesTypes: newEntries.map(e => (e.event as any).type),
    });
    
    // ... 现有逻辑 ...
}, [entries, ...]);
```

### 方案 C：检查 EventStream 是否包含 CARD_PLAYED（如果方案 B 不够）

在 Board.tsx 中添加日志，验证 EventStream 是否包含 CARD_PLAYED 事件：

```typescript
React.useEffect(() => {
    const entries = rawG.sys.eventStream?.entries ?? [];
    const cardPlayedEvents = entries.filter(e => (e.event as any).type === 'CARD_PLAYED');
    console.log('[Board] EventStream 包含的 CARD_PLAYED 事件:', {
        totalEntries: entries.length,
        cardPlayedCount: cardPlayedEvents.length,
        cardPlayedEvents: cardPlayedEvents.map(e => ({
            id: e.id,
            cardId: (e.event as any).payload?.cardId,
        })),
    });
}, [rawG.sys.eventStream?.entries]);
```
