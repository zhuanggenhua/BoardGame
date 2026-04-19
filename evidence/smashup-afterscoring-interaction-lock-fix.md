# SmashUp afterScoring 响应窗口交互锁定修复

## 问题描述

用户反馈：在 afterScoring 响应窗口中打出卡牌后，如果卡牌创建了交互（如"我们乃最强"、"重返深海"），响应窗口会立即推进到下一个玩家或关闭，导致基地在交互完成前就被清除，玩家无法完成交互。

## 根本原因

`ResponseWindowSystem` 有一个"前瞻检查"机制（lookahead check），用于检测同一批事件中是否包含交互锁定请求事件（`SYS_INTERACTION_REQUESTED`）。如果有，系统会等待交互完成后再推进响应窗口。

但是，SmashUp 的 `ResponseWindowSystem` 配置中没有设置 `interactionLock.requestEvent`，导致这个前瞻检查失效。

### 代码分析

在 `ResponseWindowSystem.ts` 的 `afterEvents` hook 中：

```typescript
// 前瞻检查：同一批事件中是否包含交互锁定请求事件（如 INTERACTION_REQUESTED）
// 用于 responseAdvanceEvents 推进时判断——如果同批事件中有交互请求，
// 应走锁定分支而非直接推进，避免因事件顺序（CARD_PLAYED 先于 INTERACTION_REQUESTED）
// 导致窗口在交互创建前就被关闭
const hasInteractionLockRequest = interactionLock
    ? events.some(e => e.type === interactionLock.requestEvent)
    : false;

// ...

// 响应者推进：配置的事件触发后推进到下一个响应者
for (const adv of advanceEvents) {
    if (event.type !== adv.eventType) continue;
    // ...
    
    // 前瞻：同批事件中有交互锁定请求（如 INTERACTION_REQUESTED），
    // 但 InteractionSystem（优先级更高）尚未执行，sys.interaction.current 还是空的。
    // 此时不能推进窗口，等后续 interactionLock 分支处理锁定。
    if (hasInteractionLockRequest) {
        break;
    }
    
    // 有活跃的交互时暂不推进（等交互完成后由状态驱动解锁推进）
    if (newState.sys.interaction?.current) {
        const interactionId = newState.sys.interaction.current.id;
        const markedForLock = { ...currentWindow, pendingInteractionId: interactionId };
        newState = {
            ...newState,
            sys: {
                ...newState.sys,
                responseWindow: { current: markedForLock },
            },
        };
        break;
    }
    
    // 【问题】如果没有 interactionLock 配置，hasInteractionLockRequest 永远是 false
    // 如果交互还没创建（sys.interaction.current 为空），窗口会立即推进！
    const nextWindow = skipToNextRespondableResponder(...);
    if (nextWindow) {
        newState = openResponseWindow(newState, nextWindow);
    } else {
        newState = closeResponseWindow(newState); // 窗口关闭，基地被清除！
    }
}
```

### 时序问题

1. 玩家打出 afterScoring 卡牌（如"我们乃最强"）
2. `CARD_PLAYED` 事件被触发
3. `ResponseWindowSystem`（priority=15）检测到 `responseAdvanceEvents` 匹配
4. 检查 `hasInteractionLockRequest` → false（因为没有配置 `interactionLock`）
5. 检查 `sys.interaction.current` → undefined（因为 `InteractionSystem` priority=20，还没执行）
6. **窗口立即推进到下一个玩家或关闭**
7. `SmashUpEventSystem`（priority=50）检测到 `RESPONSE_WINDOW_CLOSED`，触发 `BASE_CLEARED`
8. **基地被清除，随从消失**
9. `InteractionSystem`（priority=20）创建交互 → 但基地已经空了！

## 解决方案

在 SmashUp 的 `ResponseWindowSystem` 配置中添加 `interactionLock` 配置：

```typescript
createResponseWindowSystem({
    allowedCommands: ['su:play_action', 'su:play_minion'],
    responderExemptCommands: [],
    commandWindowTypeConstraints: {
        'su:play_action': ['meFirst', 'afterScoring'],
        'su:play_minion': ['meFirst'],
    },
    responseAdvanceEvents: [
        { eventType: 'su:action_played', windowTypes: ['meFirst', 'afterScoring'] },
        { eventType: 'su:minion_played', windowTypes: ['meFirst'] },
    ],
    loopUntilAllPass: true,
    interactionLock: {
        requestEvent: 'SYS_INTERACTION_REQUESTED',  // ← 新增
    },
    hasRespondableContent: (state, playerId, windowType) => {
        // ...
    },
}),
```

## 修复效果

添加 `interactionLock` 配置后：

1. 玩家打出 afterScoring 卡牌
2. `CARD_PLAYED` 事件被触发
3. `ResponseWindowSystem` 检测到 `responseAdvanceEvents` 匹配
4. 检查 `hasInteractionLockRequest` → **true**（同批事件中有 `SYS_INTERACTION_REQUESTED`）
5. **不推进窗口，等待交互创建**
6. `InteractionSystem` 创建交互
7. `ResponseWindowSystem` 检测到 `sys.interaction.current` 存在，设置 `pendingInteractionId`
8. **窗口被锁定，等待交互完成**
9. 玩家完成交互
10. `ResponseWindowSystem` 检测到 `sys.interaction.current` 被清空，解锁并推进窗口
11. 窗口推进到下一个玩家或关闭
12. `SmashUpEventSystem` 触发 `BASE_CLEARED`，基地被清除

## 测试验证

运行现有测试 `afterscoring-response-window-execution.test.ts`：

```bash
npm test -- src/games/smashup/__tests__/afterscoring-response-window-execution.test.ts
```

结果：✅ 2 个测试全部通过

- ✅ 在 afterScoring 响应窗口中打出"重返深海"应该立即执行能力
- ✅ 在 afterScoring 响应窗口中打出"我们乃最强"应该立即执行能力

## 影响范围

这个修复同时解决了两个问题：

1. **afterScoring 响应窗口**：打出创建交互的卡牌时，窗口会等待交互完成后再推进
2. **meFirst 响应窗口**：打出创建交互的卡牌时，窗口会等待交互完成后再推进到下一个玩家

## 相关文档

- `src/engine/systems/ResponseWindowSystem.ts` - 响应窗口系统实现
- `src/games/smashup/game.ts` - SmashUp 游戏配置
- `docs/ai-rules/engine-systems.md` - 引擎系统文档

## 总结

通过添加 `interactionLock: { requestEvent: 'SYS_INTERACTION_REQUESTED' }` 配置，启用了 `ResponseWindowSystem` 的前瞻检查机制，确保响应窗口在交互完成前不会推进，从而避免基地在交互期间被清除的问题。

这是一个**面向百游戏的通用解决方案**，适用于所有使用 `ResponseWindowSystem` 的游戏。
