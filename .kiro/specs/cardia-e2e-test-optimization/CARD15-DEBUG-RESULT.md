# Card15 发明家 - 手动调试结果

## 调试时间
2025-01-XX

## 测试结果

### ✅ 核心功能正确
第二次交互**正确放置了 -3 修正标记**！

### ⚠️ 发现的问题：修正标记重复

每次交互都产生了**两个相同的修正标记**：

```json
"modifierTokens": [
  {"cardId": "p1_played_surgeon", "value": 3, "timestamp": 1772451905345},
  {"cardId": "p1_played_surgeon", "value": 3, "timestamp": 1772451905345},  // 重复
  {"cardId": "p2_played_puppeteer", "value": -3, "timestamp": 1772451943494},
  {"cardId": "p2_played_puppeteer", "value": -3, "timestamp": 1772451943494}  // 重复
]
```

## 根本原因分析

### 问题：交互处理器被调用两次

从 EventStream 可以看到：

```json
// 第一次交互
{"id": 13, "event": {"type": "SYS_INTERACTION_RESOLVED", ...}},  // 用户响应
{"id": 14, "event": {"type": "cardia:modifier_token_placed", "value": 3}},  // 第一个 +3

// 第二次交互
{"id": 15, "event": {"type": "SYS_INTERACTION_RESOLVED", ...}},  // 用户响应
{"id": 16, "event": {"type": "cardia:modifier_token_placed", "value": -3}}  // 第一个 -3
```

**只有一个 `modifier_token_placed` 事件**，但 `modifierTokens` 数组中有**两个相同的标记**。

### 可能的原因

#### 原因 1：Reducer 重复应用（最可能）

`reduce.ts` 中的 `MODIFIER_TOKEN_PLACED` 处理器可能被调用了两次，或者在处理时没有检查重复。

#### 原因 2：事件重播

EventStream 中的事件可能被重播了一次（如页面刷新或状态同步）。

#### 原因 3：CardiaEventSystem 重复创建

CardiaEventSystem 在处理 `SYS_INTERACTION_RESOLVED` 时可能调用了交互处理器两次。

## 验证步骤

### 1. 检查 Reducer

查看 `src/games/cardia/domain/reduce.ts` 中的 `MODIFIER_TOKEN_PLACED` 处理：

```typescript
case CARDIA_EVENTS.MODIFIER_TOKEN_PLACED: {
    const { cardId, value, source, timestamp } = payload;
    
    // ❓ 是否检查了重复？
    // ❓ 是否在某个循环中被调用了两次？
    
    return {
        ...core,
        modifierTokens: [
            ...core.modifierTokens,
            { cardId, value, source, timestamp },  // 直接追加，没有去重
        ],
    };
}
```

**建议修复**：在追加前检查是否已存在相同的标记（cardId + value + source + timestamp 完全相同）。

### 2. 检查交互处理器调用链

查看 `src/games/cardia/domain/systems.ts` 中的 `CardiaEventSystem.afterEvents`：

```typescript
// 处理 SYS_INTERACTION_RESOLVED 事件
if (event.type === 'SYS_INTERACTION_RESOLVED') {
    const handler = getInteractionHandler(payload.sourceId);
    if (handler) {
        const result = handler(newState, ...);  // ❓ 这里调用一次
        
        // ❓ 是否在其他地方又调用了一次？
        // ❓ 返回的事件是否被重复应用？
    }
}
```

### 3. 检查事件应用逻辑

查看事件是如何被应用到状态的：

```typescript
// 在 CardiaEventSystem.afterEvents 中
for (const evt of result.events) {
    newState.core = reduce(newState.core, evt);  // ❓ 是否被调用了两次？
}
```

## 推荐修复方案

### 方案 A：Reducer 层去重（推荐）

在 `reduce.ts` 的 `MODIFIER_TOKEN_PLACED` 处理器中添加去重逻辑：

