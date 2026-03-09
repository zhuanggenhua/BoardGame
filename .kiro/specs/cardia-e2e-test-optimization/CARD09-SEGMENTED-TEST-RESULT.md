# Card09 伏击者 - 分段测试结果

## ✅ 测试结果总结

### 测试 1：Reducer 函数测试

**文件**：`src/games/cardia/__tests__/reduce-cards-discarded.test.ts`

**结果**：✅ **通过**

```
Reduce 结果: {
  oldHandSize: 3,
  newHandSize: 1,
  oldDiscardSize: 0,
  newDiscardSize: 2
}

✓ 应该正确地从手牌弃掉指定的卡牌
```

**结论**：`reduceCardsDiscarded` 函数正确工作，能够正确地从手牌弃掉指定的卡牌。

---

### 测试 2：交互处理器测试

**文件**：`src/games/cardia/__tests__/ambusher-interaction-handler.test.ts`

**结果**：✅ **通过**

```
Handler found: true
Handler result: {
  hasResult: true,
  eventsCount: 1,
  events: [ { type: 'cardia:cards_discarded', payload: [Object] } ]
}

✅ 交互处理器正确返回 CARDS_DISCARDED 事件
```

**结论**：伏击者的交互处理器正确工作，能够正确返回 `CARDS_DISCARDED` 事件。

---

## 🔍 问题定位

既然 reducer 和交互处理器都正确，那么问题一定在 **`CardiaEventSystem.afterEvents` 钩子** 中。

### 可能的原因

1. **钩子没有被调用**
   - `CardiaEventSystem` 没有被正确注册到引擎
   - 系统优先级设置不正确
   - 钩子被其他系统覆盖

2. **钩子被调用但没有处理事件**
   - `getInteractionHandler` 返回 `undefined`（但单元测试显示它能正确返回）
   - `sourceId` 不匹配（可能是 `undefined` 或错误的值）
   - 事件类型不匹配（不是 `SYS_INTERACTION_RESOLVED`）

3. **钩子处理了事件但没有返回**
   - 返回的 `events` 数组为空（已修复，但可能没有生效）
   - 返回的 `state` 没有被应用
   - 代码没有被重新加载（缓存问题）

---

## 📋 下一步行动

### 优先级 1：验证 CardiaEventSystem 是否被调用

在 `src/games/cardia/domain/systems.ts` 的 `afterEvents` 钩子开头添加日志：

```typescript
afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
    console.log('[CardiaEventSystem] ===== afterEvents CALLED =====', {
        eventsCount: events.length,
        eventTypes: events.map(e => e.type),
        timestamp: new Date().toISOString(),
    });
    // ... 其余代码
}
```

然后运行 E2E 测试，查看是否有日志输出。

### 优先级 2：验证 getInteractionHandler 是否被调用

在 `CardiaEventSystem.afterEvents` 中添加日志：

```typescript
if (event.type === INTERACTION_EVENTS.RESOLVED) {
    const payload = event.payload as { sourceId?: string; ... };
    
    console.log('[CardiaEventSystem] INTERACTION_RESOLVED:', {
        sourceId: payload.sourceId,
        hasSourceId: !!payload.sourceId,
    });
    
    if (payload.sourceId) {
        const handler = getInteractionHandler(payload.sourceId);
        
        console.log('[CardiaEventSystem] Handler lookup:', {
            sourceId: payload.sourceId,
            handlerFound: !!handler,
        });
        
        // ... 其余代码
    }
}
```

### 优先级 3：如果钩子没有被调用

检查 `src/games/cardia/game.ts` 中的系统注册：

```typescript
systems: [
    createCardiaEventSystem(),  // ← 确认这一行存在
    createGameOverSystem(),
    // ... 其他系统
]
```

---

## 📊 测试覆盖率

- ✅ 单元测试：Reducer 函数（`reduceCardsDiscarded`）
- ✅ 单元测试：交互处理器（`registerFactionInteractionHandlers`）
- ❌ 集成测试：`CardiaEventSystem.afterEvents` 钩子
- ❌ E2E 测试：完整流程

---

## 相关文件

- `src/games/cardia/__tests__/reduce-cards-discarded.test.ts` - Reducer 测试
- `src/games/cardia/__tests__/ambusher-interaction-handler.test.ts` - 交互处理器测试
- `src/games/cardia/domain/reduce.ts` - Reducer 实现
- `src/games/cardia/domain/abilities/group7-faction.ts` - 交互处理器实现
- `src/games/cardia/domain/systems.ts` - CardiaEventSystem 实现
- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - E2E 测试

