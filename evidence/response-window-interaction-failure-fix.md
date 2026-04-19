# 响应窗口交互失败修复 - 完成

## 问题描述

用户反馈：在响应窗口中打出"承受压力"（Under Pressure）时，如果场上没有符合条件的目标（其他基地上的己方随从），交互会显示"场上没有符合条件的目标"，但响应窗口会关闭，对手无法继续响应。

**预期行为**：
- 交互失败时（返回 `ABILITY_FEEDBACK`），响应窗口应该解锁但不推进到下一个响应者
- 当前响应者应该可以继续打出其他卡牌或选择 PASS

## 修复方案

### 1. ResponseWindowSystem 检测交互失败

在 `ResponseWindowSystem.ts` 的 `afterEvents` 钩子中，检测 `ABILITY_FEEDBACK` 事件来识别交互失败：

```typescript
// 检测交互失败（handler 返回 ABILITY_FEEDBACK）
const hasAbilityFeedback = events.some(e => e.type === 'su:ability_feedback');
if (hasAbilityFeedback && pendingInteractionId) {
    console.log('[ResponseWindowSystem] 交互失败（ABILITY_FEEDBACK），解锁但不推进');
    // 解锁响应窗口，但不推进到下一个响应者
    nextEvents.push({
        type: RESPONSE_WINDOW_EVENTS.CHECK_UNLOCK,
        payload: {},
        timestamp: events[events.length - 1]?.timestamp ?? Date.now(),
    });
}
```

### 2. 修复 systems.ts 语法错误

修复了 `src/games/smashup/domain/systems.ts` 第 192 行的语法错误：
- 错误：`interceptEvent(newState.core, evt)` （缺少 `domain.` 前缀）
- 正确：`domain.interceptEvent(newState.core, evt)`

## 测试结果

### 测试 1: 重新开始一轮时应跳过没有可响应内容的玩家
✅ **通过**

### 测试 2: 所有玩家都没有可响应内容时应立即关闭窗口
✅ **通过**

### 测试 3: 交互失败时应解锁但不推进（当前响应者继续响应）
✅ **通过**

**测试流程**：
1. 玩家 0 打出"承受压力"，创建交互（选择来源随从）
2. 玩家 0 选择来源随从（minion-1），但场上没有其他基地的己方随从
3. `handleUnderPressureChooseSource` 返回 `ABILITY_FEEDBACK` 事件
4. `ResponseWindowSystem` 检测到 `ABILITY_FEEDBACK`，解锁但不推进
5. 玩家 0 可以继续响应（PASS）
6. 推进到玩家 1

**关键日志**：
```
[handleSimpleChoiceRespond] Validation mode and options: {
  responseValidationMode: 'snapshot',
  isMulti: false,
  availableOptionsCount: 1,
  availableOptionIds: [ 'minion-0' ],
  requestedOptionId: 'minion-0'
}
[ResponseWindowSystem] 交互失败（ABILITY_FEEDBACK），解锁但不推进
[Test] Dispatch result: {
  success: true,
  error: undefined,
  events: [
    'SYS_INTERACTION_RESOLVED',
    'SYS_RESPONSE_WINDOW_CHECK_UNLOCK',
    'su:ability_feedback'
  ]
}
```

## 修复文件

1. `src/engine/systems/ResponseWindowSystem.ts` - 添加 `ABILITY_FEEDBACK` 检测逻辑
2. `src/games/smashup/domain/systems.ts` - 修复语法错误（`domain.interceptEvent`）
3. `src/games/smashup/__tests__/response-window-skip.test.ts` - 添加测试用例

## 总结

修复已完成，所有测试通过。响应窗口现在能够正确处理交互失败的情况：
- 交互失败时解锁响应窗口
- 当前响应者可以继续响应
- 不会错误地推进到下一个响应者或关闭窗口

**核心原理**：
- 响应窗口系统无法区分"成功响应"和"失败响应"
- 两种情况都会解决交互，导致窗口推进
- 通过检测 `ABILITY_FEEDBACK` 事件，识别失败的交互
- 失败时发送 `CHECK_UNLOCK` 事件解锁窗口，但不推进响应者索引
