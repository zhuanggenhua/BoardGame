# SmashUp Bug 调查：Igor 被消灭时"触发两次" + ActionLog 缺陷

## 用户报告

用户报告：Igor（科学小怪蛋）被消灭后，要求玩家两次选择放置+1力量指示物的目标。用户确认实际给两个不同的随从各加了+1力量。但 ActionLog 中没有显示 POWER_COUNTER_ADDED 事件。

**场景信息：**
- 基地：base_rlyeh（拉莱耶）
- Igor 刚刚被打出到 base_rlyeh
- 场上还有：怪物、狼人、2个克苏鲁的仆人
- 其他基地：base_moot_site（集会场）、base_miskatonic_university_base（米斯卡托尼克大学）

## 根因分析

### ActionLog 缺陷（已修复）

**问题：** ActionLogSystem 只记录第一轮（`afterEventsRound === 0`）的事件，导致后续轮次产生的事件不被记录。

**影响：** SmashUpEventSystem 在 `afterEvents` 中处理交互解决（SYS_INTERACTION_RESOLVED），产生的事件（如 POWER_COUNTER_ADDED）发生在后续轮次，不会被记录到 ActionLog。

**修复：** 移除 `ActionLogSystem.afterEvents` 中的 `afterEventsRound` 限制，记录所有轮次的事件。

```typescript
// src/engine/systems/ActionLogSystem.ts line 57
afterEvents: ({ state, command, events, afterEventsRound }): HookResult<TCore> | void => {
    // ✅ 移除 afterEventsRound 限制，记录所有轮次的事件
    if (!shouldRecordCommand(command.type, normalizedAllowlist)) return;
    if (!formatEntry) return;
    // ...
}
```

### Igor 双重触发问题（待确认）

**可能的情况：**
1. Igor 的 onDestroy 确实被触发了两次（真正的 bug）
2. 用户看到了两个不同但相似的交互（可能是其他卡牌/基地的效果）

**需要用户提供的信息：**
1. 修复 ActionLog 后，重新测试并提供完整的 ActionLog
2. 两次交互的具体提示文本（是否都显示"科学小怪蛋"）
3. 是否有其他 ongoing 卡牌在场上（如德国工程学）

## 代码分析

### ActionLog 事件记录流程

```
executePipeline
  ├─ execute() → 产生事件
  ├─ 第一轮 afterEvents
  │   ├─ SmashUpEventSystem → 处理 MINION_DESTROYED → 触发 Igor onDestroy → 产生交互
  │   └─ ActionLogSystem → 记录事件 ✅
  ├─ 用户解决交互
  ├─ 第二轮 afterEvents
  │   ├─ SmashUpEventSystem → 处理 SYS_INTERACTION_RESOLVED → 产生 POWER_COUNTER_ADDED
  │   └─ ActionLogSystem → ❌ 被 afterEventsRound 限制跳过（修复前）
  └─ ...
```

### Igor 的能力注册

Igor 有两个独立的触发器：

1. **onDestroy** (frankenstein.ts line 35)
   - 触发时机：随从被消灭时
   - 效果：选择一个己方随从放置+1力量指示物

2. **onMinionDiscardedFromBase** (frankenstein.ts line 607)
   - 触发时机：基地计分时随从被弃置
   - 效果：选择一个己方随从放置+1力量指示物
   - **注意：** 只在 `scoreBase` 函数中调用，不会在普通消灭时触发

## 修复内容

1. ✅ **ActionLogSystem**：移除 `afterEventsRound` 限制，记录所有轮次的事件
2. ⏳ **Igor 双重触发**：等待用户提供修复后的 ActionLog 再确认

## 最新发现（2026-02-28）

## 结论（已解决）

**这不是 bug！**

从用户提供的 State Snapshot 和 Action Log 可以确认：

1. **场上有两个 Igor**：
   - Action Log 显示：`[17:17:39]` 和 `[17:17:32]` 两次打出"科学小怪蛋"
   - 都是游客1917（玩家0）打出的

