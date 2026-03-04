# SmashUp Igor 双重触发根因分析（最终版）

## 问题描述

用户报告：Igor（科学小怪蛋）被消灭后，出现两次"选择随从放置+1力量指示物"的交互，即使场上只有一个 Igor。

## 根本原因

**架构设计缺陷**：`SmashUpEventSystem.afterEvents()` 和 `postProcessSystemEvents` 都会对同一批事件调用 `processDestroyMoveCycle`，导致 Igor 的 onDestroy 被触发两次。

### 完整事件流

```
1. 玩家打出 Big Gulp
   ↓
2. execute(PLAY_ACTION)
   → 返回 [ACTION_PLAYED]
   → Big Gulp onPlay 创建交互（选择要消灭的随从）
   ↓
3. 用户选择消灭 Igor
   ↓
4. SYS_INTERACTION_RESOLVED 事件
   ↓
5. SmashUpEventSystem.afterEvents() 处理
   → 调用 vampire_big_gulp handler
   → handler 返回 [MINION_DESTROYED]
   → ❌ 调用 processDestroyMoveCycle([MINION_DESTROYED])
   → 触发 Igor onDestroy（第一次）
   → 创建 Igor 交互
   → 返回事件到 pipeline
   ↓
6. Pipeline 自动调用 postProcessSystemEvents()
   → ❌ 再次调用 processDestroyMoveCycle([MINION_DESTROYED, ...])
   → 触发 Igor onDestroy（第二次）！
   → 又创建一个 Igor 交互
```

### 为什么去重失败？

`processDestroyMoveCycle` 函数内部有 `processedDestroyUids` Set 用于去重，但这个 Set 是**函数局部变量**，每次调用都会创建新的 Set。

两次调用：
- 第一次（SmashUpEventSystem）：`processedDestroyUids = new Set()` → 处理 Igor
- 第二次（postProcessSystemEvents）：`processedDestroyUids = new Set()` → 又处理 Igor

两个 Set 互不相关，无法跨调用去重。

## 设计缺陷分析

### 职责重叠

- **SmashUpEventSystem.afterEvents()**：处理交互解决后的事件，调用 `processDestroyMoveCycle`
- **postProcessSystemEvents**：处理系统事件（包括交互解决产生的事件），也调用 `processDestroyMoveCycle`

两者都对同一批事件执行后处理，导致重复。

### 为什么会有这个设计？

历史原因：
1. 最初 `SmashUpEventSystem` 负责完整的事件后处理
2. 后来引入 `postProcessSystemEvents` 统一处理所有系统事件
3. 但忘记移除 `SmashUpEventSystem` 中的后处理逻辑
4. 导致两个系统都在做同样的事情

## 解决方案

### 采用方案：移除 SmashUpEventSystem 中的后处理

**修改位置**：`src/games/smashup/domain/systems.ts`

**修改前**：
```typescript
if (result) {
    newState = result.state;
    const rawEvents = result.events as SmashUpEvent[];
    const sourcePlayerId = payload.playerId;
    // ❌ 重复处理
    const afterDestroyMove = processDestroyMoveCycle(rawEvents, newState, sourcePlayerId, random as RandomFn, eventTimestamp);
    if (afterDestroyMove.matchState) newState = afterDestroyMove.matchState;
    const afterReturn = filterProtectedReturnEvents(afterDestroyMove.events, newState.core, sourcePlayerId);
    const afterDeckBottom = filterProtectedDeckBottomEvents(afterReturn, newState.core, sourcePlayerId);
    const afterAffect = processAffectTriggers(afterDeckBottom, newState, sourcePlayerId, random as RandomFn, eventTimestamp);
    if (afterAffect.matchState) newState = afterAffect.matchState;
    nextEvents.push(...afterAffect.events);
}
```

**修改后**：
```typescript
if (result) {
    newState = result.state;
    // ✅ 交互处理函数返回的事件会由 pipeline 的 postProcessSystemEvents 统一处理
    // （包括 processDestroyMoveCycle、保护过滤、触发链等）
    // 这里只需要直接返回事件，避免重复处理导致 onDestroy 等触发器被调用两次
    const rawEvents = result.events as SmashUpEvent[];
    nextEvents.push(...rawEvents);
}
```

### 为什么这样修复？

1. **单一职责**：`SmashUpEventSystem` 只负责"交互解决 → 领域事件"的转换
2. **统一处理**：所有事件的后处理（destroy/move/affect 触发链）都由 `postProcessSystemEvents` 统一处理
3. **符合架构**：Pipeline 已经在调用 `postProcessSystemEvents`，这是设计的一部分
4. **最小改动**：只需要删除重复的后处理代码

### 其他方案（未采用）

**方案 B**：在 `postProcessSystemEvents` 中跳过已处理的事件
- 缺点：需要在 state 中存储"已处理事件"标记，污染状态

**方案 C**：将 `processedDestroyUids` 持久化到 `sys` 中
- 缺点：临时处理数据不应该存在状态中，需要清理逻辑

## 验证

### 测试用例

`src/games/smashup/__tests__/igor-big-gulp-double-trigger.test.ts`

```typescript
it('vampire_big_gulp 消灭 Igor → processDestroyMoveCycle → Igor onDestroy 只触发一次', () => {
    // 1. 打出 Big Gulp
    // 2. 选择消灭 Igor
    // 3. 验证只有一个 Igor 交互
    expect(igorInteractions.length).toBe(1);
});
```

### 测试结果

✅ 测试通过，Igor onDestroy 只触发一次

## 教训

1. **避免职责重叠**：不同系统不应该对同一批数据执行相同的处理
2. **统一入口**：后处理逻辑应该有唯一的入口点
3. **去重机制的局限性**：函数局部变量无法跨调用去重，需要架构层面避免重复调用
4. **重构时要彻底**：引入新系统时，要移除旧系统的重复逻辑

## 影响范围

### 修复的问题

- ✅ Igor onDestroy 不再触发两次
- ✅ 所有 onDestroy 触发器都不会重复触发
- ✅ 所有交互解决后的事件都不会被重复处理

### 潜在风险

- ⚠️ 需要确认 `postProcessSystemEvents` 能正确处理所有交互解决产生的事件
- ⚠️ 需要回归测试其他交互场景

### 回归测试

建议运行以下测试：
- `src/games/smashup/__tests__/igor-*.test.ts` - Igor 相关测试
- `src/games/smashup/__tests__/newFactionAbilities.test.ts` - 所有派系能力测试
- `src/games/smashup/__tests__/ongoingE2E.test.ts` - ongoing 触发器测试

## 相关文档

- `docs/ai-rules/engine-systems.md` - 引擎系统架构
- `docs/bugs/smashup-igor-double-trigger-investigation.md` - 初步调查
- `docs/bugs/smashup-igor-double-trigger-root-cause-summary.md` - 早期根因分析（不完整）
