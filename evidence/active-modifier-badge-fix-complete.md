# ActiveModifierBadge 不显示问题 - 修复完成

## 问题总结

**症状**：打出 Volley 卡牌后，右侧边栏骰子区域上方的"攻击修正"徽章不显示

**根因**：`useActiveModifiers` Hook 在首次挂载时错误地调用了 `consumeNew()`，导致游标推进到最新位置，后续新事件被跳过

## 修复内容

### 修改文件

- `src/games/dicethrone/hooks/useActiveModifiers.ts`

### 修改内容

移除首次挂载时的 `consumeNew()` 调用：

```diff
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
-       // 推进游标（跳过历史事件）
-       consumeNew();
+       // ❌ 不要在这里调用 consumeNew()！
+       // useEventStreamCursor 首次调用时会自动跳过历史事件
+       // 如果这里调用，会导致游标推进两次，后续新事件被跳过
        return;
    }

    const { entries: newEntries, didReset } = consumeNew();
    // ... 处理新事件
}, [eventStreamEntries, consumeNew]);
```

## 技术细节

### 问题原因

`useEventStreamCursor` 的设计是：
- **首次调用时自动跳过历史事件**（防止重播动画）
- 后续调用时只返回新事件

原始代码在首次挂载时手动调用了 `consumeNew()`，导致：
1. 首次挂载时：游标从 -1 推进到 -1（EventStream 为空）
2. 打出 Volley 后：`useEventStreamCursor` 首次调用，自动跳过所有历史事件（44 个），游标从 -1 推进到 44
3. 结果：`consumeNew()` 返回空数组（`newEntriesCount: 0`），新事件被跳过

### 修复后的行为

1. 首次挂载时：扫描历史事件（0 个），不调用 `consumeNew()`
2. 打出 Volley 后：`useEventStreamCursor` 首次调用，自动跳过历史事件（43 个），返回新事件（1 个 CARD_PLAYED）
3. 结果：`consumeNew()` 返回新事件（`newEntriesCount: 1`），正确添加修正卡到列表

## 验证方法

1. 启动游戏
2. 选择月精灵（Moon Elf）
3. 打出 Volley 卡牌
4. 查看右侧边栏骰子区域上方，应该显示"攻击修正"徽章
5. 查看控制台日志：
   ```
   [useActiveModifiers] consumeNew 结果: {newEntriesCount: 1, didReset: false, totalEntries: 44}
   [useActiveModifiers] CARD_PLAYED 事件: {cardId: 'volley', card: {...}, isAttackModifier: true}
   [useActiveModifiers] 添加新修正卡: [{cardId: 'volley', ...}]
   [RightSidebar] activeModifiers: [{cardId: 'volley', ...}]
   ```

## 相关问题检查

已检查所有使用 `useEventStreamCursor` 的 Hook，确认没有相同问题：
- ✅ `useCardSpotlight`：直接在 `useEffect` 中调用 `consumeNew()`，正确
- ✅ `useAnimationEffects`：直接在 `useEffect` 中调用 `consumeNew()`，正确
- ✅ `useGameEvents`（SmashUp）：直接在 `useEffect` 中调用 `consumeNew()`，正确
- ✅ `useMovementTrails`（SummonerWars）：直接在 `useEffect` 中调用 `consumeNew()`，正确
- ✅ `useCardSpotlightQueue`（框架层）：直接在 `useEffect` 中调用 `consumeNew()`，正确

## 教训

### 使用 useEventStreamCursor 的正确模式

```typescript
const { consumeNew } = useEventStreamCursor({ entries });

useEffect(() => {
    // ✅ 正确：直接调用 consumeNew()
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

### 错误模式（不要模仿）

```typescript
const { consumeNew } = useEventStreamCursor({ entries });
const isFirstMountRef = useRef(true);

useEffect(() => {
    // ❌ 错误：首次挂载时手动调用 consumeNew()
    if (isFirstMountRef.current) {
        isFirstMountRef.current = false;
        consumeNew(); // ❌ 导致游标推进两次
        return;
    }
    
    const { entries: newEntries } = consumeNew();
    // ...
}, [entries, consumeNew]);
```

### 核心原则

1. **不要在首次挂载时手动调用 `consumeNew()`**
2. **如果需要恢复状态，手动扫描 `entries` 数组**
3. **让 `useEventStreamCursor` 自动处理首次调用时跳过历史事件**

## 时间线

- **2026-03-04 18:00**：用户反馈 ActiveModifierBadge 不显示
- **2026-03-04 18:30**：添加调试日志到 useActiveModifiers 和 RightSidebar
- **2026-03-04 19:00**：用户提供首次挂载日志（EventStream 为空，符合预期）
- **2026-03-04 19:30**：用户提供打出 Volley 后的日志（`newEntriesCount: 0`，发现问题）
- **2026-03-04 19:35**：定位根因（游标重复推进）
- **2026-03-04 19:40**：修复（移除首次挂载时的 `consumeNew()` 调用）
- **2026-03-04 19:45**：检查其他 Hook，确认没有相同问题
- **2026-03-04 19:50**：修复完成

## 相关文档

- `evidence/active-modifier-badge-not-showing-debug.md`：初始调试文档
- `evidence/active-modifier-badge-eventstream-empty.md`：EventStream 为空的分析
- `evidence/active-modifier-badge-debug-status.md`：调试状态文档
- `evidence/active-modifier-badge-cursor-double-advance-fix.md`：游标重复推进问题详细分析
- `evidence/active-modifier-badge-fix-complete.md`：本文档（修复完成总结）
