# Card15 (发明家) 调试发现

## 当前状态
- ✅ 第一次交互正常工作
- ✅ 第二次交互被创建并加入队列
- ❌ 修正标记值错误：两个都是 -3，应该是 +3 和 -3
- ❌ 两个修正标记的 timestamp 相同
- ❌ 第二次交互的弹窗没有显示

## 调试测试结果
运行 `cardia-inventor-simple-debug.e2e.ts` 后的状态：

```javascript
{
  phase: 'play',
  modifierTokensCount: 2,
  modifierTokens: [
    {
      cardId: 'test_0_2000',
      value: -3,  // ❌ 应该是 +3
      source: 'ability_i_inventor',
      timestamp: 1772447174663
    },
    {
      cardId: 'test_0_2000',
      value: -3,  // ✅ 正确
      source: 'ability_i_inventor',
      timestamp: 1772447174663  // ❌ 与第一个相同
    }
  ],
  interactionQueue: 0,
  currentInteraction: undefined  // ❌ 应该有第二次交互
}
```

## 问题分析

### 问题 1：两个修正标记都是 -3
**可能原因**：
1. 交互处理器被调用了两次，都识别为"第二次交互"
2. `interactionId.includes('_first_')` 判断失败
3. Reduce 函数重复应用了同一个事件

**验证方法**：
- 添加服务端日志，查看交互处理器被调用的次数和参数
- 检查 `interactionData.interactionId` 的实际值

### 问题 2：两个修正标记的 timestamp 相同
**说明**：
- 两个事件是在同一次处理中生成的
- 不是两次独立的交互响应

**推测**：
- 可能是 `createCardiaEventSystem` 的 `afterEvents` 钩子处理 `ABILITY_INTERACTION_REQUESTED` 事件时，立即触发了第二次交互的处理
- 或者 reduce 函数在处理 `MODIFIER_TOKEN_PLACED` 事件时有问题

### 问题 3：第二次交互的弹窗没有显示
**可能原因**：
1. 第二次交互虽然被创建，但没有正确加入 `sys.interaction.queue`
2. `currentInteraction` 为 `undefined` 说明交互已经被处理完了
3. 可能是交互系统在第一次交互完成后立即处理了第二次交互，而不是等待用户操作

## 下一步调试

### 方案 A：检查服务端日志
查看 `logs/app-*.log` 和 `logs/error-*.log`，搜索：
- `[Inventor] Interaction handler called`
- `[CardiaEventSystem]`
- `ABILITY_INTERACTION_REQUESTED`

### 方案 B：简化实现（推荐）
不使用 `ABILITY_INTERACTION_REQUESTED` 事件创建第二次交互，而是：
1. 第一次交互处理器只放置 +3 修正标记
2. 使用一个特殊的事件（如 `INVENTOR_FIRST_SELECTION_COMPLETE`）
3. 在 `createCardiaEventSystem` 中监听这个事件，创建第二次交互

### 方案 C：使用 interaction.continuation
参考其他游戏的实现，使用 `interaction.continuation` 字段存储第一次选择的结果，第二次交互时一起处理。

## 临时解决方案
如果调试困难，可以暂时：
1. 将发明家能力改为只放置一个修正标记（+3 或 -3，由玩家选择）
2. 或者改为自动放置（第一张己方牌 +3，第一张对手牌 -3）
3. 标注为"已知问题"，后续修复

## 根本原因猜测
最可能的原因是：`createCardiaEventSystem` 的 `afterEvents` 钩子在处理第一次交互的响应时，生成了两个事件：
1. `MODIFIER_TOKEN_PLACED` (value: 3)
2. `ABILITY_INTERACTION_REQUESTED` (第二次交互)

但是这两个事件被添加到 `newEvents` 数组后，又被同一个 `afterEvents` 钩子处理了一次（因为我们修改了代码，让它返回 `events: newEvents`）。

这导致：
1. 第二次交互被立即创建并加入队列
2. 第二次交互被立即处理（因为没有等待用户操作）
3. 第二次交互的处理器被调用，放置了 -3 修正标记

但是第一个 +3 修正标记不知道为什么变成了 -3。

## 修复建议
修改 `createCardiaEventSystem` 的 `afterEvents` 钩子，确保：
1. 新生成的事件不会在同一次 `afterEvents` 调用中被处理
2. 或者使用不同的机制来创建第二次交互（如在 reduce 函数中）
