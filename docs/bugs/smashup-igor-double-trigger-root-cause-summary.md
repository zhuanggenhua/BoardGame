# SmashUp Igor 双重触发根因总结

## 问题描述

用户报告：Igor（科学小怪蛋）被消灭后，出现两次"选择随从放置+1力量指示物"的交互，即使场上只有一个 Igor。

## 根因确认

**Bug 位置**：`src/games/smashup/domain/reducer.ts` line 1008-1020
**函数**：`processDestroyMoveCycle`

### Bug 代码

```typescript
// ❌ BUG: 从输出事件构建去重集合
const destroyUidsBefore = new Set(
    afterDestroy.events  // 应该从输入 events 构建
        .filter(e => e.type === SU_EVENTS.MINION_DESTROYED)
        .map(e => (e as MinionDestroyedEvent).payload.minionUid)
);
```

### 正确代码

```typescript
// ✅ 正确：从输入事件构建去重集合
const destroyUidsBefore = new Set(
    events  // 使用输入参数
        .filter(e => e.type === SU_EVENTS.MINION_DESTROYED)
        .map(e => (e as MinionDestroyedEvent).payload.minionUid)
);
```

## 根因分析

`processDestroyMoveCycle` 的逻辑：
1. 第一轮：对输入 `events` 中的 `MINION_DESTROYED` 调用 `processDestroyTriggers` → 得到 `afterDestroy.events`
2. 对 `afterDestroy.events` 调用 `processMoveTriggers` → 得到 `afterMove.events`
3. 检查 `afterMove.events` 中是否有**新的** `MINION_DESTROYED`（不在原始输入中的）
4. 如果有新的，循环处理

**Bug**：第 3 步构建 `destroyUidsBefore` 时，从 `afterDestroy.events`（输出）而非 `events`（输入）中提取已处理的 UID。

**后果**：
- `afterDestroy.events` 是 `processDestroyTriggers` 的输出，可能包含新事件（`POWER_COUNTER_ADDED` 等）
- 但 `afterDestroy.events` 中的 `MINION_DESTROYED` 事件与输入 `events` 中的是**同一批**
- `destroyUidsBefore` 应该包含"第一轮已处理的 UID"，但实际包含的是"第一轮输出中的 UID"
- 当 `processDestroyTriggers` 过滤掉某个 `MINION_DESTROYED`（如被拯救），该 UID 不会进入 `destroyUidsBefore`
- 后续循环中，如果该 UID 再次出现，会被误判为"新的"消灭事件
- 导致 `processDestroyTriggers` 被再次调用，Igor 的 onDestroy 被触发第二次

## 为什么审计文档没有发现

### D9（幂等与重入）维度不足

**当前定义**："重复触发/撤销重做安全？"
- 过于简略，没有具体的审查方法和典型模式
- 没有覆盖"后处理循环中的事件去重"这一特定场景

### 缺失的审查维度

**事件去重逻辑审计**：
- 后处理循环中，如何判定"新事件" vs "已处理事件"？
- 去重集合应该从哪个数据源构建？输入 vs 输出？
- 循环不变式是否正确维护？

## 审计文档改进

### 已完成

1. ✅ 扩展 D9 维度定义，添加"后处理循环中的事件去重集合是否从正确的数据源构建？"
2. ✅ 新增 D40 维度：**后处理循环事件去重完整性**

### D40 维度详细内容

**核心原则**：后处理循环中判定"新事件"时，去重集合必须从**输入事件**构建，而非从**输出事件**构建。

**审查方法**：
1. 识别后处理循环（grep `while`/`for` 循环处理事件列表的函数）
2. 追踪去重集合构建的数据源
3. 判定标准：
   - 从输入事件构建 → ✅ 正确
   - 从输出事件构建 → ❌ 错误（可能遗漏被过滤的事件）
4. 检查循环不变式是否正确更新

**典型缺陷模式**：
- ❌ `Set(afterProcess.events.filter(...))` — 从输出构建
- ❌ 循环中去重集合不更新 — 导致重复处理
- ✅ `Set(inputEvents.filter(...))` — 从输入构建
- ✅ 每次迭代后 `processedUids.add(newUid)` — 累加更新

## 修复方案

1. 修改 `src/games/smashup/domain/reducer.ts` line 1008
2. 将 `afterDestroy.events` 改为 `events`
3. 更新测试以覆盖完整的循环逻辑
4. 验证修复后 Igor 只触发一次 onDestroy

## 教训

1. **后处理循环的去重逻辑必须基于输入事件**，而非输出事件
2. **测试必须覆盖完整的调用链路**，而非只测单个函数
3. **审计维度需要具体化**，简略的定义容易遗漏特定场景
4. **事件过滤/替换会影响去重判定**，必须在循环设计时考虑

## 参考文档

- `docs/bugs/smashup-igor-double-trigger-investigation.md` — 完整调查过程
- `docs/ai-rules/testing-audit.md` — 审计文档（已更新 D9 和新增 D40）
- `src/games/smashup/__tests__/igor-big-gulp-two-igors.test.ts` — 复现测试