2. **只有一个 Igor 被消灭**：
   - `turnDestroyedMinions` 显示只有一个 Igor 被消灭
   - State Snapshot 显示：一个 Igor 在弃牌堆（`c2`），另一个还在场上（`c4`）

3. **用户看到的"两次交互"是正常的**：
   - 第一个 Igor 被"一大口"消灭 → 触发 onDestroy → 创建交互
   - 第二个 Igor 还在场上，没有被消灭
   - 用户误以为只有一个 Igor，所以觉得触发了两次

### 为什么 `frankensteinIgorOnDestroy` 的日志没有打印？

可能的原因：
1. 浏览器控制台日志被清空或过滤了
2. 日志太多被截断了
3. 用户提供的日志是在交互解决之后才开始记录的

### 验证方法

如果用户想验证，可以：
1. 检查场上是否有两个 Igor
2. 查看 Action Log 中是否有两次"随从登场：科学小怪蛋"
3. 查看弃牌堆中是否有一个 Igor

## 总结

Igor 的实现是正确的，测试也证明了这一点。用户报告的"双重触发"是因为场上有两个 Igor，而不是一个 Igor 触发了两次。

## 测试建议

1. 重新测试 Igor 被消灭的场景
2. 检查 ActionLog 是否显示所有 POWER_COUNTER_ADDED 事件
3. 如果仍然出现两次交互，记录交互的 sourceId 和提示文本


## 根因确认（2026-02-28 深入检查）

### Bug 位置

**文件**：`src/games/smashup/domain/reducer.ts`
**函数**：`processDestroyMoveCycle`
**行号**：1008-1020

### Bug 代码

```typescript
// 检查 move 是否产生了新的 MINION_DESTROYED 事件（不在 afterDestroy.events 中的）
const destroyUidsBefore = new Set(
    afterDestroy.events  // ❌ BUG: 应该从 events 参数构建，而非 afterDestroy.events
        .filter(e => e.type === SU_EVENTS.MINION_DESTROYED)
        .map(e => (e as MinionDestroyedEvent).payload.minionUid)
);
```

### 根因分析

`processDestroyMoveCycle` 的逻辑是：
1. 第一轮：对输入 `events` 中的 `MINION_DESTROYED` 调用 `processDestroyTriggers` → 得到 `afterDestroy.events`
2. 对 `afterDestroy.events` 调用 `processMoveTriggers` → 得到 `afterMove.events`
3. 检查 `afterMove.events` 中是否有**新的** `MINION_DESTROYED`（不在原始输入中的）
4. 如果有新的，循环处理

**Bug**：第 3 步构建 `destroyUidsBefore` 时，从 `afterDestroy.events` 而非输入 `events` 中提取已处理的 UID。

**后果**：
- `afterDestroy.events` 包含了 `processDestroyTriggers` 的输出（可能包含 `MINION_RETURNED`/`MINION_MOVED`/`POWER_COUNTER_ADDED` 等新事件）
- 但 `afterDestroy.events` 中的 `MINION_DESTROYED` 事件与输入 `events` 中的是**同一批**（只是可能被过滤或保留）
- `destroyUidsBefore` 应该包含"第一轮已处理的 UID"，但实际包含的是"第一轮输出中的 UID"
- 当 `processDestroyTriggers` 过滤掉某个 `MINION_DESTROYED`（如被拯救），该 UID 不会进入 `destroyUidsBefore`
- 后续循环中，如果该 UID 再次出现在 `afterMove.events` 中（如移动触发器产生了新的消灭），会被误判为"新的"消灭事件
- 导致 `processDestroyTriggers` 被再次调用，Igor 的 onDestroy 被触发第二次

### 正确逻辑

```typescript
// ✅ 正确：从输入 events 构建已处理集合
const destroyUidsBefore = new Set(
    events  // 使用输入参数，而非 afterDestroy.events
        .filter(e => e.type === SU_EVENTS.MINION_DESTROYED)
        .map(e => (e as MinionDestroyedEvent).payload.minionUid)
);
```

### 为什么测试没有发现

