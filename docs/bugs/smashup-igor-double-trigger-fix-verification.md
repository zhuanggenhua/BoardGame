# Igor 双重触发 Bug 修复验证

## 修复状态

✅ **代码已修复**：`src/games/smashup/domain/reducer.ts` 中的 `processDestroyMoveCycle` 函数已正确修复。

## 修复内容

**修复前**（错误）：
```typescript
// ❌ 从输出事件构建去重集合
const destroyUidsBefore = new Set(
    afterDestroy.events  // 错误：使用输出
        .filter(e => e.type === SU_EVENTS.MINION_DESTROYED)
        .map(e => (e as MinionDestroyedEvent).payload.minionUid)
);
```

**修复后**（正确）：
```typescript
// ✅ 从输入事件构建去重集合
const processedDestroyUids = new Set<string>();

// 第一轮：记录输入事件中的所有 MINION_DESTROYED
for (const e of currentEvents) {
    if (e.type === SU_EVENTS.MINION_DESTROYED) {
        processedDestroyUids.add((e as MinionDestroyedEvent).payload.minionUid);
    }
}

// 后续循环中，每次处理新事件后立即加入集合
for (const e of newDestroyEvents) {
    processedDestroyUids.add((e as MinionDestroyedEvent).payload.minionUid);
}
```

## 用户报告的日志分析

用户提供的日志显示：
```
[processDestroyTriggers] Processing destroy event: {minionUid: 'c3', ...}
[frankensteinIgorOnDestroy] Called with: {cardUid: 'c3', ...}
[processDestroyMoveCycle] END

// ❌ 第二次触发（bug）
[processDestroyTriggers] Processing destroy event: {minionUid: 'c3', ...}
[frankensteinIgorOnDestroy] Called with: {cardUid: 'c3', ...}
[processDestroyMoveCycle] END
```

**原因**：用户仍在使用旧代码（未刷新页面）。

## 验证步骤

### 1. 确认代码已更新

检查 `src/games/smashup/domain/reducer.ts` line 1001-1010：
- ✅ 应该看到 `const processedDestroyUids = new Set<string>();`
- ✅ 应该看到 `for (const e of currentEvents)` 循环记录输入事件
- ❌ 不应该看到 `afterDestroy.events.filter(...)`

### 2. 刷新页面

**重要**：修复后必须刷新页面（Ctrl+F5 或 Cmd+Shift+R）以加载新代码。

### 3. 重新测试

1. 打开游戏
2. 打出"一大口"消灭 Igor
3. 检查控制台日志：
   - ✅ 应该只看到一次 `[frankensteinIgorOnDestroy] Called`
   - ✅ 应该只看到一次 `[processDestroyMoveCycle] END`
   - ✅ 应该只出现一个交互弹窗

### 4. 验证 ActionLog

修复后，ActionLog 应该正确记录：
- ✅ 只有一次 `POWER_COUNTER_ADDED` 事件
- ✅ 只有一个随从获得 +1 力量指示物

## 预期行为

修复后，Igor 被消灭时：
1. `processDestroyMoveCycle` 第一轮处理 Igor 消灭
2. `processedDestroyUids` 记录 Igor 的 UID (`'c3'`)
3. 后续循环检查新事件时，发现 `'c3'` 已在集合中
4. 跳过重复处理，不再触发第二次 onDestroy

## 如果问题仍然存在

如果刷新页面后问题仍然存在，请提供：
1. 完整的控制台日志（从打出"一大口"开始）
2. 确认是否看到 `processedDestroyUids` 相关的日志
3. 确认浏览器是否真的加载了新代码（可以在 Sources 面板中查看 reducer.ts 的内容）

## 相关文档

- `docs/bugs/smashup-igor-double-trigger-investigation.md` — 完整调查过程
- `docs/bugs/smashup-igor-double-trigger-root-cause-summary.md` — 根因总结
- `docs/ai-rules/testing-audit.md` — 审计文档（已更新 D9 和新增 D40）