```typescript
case CARDIA_EVENTS.MODIFIER_TOKEN_PLACED: {
    const { cardId, value, source, timestamp } = payload;
    
    // 检查是否已存在相同的修正标记
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
    
    return {
        ...core,
        modifierTokens: [
            ...core.modifierTokens,
            { cardId, value, source, timestamp },
        ],
    };
}
```

**优点**：
- 在数据层防止重复，最安全
- 不影响其他逻辑
- 容易测试

**缺点**：
- 治标不治本，没有解决根本原因

### 方案 B：修复事件应用逻辑

找到导致事件被应用两次的根本原因并修复。

**优点**：
- 治本，解决根本问题
- 避免其他事件也出现重复

**缺点**：
- 需要深入调试，找到根本原因
- 可能影响其他逻辑

### 方案 C：交互处理器层去重

在交互处理器返回事件前检查是否已存在：

```typescript
registerInteractionHandler(ABILITY_IDS.INVENTOR, (state, playerId, value, ...) => {
    // ... 现有逻辑 ...
    
    // 检查是否已经放置过这个修正标记
    const existingToken = state.core.modifierTokens.find(
        token => 
            token.cardId === selectedCard.cardUid &&
            token.source === ABILITY_IDS.INVENTOR &&
            Math.abs(Date.now() - token.timestamp) < 1000  // 1秒内
    );
    
    if (existingToken) {
        console.warn('[Inventor] Duplicate modifier detected, skipping');
        return { state, events: [] };
    }
    
    // ... 返回事件 ...
});
```

**优点**：
- 在业务层防止重复
- 针对性强

**缺点**：
- 只解决发明家的问题，其他能力可能也有同样问题
- 逻辑复杂

## 建议行动

### 立即行动（修复重复问题）

1. **实施方案 A**：在 Reducer 层添加去重逻辑
   - 修改 `src/games/cardia/domain/reduce.ts`
   - 添加 `MODIFIER_TOKEN_PLACED` 去重检查
   - 运行测试验证

2. **验证修复**：
   - 运行 E2E 测试：`npx playwright test cardia-deck1-card15-inventor.e2e.ts`
   - 确认 `modifierTokens` 数组中不再有重复

### 后续调查（找到根本原因）

1. **添加调试日志**：
   - 在 `reduce.ts` 的 `MODIFIER_TOKEN_PLACED` 处理器中添加日志
   - 在 `CardiaEventSystem.afterEvents` 中添加日志
   - 记录每次调用的堆栈信息

2. **运行测试并查看日志**：
   - 确认 Reducer 是否被调用了两次
   - 确认事件是否被重复应用

3. **根据日志修复根本原因**：
   - 如果是 Reducer 被调用两次 → 修复调用链
   - 如果是事件重播 → 修复事件应用逻辑
   - 如果是 CardiaEventSystem 问题 → 修复系统逻辑

## 测试验证

### 验证标准

运行测试后，检查以下内容：

1. **修正标记数量**：
   - ✅ 第一次交互后：`modifierTokens.length === 1`（只有一个 +3）
   - ✅ 第二次交互后：`modifierTokens.length === 2`（一个 +3 和一个 -3）

2. **修正标记值**：
   - ✅ 第一个标记：`value === 3`
   - ✅ 第二个标记：`value === -3`

3. **目标卡牌**：
   - ✅ 第一个标记：`cardId === 'p1_played_surgeon'`（或用户选择的卡牌）
   - ✅ 第二个标记：`cardId === 'p2_played_puppeteer'`（或用户选择的卡牌）

### 测试命令

```bash
# 运行发明家测试
npx playwright test cardia-deck1-card15-inventor.e2e.ts

# 查看测试报告
npx playwright show-report
```

## 总结

### 好消息 ✅
- 第二次交互**正确放置了 -3**
- 核心逻辑正确，方案 E 不需要实施

### 需要修复 ⚠️
- 修正标记重复（每次交互产生两个相同的标记）
- 推荐实施方案 A（Reducer 层去重）

### 下一步
1. 实施方案 A 修复重复问题
2. 运行测试验证
3. 后续调查根本原因（可选）

---

**调试完成时间**：2025-01-XX  
**状态**：核心功能正确，需要修复重复问题
