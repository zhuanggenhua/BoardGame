# SmashUp 消灭触发链与 pendingSave 机制

本文档只约束 SmashUp 当前消灭触发 runtime；通用审计维度见 `.spec/knowledge/standards/testing-audit-dimensions.md`。

## SmashUp 消灭触发链与 pendingSave 机制（强制）

> **修改 `processDestroyTriggers`、`postProcessSystemEvents` 或相关 trigger 逻辑时必读。**

### 架构概述

消灭触发处理分为两层，**必须理解它们的关系**：

| 层 | 位置 | 职责 | 运行时机 |
|---|---|---|---|
| `execute()` 内部 | `reducer.ts` | 处理命令产生的 `MINION_DESTROYED` 事件的 trigger 链（onDestroy → baseTrigger → ongoing） | 事件被 reduce 到 core 之前 |
| `postProcessSystemEvents` | `index.ts` | 处理系统事件（afterEvents 产生的）的 trigger 链 | 事件被 reduce 到 core 之后 |

**关键**：`execute()` 中的处理发生在 `reduceEventsToCore` **之前**，此时被消灭的随从仍在 `core.bases[].minions` 中，trigger 能正确找到它。如果移到 `postProcessSystemEvents`（reduce 之后），随从已被移除，trigger 会找不到目标。

### pendingSave 机制设计约束

`pendingSave` 用于暂缓 `MINION_DESTROYED` 事件——当 baseTrigger/ongoing 创建了"拯救交互"（如雄蜂防消灭、九命之屋），等待玩家决定。

**核心不变量**：
1. **`interactionCountBefore` 必须在 `onDestroy` 之后取值** — onDestroy 产生的交互是死亡效果（如 Igor 选目标放指示物），不是拯救交互，不应触发 pendingSave。
2. **通用原则：不能只凭“新交互出现了”就认定是拯救交互** — destroy 链上既可能出现 replacement/save prompt，也可能出现普通死亡效果 prompt；若没有额外合同，`interactionCountAfter > interactionCountBefore` 只能说明“出现了新交互”，不能单独推出“应该 pendingSave”。
3. **SmashUp 当前 runtime 例外（带作用域）**：`src/games/smashup/domain/reducer.ts` 的 `processDestroyTriggers()` 目前仍依赖 `PREVENT_DESTROY_SOURCE_IDS` 白名单识别交互式 replacement。也就是当前 SmashUp 的 pendingSave 合同是两段式：
   `interactionCountAfter > interactionCountBefore`
   且 `newInteraction.data.sourceId ∈ PREVENT_DESTROY_SOURCE_IDS`
   才进入 pendingSave。
   当前已锁定的 sourceId 示例：`base_nine_lives_intercept`、`giant_ant_drone_prevent_destroy`、`pirate_buccaneer_move`。
4. **新增交互式 replacement 时必须同步三处**：`reducer.ts` 的 `PREVENT_DESTROY_SOURCE_IDS`、`src/games/smashup/rule/ENGINE_GUIDE.md`、`src/games/smashup/__tests__/reactionQueueDestroyPendingSaveContract.test.ts`。未同步前，不得把“删白名单”当作默认清理动作。

**历史教训**：
- ❌ 在 onDestroy 之前取 `interactionCountBefore` → Igor 的效果交互被误判为拯救交互 → Igor 的 `MINION_DESTROYED` 被错误抑制。
- ❌ 把 `interactionCountAfter > interactionCountBefore` 直接当成 pendingSave → 普通死亡效果 prompt 也会被误判成拯救交互。
- ❌ 只给个别 sourceId 加临时特判、却不回写统一白名单合同 → 新增 `giant_ant_drone_prevent_destroy` / `pirate_buccaneer_move` 这类入口时会静默漏接。
- ✅ 当前 SmashUp 正确口径：`interactionCountBefore` 在 onDestroy 之后取值，并通过 `PREVENT_DESTROY_SOURCE_IDS` 明确声明哪些交互式 replacement 会进入 pendingSave。

### matchState 链式传递（强制）

`postProcessSystemEvents` 中 `processDestroyTriggers` → `processMoveTriggers` → `processAffectTriggers` 必须链式传递 `matchState`：

```typescript
// ✅ 正确：每步产生的 matchState 传给下一步
const afterDestroy = processDestroyTriggers(events, ms, pid, random, now);
if (afterDestroy.matchState) ms = afterDestroy.matchState;
const afterMove = processMoveTriggers(afterDestroy.events, ms, pid, random, now);
if (afterMove.matchState) ms = afterMove.matchState;

// ❌ 错误：每步都传原始 ms → trigger 创建的交互被后续步骤覆盖/丢弃
const afterDestroy = processDestroyTriggers(events, ms, pid, random, now);
const afterMove = processMoveTriggers(afterDestroy.events, ms, pid, random, now);
```
