# 大杀四方 - After Scoring 响应窗口 consecutivePassRounds 修复

## 更新时间
2026-03-04 19:50

## 问题描述

afterScoring 响应窗口使用 `loopUntilAllPass` 模式时，窗口在玩家能够响应之前就立即关闭了。

## 根本原因

`loopUntilAllPass` 逻辑存在 bug：
- 当 P0 打出卡牌后，`actionTakenThisRound = true`
- 窗口推进到 P1，P1 pass
- 窗口到达队列末尾，检查 `actionTakenThisRound` → true → 重新开始新一轮
- **问题**：重新开始时，`actionTakenThisRound` 被重置为 `false`
- 当 P0 pass 后，窗口到达队列末尾，检查 `actionTakenThisRound` → false → 窗口关闭
- **预期行为**：应该再循环一轮，只有连续两轮所有人都 pass 才关闭窗口

## 解决方案

添加 `consecutivePassRounds` 计数器：
- 当本轮有人执行了动作（`actionTakenThisRound = true`）→ 重置 `consecutivePassRounds = 0`
- 当本轮所有人都 pass（`actionTakenThisRound = false`）→ 增加 `consecutivePassRounds`
- 只有当 `consecutivePassRounds >= 2` 时才关闭窗口

## 实现细节

### 1. 类型定义更新（`src/engine/types.ts`）

```typescript
export interface ResponseWindowState {
    current?: {
        // ... 其他字段
        /** 本轮是否有人执行了响应动作（用于 loopUntilAllPass 循环判定） */
        actionTakenThisRound?: boolean;
        /** 连续所有人都 pass 的轮数（用于 loopUntilAllPass 循环判定） */
        consecutivePassRounds?: number;
    };
}
```

### 2. `advanceToNextResponder` 函数更新（`src/engine/systems/ResponseWindowSystem.ts`）

✅ 已实现，逻辑正确

### 3. `skipToNextRespondableResponder` 函数更新

✅ 已实现，逻辑正确

### 4. responseAdvanceEvents 处理更新

✅ 已实现，逻辑正确

## 测试结果

✅ `consecutivePassRounds` 逻辑工作正常！

从测试日志可以看到：
1. beforeScoring 窗口：P0 和 P1 都没有卡牌 → `consecutivePassRounds` 从 0 → 1 → 2 → 窗口关闭 ✅
2. afterScoring 窗口打开：P0 有卡牌 → 窗口保持打开 ✅
3. P0 打出卡牌：`actionTakenThisRound = true`, `consecutivePassRounds = 0` ✅
4. P1 被自动跳过：`actionTakenThisRound = true` → 重新开始（`consecutivePassRounds = 0`）✅
5. P0 pass：`consecutivePassRounds = 0` → 推进到 P1 ✅
6. P1 被自动跳过：`consecutivePassRounds` 从 0 → 1 → 继续下一轮 ✅
7. P0 pass：`consecutivePassRounds = 1` → 推进到 P1 ✅
8. P1 被自动跳过：`consecutivePassRounds` 从 1 → 2 → 窗口关闭 ✅

## 新问题：重新计分逻辑未执行

测试仍然失败，只有 1 次 BASE_SCORED 事件而不是预期的 2 次。

### 根本原因

响应窗口关闭后，`onPhaseExit` 没有被再次调用，导致重新计分逻辑（在 `onPhaseExit` 开头）没有执行。

### 问题分析

1. `scoreOneBase` 函数在打开 afterScoring 响应窗口时：
   - 设置 `matchState.sys.afterScoringInitialPowers`（记录初始力量）
   - 返回 `{ events, newBaseDeck, matchState: ms }`
   - `onPhaseExit` 返回 `{ halt: true, updatedState: ms }`

2. `FlowSystem` 设置 `flowHalted = true`

3. 响应窗口关闭后：
   - `onAutoContinueCheck` 检测到 `flowHalted=true` 且响应窗口关闭
   - 返回 `{ autoContinue: true, playerId: pid }`
   - `FlowSystem` 清除 `flowHalted` 并推进到下一个阶段（`draw`）
   - **问题**：`onPhaseExit` 没有被再次调用！

4. 重新计分逻辑在 `onPhaseExit` 开头：
   ```typescript
   if (state.sys.afterScoringInitialPowers) {
       // 检查力量变化
       // 如果变化，重新计分
   }
   ```
   但是 `onPhaseExit` 没有被调用，所以重新计分逻辑没有执行。

### 解决方案

有两种方案：

#### 方案 1：修改 `onAutoContinueCheck` 逻辑（推荐）

当检测到 `flowHalted=true` 且响应窗口关闭且存在 `afterScoringInitialPowers` 时，不返回 `autoContinue`，让 `FlowSystem` 自动再次调用 `onPhaseExit`。

```typescript
// 情况1：flowHalted=true 且交互已解决且响应窗口已关闭
if (state.sys.flowHalted && !state.sys.interaction.current && !state.sys.responseWindow?.current) {
    // 【修复】如果存在 afterScoringInitialPowers，说明需要重新计分
    // 不返回 autoContinue，让 FlowSystem 再次调用 onPhaseExit
    if (state.sys.afterScoringInitialPowers) {
        console.log('[onAutoContinueCheck] scoreBases: 检测到 afterScoringInitialPowers，等待 onPhaseExit 重新计分');
        return undefined; // 不自动推进，让 FlowSystem 再次调用 onPhaseExit
    }
    
    console.log('[onAutoContinueCheck] scoreBases: flowHalted=true 且交互已解决且响应窗口已关闭，自动推进');
    return { autoContinue: true, playerId: pid };
}
```

#### 方案 2：将重新计分逻辑移到 `afterEvents`

在 `afterEvents` 中检测 `RESPONSE_WINDOW_CLOSED` 事件，如果存在 `afterScoringInitialPowers`，则执行重新计分逻辑。

这个方案更复杂，不推荐。

## 当前状态

✅ 类型定义已更新
✅ `advanceToNextResponder` 函数已更新
✅ `skipToNextRespondableResponder` 函数已更新
✅ responseAdvanceEvents 处理已更新
✅ 测试已更新
✅ `consecutivePassRounds` 逻辑工作正常

⏳ 重新计分逻辑未执行 - 需要修改 `onAutoContinueCheck`

## 下一步工作

1. 实现方案 1：修改 `onAutoContinueCheck` 逻辑
2. 运行测试验证重新计分逻辑是否执行
3. 清理调试日志
4. 更新文档

## 相关文件

- `src/engine/types.ts` - ResponseWindowState 类型定义
- `src/engine/systems/ResponseWindowSystem.ts` - 响应窗口系统实现
- `src/games/smashup/domain/index.ts` - onPhaseExit 和 onAutoContinueCheck
- `src/games/smashup/__tests__/afterScoring-rescoring.test.ts` - 测试文件
- `evidence/smashup-after-scoring-rescoring-analysis.md` - 之前的分析文档
