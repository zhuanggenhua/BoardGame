# ActiveModifierBadge 不显示 - EventStream 被清空后游标未重置问题修复

## 问题根因（第二轮）

**症状**：修复首次挂载问题后，日志仍然显示 `newEntriesCount: 0`

**用户日志**：
```
[useActiveModifiers] consumeNew 结果: {newEntriesCount: 0, didReset: false, totalEntries: 17}
[useActiveModifiers] consumeNew 结果: {newEntriesCount: 0, didReset: false, totalEntries: 0}
[useActiveModifiers] consumeNew 结果: {newEntriesCount: 0, didReset: false, totalEntries: 0}
...
[useActiveModifiers] consumeNew 结果: {newEntriesCount: 0, didReset: false, totalEntries: 9}
```

**根因**：EventStream 被清空后（`totalEntries: 0`），游标保持不变（如 17）。当 EventStream 重新填充到 9 个事件时，游标 17 > 9，所以 `consumeNew()` 返回空数组。

## 问题分析

### EventStream 被清空的场景

1. **乐观引擎 wait-confirm 模式**：暂时剥离 EventStream
2. **状态同步**：服务端返回的状态可能不包含 EventStream
3. **页面切换/刷新**：EventStream 被重置

### 原始代码（错误）

```typescript
// ── entries 为空：保持游标不变，不消费 ──
if (curLen === 0) {
    return { entries: [], didReset: false, didOptimisticRollback: false };
}
```

**问题**：游标保持不变，导致后续新事件被跳过。

### 问题流程

1. **打出第一张卡**（EventStream 有 17 个事件）：
   - 游标从 -1 推进到 17
   - `totalEntries: 17`

2. **EventStream 被清空**（状态同步或乐观引擎）：
   - 游标保持 17
   - `totalEntries: 0`

3. **打出 Volley 卡**（EventStream 重新填充到 9 个事件）：
   - 游标仍然是 17
   - `entries.filter(e => e.id > 17)` 返回空数组（最大 ID 只有 9）
   - `newEntriesCount: 0`

## 修复方案

### 修改后的代码（正确）

```typescript
// ── entries 为空：检查是否需要重置游标 ──
// 乐观引擎的 wait-confirm 模式会暂时剥离 EventStream，
// 这不是 Undo 回退，不应重置游标。
// 但如果游标已经推进过（lastSeenIdRef > -1），且 entries 为空，
// 说明 EventStream 被清空了，需要重置游标，防止后续新事件被跳过。
if (curLen === 0) {
    if (lastSeenIdRef.current > -1) {
        // EventStream 被清空，重置游标
        lastSeenIdRef.current = -1;
    }
    return { entries: [], didReset: false, didOptimisticRollback: false };
}
```

### 修复后的流程

1. **打出第一张卡**（EventStream 有 17 个事件）：
   - 游标从 -1 推进到 17
   - `totalEntries: 17`

2. **EventStream 被清空**（状态同步或乐观引擎）：
   - **游标重置为 -1**
   - `totalEntries: 0`

3. **打出 Volley 卡**（EventStream 重新填充到 9 个事件）：
   - 游标从 -1 推进到 9
   - `entries.filter(e => e.id > -1)` 返回所有 9 个事件
   - 首次调用时跳过历史事件（8 个），返回新事件（1 个 CARD_PLAYED）
   - `newEntriesCount: 1`

## 为什么会出现这个问题？

### 乐观引擎的行为

DiceThrone 使用乐观引擎（`OptimisticEngine`），在某些情况下会清空 EventStream：
- **wait-confirm 模式**：等待服务端确认时，暂时剥离 EventStream
- **状态同步**：服务端返回的状态可能不包含完整的 EventStream
- **reconcile**：乐观预测与服务端状态合并时，EventStream 可能被重置

### 原始设计的假设

原始代码假设 EventStream 只会增长，不会被清空。但实际上，乐观引擎会在某些情况下清空 EventStream，导致游标失效。

## 修改文件

- `src/engine/hooks/useEventStreamCursor.ts`：当 EventStream 被清空时重置游标

## 验证方法

1. 重启开发服务器（`npm run dev`）
2. 刷新浏览器
3. 选择月精灵（Moon Elf）
4. 打出 Volley 卡牌
5. 查看控制台日志：
   ```
   [useActiveModifiers] consumeNew 结果: {newEntriesCount: 1, didReset: false, totalEntries: 9}
   [useActiveModifiers] CARD_PLAYED 事件: {cardId: 'volley', card: {...}, isAttackModifier: true}
   [useActiveModifiers] 添加新修正卡: [{cardId: 'volley', ...}]
   [RightSidebar] activeModifiers: [{cardId: 'volley', ...}]
   ```
6. 查看右侧边栏骰子区域上方，应该显示"攻击修正"徽章

## 影响范围

这个修复影响所有使用 `useEventStreamCursor` 的 Hook：
- `useActiveModifiers`（DiceThrone）
- `useCardSpotlight`（DiceThrone）
- `useAnimationEffects`（DiceThrone）
- `useGameEvents`（SmashUp）
- `useMovementTrails`（SummonerWars）
- `useGameEvents`（SummonerWars）
- `useCardSpotlightQueue`（框架层）

所有这些 Hook 都会受益于这个修复，不再因为 EventStream 被清空而丢失事件。

## 教训

### EventStream 的生命周期

EventStream 不是只增长的，它可能在以下情况下被清空：
1. 乐观引擎的 wait-confirm 模式
2. 状态同步（服务端返回的状态可能不包含 EventStream）
3. 页面切换/刷新
4. Undo 回退

### useEventStreamCursor 的职责

`useEventStreamCursor` 应该处理所有 EventStream 生命周期的变化：
- ✅ 首次调用时跳过历史事件
- ✅ Undo 回退时重置游标
- ✅ 乐观回滚时重置游标到水位线
- ✅ **EventStream 被清空时重置游标**（本次修复）

## 时间线

- **2026-03-04 18:00**：用户反馈 ActiveModifierBadge 不显示
- **2026-03-04 19:40**：修复首次挂载问题（移除 `consumeNew()` 调用）
- **2026-03-04 20:00**：用户重启后日志仍然显示 `newEntriesCount: 0`
- **2026-03-04 20:10**：发现 EventStream 被清空后游标未重置的问题
- **2026-03-04 20:15**：修复（EventStream 被清空时重置游标）

## 相关文档

- `evidence/active-modifier-badge-cursor-double-advance-fix.md`：首次挂载问题修复
- `evidence/active-modifier-badge-eventstream-cleared-fix.md`：本文档（EventStream 被清空问题修复）
