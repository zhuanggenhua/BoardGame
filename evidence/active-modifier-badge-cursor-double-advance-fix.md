# ActiveModifierBadge 不显示 - 游标重复推进问题修复

## 问题根因

**症状**：打出 Volley 卡牌后，ActiveModifierBadge 不显示

**用户日志**：
```
[useActiveModifiers] consumeNew 结果: {newEntriesCount: 0, didReset: false, totalEntries: 44}
```

**根因**：`useActiveModifiers` 首次挂载时调用了 `consumeNew()`，导致游标推进到最新位置。后续打出 Volley 卡牌时，`consumeNew()` 认为这些事件已经被消费过了，返回空数组。

## 问题分析

### 原始代码（错误）

```typescript
useEffect(() => {
    // 首次挂载：扫描历史事件，恢复未结算的修正卡
    if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        const restoredModifiers = scanActiveModifiers(eventStreamEntries);
        if (restoredModifiers.length > 0) {
            setModifiers(restoredModifiers);
        }
        // ❌ 错误：这里调用了 consumeNew()
        consumeNew();
        return;
    }

    const { entries: newEntries, didReset } = consumeNew();
    // ... 处理新事件
}, [eventStreamEntries, consumeNew]);
```

### 问题流程

1. **首次挂载**（EventStream 为空）：
   - `isFirstMountRef.current === true`
   - 扫描历史事件（0 个）
   - **调用 `consumeNew()`**：游标从 -1 推进到 -1（EventStream 为空）
   - return，不处理新事件

2. **打出 Volley 卡牌**（EventStream 有 44 个事件）：
   - `isFirstMountRef.current === false`
   - **调用 `consumeNew()`**：
     - `useEventStreamCursor` 首次调用，自动跳过历史事件
     - 游标从 -1 推进到 44（最新事件 ID）
     - 返回空数组（`newEntriesCount: 0`）
   - 没有新事件，不添加修正卡

3. **问题**：游标被推进了两次
   - 第一次：首次挂载时手动调用 `consumeNew()`
   - 第二次：`useEventStreamCursor` 首次调用时自动跳过历史事件
   - 结果：所有事件都被跳过，`consumeNew()` 永远返回空数组

### useEventStreamCursor 的设计

`useEventStreamCursor` 的设计是：
- **首次调用时自动跳过历史事件**（`isFirstCallRef.current === true`）
- 后续调用时只返回新事件

因此，消费者（如 `useActiveModifiers`）**不应该在首次挂载时手动调用 `consumeNew()`**。

## 修复方案

### 修改后的代码（正确）

```typescript
useEffect(() => {
    // 首次挂载：扫描历史事件，恢复未结算的修正卡
    if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        const restoredModifiers = scanActiveModifiers(eventStreamEntries);
        console.log('[useActiveModifiers] 首次挂载，扫描历史事件:', {
            totalEntries: eventStreamEntries.length,
            restoredModifiers,
        });
        if (restoredModifiers.length > 0) {
            setModifiers(restoredModifiers);
        }
        // ✅ 正确：不调用 consumeNew()
        // useEventStreamCursor 首次调用时会自动跳过历史事件
        return;
    }

    const { entries: newEntries, didReset } = consumeNew();
    // ... 处理新事件
}, [eventStreamEntries, consumeNew]);
```

### 修复后的流程

1. **首次挂载**（EventStream 为空）：
   - `isFirstMountRef.current === true`
   - 扫描历史事件（0 个）
   - **不调用 `consumeNew()`**
   - return

2. **打出 Volley 卡牌**（EventStream 有 44 个事件）：
   - `isFirstMountRef.current === false`
   - **调用 `consumeNew()`**：
     - `useEventStreamCursor` 首次调用，自动跳过历史事件（43 个）
     - 游标从 -1 推进到 43
     - 返回新事件（1 个 CARD_PLAYED 事件）
     - `newEntriesCount: 1`
   - 处理 CARD_PLAYED 事件，添加修正卡到列表

## 为什么原始代码会这样写？

原始代码可能是为了"推进游标，跳过历史事件"，但这是不必要的，因为 `useEventStreamCursor` 已经自动处理了首次调用时跳过历史事件的逻辑。

## 教训

### 使用 useEventStreamCursor 的正确模式

```typescript
const { consumeNew } = useEventStreamCursor({ entries });
const isFirstMountRef = useRef(true);

useEffect(() => {
    // 首次挂载：处理历史事件（如果需要）
    if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        // 扫描历史事件，恢复状态
        const restored = scanHistory(entries);
        if (restored.length > 0) {
            setState(restored);
        }
        // ❌ 不要调用 consumeNew()！
        return;
    }

    // 后续更新：消费新事件
    const { entries: newEntries, didReset } = consumeNew();
    if (didReset) {
        // 撤回操作：重新扫描历史
        const restored = scanHistory(entries);
        setState(restored);
        return;
    }
    if (newEntries.length === 0) return;
    // 处理新事件
    // ...
}, [entries, consumeNew]);
```

### 核心原则

1. **首次挂载时不调用 `consumeNew()`**：`useEventStreamCursor` 会自动跳过历史事件
2. **首次挂载时扫描历史事件**：如果需要恢复状态（如撤回后刷新），手动扫描 `entries` 数组
3. **后续更新时调用 `consumeNew()`**：只处理新事件

## 修改文件

- `src/games/dicethrone/hooks/useActiveModifiers.ts`：移除首次挂载时的 `consumeNew()` 调用

## 验证方法

1. 启动游戏
2. 选择月精灵（Moon Elf）
3. 打出 Volley 卡牌
4. 查看控制台日志：
   ```
   [useActiveModifiers] consumeNew 结果: {newEntriesCount: 1, didReset: false, totalEntries: 44}
   [useActiveModifiers] CARD_PLAYED 事件: {cardId: 'volley', card: {...}, isAttackModifier: true}
   [useActiveModifiers] 添加新修正卡: [{cardId: 'volley', ...}]
   [RightSidebar] activeModifiers: [{cardId: 'volley', ...}]
   ```
5. 查看右侧边栏骰子区域上方，应该显示"攻击修正"徽章

## 相关问题

这个问题可能影响所有使用 `useEventStreamCursor` 的 Hook，需要检查：
- `useCardSpotlight`：是否也有类似问题？
- `useAnimationEffects`：是否也有类似问题？
- 其他消费 EventStream 的 Hook

## 时间线

- **2026-03-04 18:00**：用户反馈 ActiveModifierBadge 不显示
- **2026-03-04 18:30**：添加调试日志
- **2026-03-04 19:00**：用户提供首次挂载日志（EventStream 为空）
- **2026-03-04 19:30**：用户提供打出 Volley 后的日志（`newEntriesCount: 0`）
- **2026-03-04 19:35**：定位根因（游标重复推进）
- **2026-03-04 19:40**：修复（移除首次挂载时的 `consumeNew()` 调用）