之前的测试（`igor-ondestroy-idempotency.test.ts`）验证了：
1. ✅ 单个 `MINION_DESTROYED` 事件只触发一次 Igor onDestroy
2. ✅ 多个 `MINION_DESTROYED` 事件不会导致 Igor 重复触发
3. ⚠️ 重复调用 `processDestroyTriggers` — 但测试场景不正确（第二次调用时 Igor 已不在场）

**测试缺陷**：测试直接调用 `processDestroyTriggers` 两次，但没有模拟 `processDestroyMoveCycle` 的完整循环逻辑。真实 bug 发生在循环中：
- 第一轮：`processDestroyTriggers(events)` 处理 Igor 消灭 → 产生交互/事件
- `processMoveTriggers` 处理移动事件（如果有）
- 第二轮：错误的 `destroyUidsBefore` 导致同一个 Igor UID 被误判为"新的"消灭
- 再次调用 `processDestroyTriggers([同一个 MINION_DESTROYED])` → Igor onDestroy 被触发第二次

### 审计文档缺陷分析

**D9（幂等与重入）维度不足**：
- 当前定义："重复触发/撤销重做安全？"
- 过于简略，没有具体的审查方法和典型模式

**缺失的审查维度**：
- **事件去重逻辑审计**：后处理循环中，如何判定"新事件" vs "已处理事件"？
- **集合构建来源审计**：去重集合（如 `destroyUidsBefore`）应该从哪个数据源构建？输入 vs 输出？
- **循环不变式审计**：循环中的"已处理"集合是否在每次迭代后正确更新？

### 建议新增审计维度

**D40：后处理循环事件去重完整性**（新增/修改包含事件循环处理的后处理函数时触发）

**核心原则**：后处理循环中判定"新事件"时，去重集合必须从**输入事件**构建，而非从**输出事件**构建。输出事件可能被过滤/替换/追加，不能作为"已处理"的判定依据。

**审查方法**：
1. **识别后处理循环**：grep 所有包含 `while`/`for` 循环且处理事件列表的函数（如 `processDestroyMoveCycle`/`runAfterEventsRounds`）
2. **追踪去重集合构建**：循环中用于判定"新事件"的集合（如 `destroyUidsBefore`/`processedUids`），其数据源是什么？
3. **判定标准**：
   - 去重集合从**输入事件**构建 → ✅ 正确（反映真正已处理的事件）
   - 去重集合从**输出事件**构建 → ❌ 错误（输出可能被过滤，导致误判）
   - 去重集合从**中间状态**构建 → ⚠️ 需要验证中间状态是否等价于输入
4. **循环不变式检查**：每次迭代后，去重集合是否正确更新（累加新处理的事件）？
5. **典型缺陷模式**：
   - ❌ `Set(afterProcess.events.filter(...))` — 从输出构建，可能遗漏被过滤的事件
   - ❌ 循环中去重集合不更新 — 每次迭代都用初始集合，导致重复处理
   - ✅ `Set(inputEvents.filter(...))` — 从输入构建，反映真正已处理的事件
   - ✅ 每次迭代后 `processedUids.add(newUid)` — 累加更新

**审查输出格式**：
```
函数: processDestroyMoveCycle (reducer.ts:991-1070)
循环类型: while (newDestroyEvents.length > 0)
去重集合: destroyUidsBefore
数据源: afterDestroy.events ❌ 应该从 events 参数构建
判定: ❌ 去重集合从输出事件构建，可能遗漏被过滤的事件
修复方案: 将 line 1008 改为 events.filter(...)
```

**典型案例**：
- SmashUp `processDestroyMoveCycle`：`destroyUidsBefore` 从 `afterDestroy.events` 构建 → 被拯救的随从 UID 不在集合中 → 后续循环误判为"新消灭" → 重复触发 onDestroy
- 引擎层 `runAfterEventsRounds`：如果 `processedEvents` 从 `afterEvents` 而非 `roundEvents` 构建，会导致类似问题

### 下一步

1. ✅ 修复 `processDestroyMoveCycle` 中的 bug（line 1008）
2. ✅ 更新测试以覆盖完整的循环逻辑（而非只测单次调用）
3. ✅ 将 D40 维度添加到审计文档
4. ✅ 更新调查文档，记录根因和审计文档改进
