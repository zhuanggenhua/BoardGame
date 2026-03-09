# 任务 20 E2E 测试进展报告

## 已完成的修复

### 1. ✅ 修复 `initContext` 函数返回值问题

**问题**：`e2e/helpers/common.ts` 中的 `initContext` 函数缺少 `return` 语句，导致返回 `void` 而不是 `BrowserContext`。

**修复**：
```typescript
export const initContext = async (
    context: BrowserContext,
    opts?: { storageKey?: string; skipTutorial?: boolean },
) => {
    // ... 初始化代码 ...
    return context; // ✅ 添加返回语句
};
```

**影响**：修复后不再报 `context.addInitScript is not a function` 错误。

### 2. ✅ 修复 `setupCardiaOnlineMatch` 函数签名

**问题**：函数接收 `Browser` 参数，但内部调用 `initContext(browser, baseURL)` 时传递了错误的参数类型。

**修复**：
```typescript
// 创建 Host 上下文
const hostContext = await browser.newContext({ baseURL });
await initContext(hostContext);  // ✅ 传递 BrowserContext
const hostPage = await hostContext.newPage();

// 创建 Guest 上下文
const guestContext = await browser.newContext({ baseURL });
await initContext(guestContext);  // ✅ 传递 BrowserContext
const guestPage = await guestContext.newPage();
```

**影响**：修复后能够正确创建浏览器上下文和页面。

### 3. ✅ 添加 Guest 凭证注入

**问题**：Guest 加入房间后没有调用 `seedMatchCredentials` 注入凭证，导致 Guest 页面显示 "Waiting for opponent..."。

**修复**：
```typescript
// Guest 加入房间
const guestCredentials = await joinMatchViaAPI(guestPage, GAME_NAME, matchId, '1', 'Guest-Cardia-E2E');
if (!guestCredentials) {
    console.error('[Cardia] ❌ Guest 加入失败');
    await hostContext.close();
    await guestContext.close();
    return null;
}
console.log('[Cardia] ✅ Guest 已加入');

// ✅ 注入 Guest 凭证
await seedMatchCredentials(guestContext, GAME_NAME, matchId, '1', guestCredentials);
```

**影响**：修复后 Guest 能够成功加入游戏，不再显示 "Waiting for opponent..."。

### 4. ✅ 在 Board 组件中暴露状态

**问题**：Cardia 使用传输层架构，没有暴露 `window.__BG_STATE__`，导致 E2E 测试无法读取游戏状态。

**修复**：在 `src/games/cardia/Board.tsx` 中添加：
```typescript
// 暴露状态给 E2E 测试
useEffect(() => {
    if (typeof window !== 'undefined') {
        (window as any).__BG_STATE__ = G;
        (window as any).__BG_DISPATCH__ = dispatch;
    }
}, [G, dispatch]);
```

**影响**：修复后 E2E 测试能够成功读取游戏状态。

## 当前测试结果

### ✅ 测试 2：状态读取和调试工具 - 通过

```
[STEP 1] 检查调试工具
  调试工具可用: false
[STEP 2] 读取游戏状态
  ✓ 状态读取成功
  状态: {
  "phase": "play",
  "turnNumber": 1,
  "currentPlayerId": "0",
  "players": [
    {
      "id": "0",
      "name": "Player 0",
      "handCount": 5,
      "deckCount": 11,
      "playedCardsCount": 0,
      "hasPlayed": false
    },
    {
      "id": "1",
      "name": "Player 1",
      "handCount": 5,
      "deckCount": 11,
      "playedCardsCount": 0,
      "hasPlayed": false
    }
  ]
}
```

### ❌ 测试 1：基本流程 - 部分失败

**成功的部分**：
- ✅ 创建在线对局
- ✅ 双方加入游戏
- ✅ 读取初始状态
- ✅ Host 打出卡牌（`hasPlayed` 变为 `true`）

**失败的部分**：
- ❌ Guest 打出卡牌后，`hasPlayed` 仍然是 `false`

**错误信息**：
```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

expect(guestStateAfterPlay?.players[1].hasPlayed).toBe(true);
```

## 剩余问题分析

### 问题：Guest 打出卡牌后状态未更新

**可能原因**：

1. **卡牌点击未生效**
   - 选择器可能不正确
   - 卡牌按钮可能被禁用（`disabled={!canPlay}`）
   - 点击事件可能被拦截

2. **状态更新有延迟**
   - WebSocket 同步延迟
   - React 状态更新延迟
   - 当前等待时间（1000ms）可能不够

3. **玩家权限问题**
   - Guest（Player 1）可能无法在 Player 0 的回合打牌
   - 需要检查 `currentPlayerId` 和打牌权限

4. **命令执行失败**
   - 命令可能被验证层拒绝
   - 需要检查控制台错误日志

### 调试建议

1. **检查卡牌按钮状态**
   ```typescript
   const card = cards.nth(cardIndex);
   const isDisabled = await card.getAttribute('disabled');
   console.log(`[Cardia] 卡牌 ${cardIndex} disabled: ${isDisabled}`);
   ```

2. **检查当前玩家**
   ```typescript
   const state = await readGameState(guestPage);
   console.log(`[Cardia] 当前玩家: ${state?.currentPlayerId}`);
   console.log(`[Cardia] Guest ID: 1`);
   ```

3. **等待状态变化**
   ```typescript
   // 轮询等待 hasPlayed 变为 true
   const maxWait = 5000;
   const start = Date.now();
   while (Date.now() - start < maxWait) {
       const state = await readGameState(guestPage);
       if (state?.players[1].hasPlayed) {
           break;
       }
       await page.waitForTimeout(200);
   }
   ```

4. **检查控制台错误**
   ```typescript
   const diagnostics = attachPageDiagnostics(guestPage);
   // ... 执行操作 ...
   console.log('[Cardia] 错误日志:', diagnostics.errors);
   ```

## 下一步行动

### P0 优先级：修复 Guest 打牌问题

1. **添加详细日志**
   - 在 `playCard` 函数中添加更多日志
   - 记录卡牌按钮状态、当前玩家、点击前后的状态

2. **检查游戏规则**
   - 确认 Guest（Player 1）是否可以在 Player 0 的回合打牌
   - 如果不能，需要等待回合切换或修改测试逻辑

3. **增加等待时间**
   - 将 `playCard` 中的等待时间从 1000ms 增加到 2000ms
   - 或者使用轮询等待状态变化

4. **查看截图**
   - 检查 `test-results/` 中的截图，确认 UI 状态

### P1 优先级：集成调试工具

1. **暴露调试工具**
   - 在 `Board.tsx` 中调用 `exposeDebugTools()`
   - 确认 `window.__CARDIA_DEBUG__` 可用

2. **在 execute.ts 中集成日志**
   - 使用 `abilityLogger` 记录能力执行
   - 使用 `stateSnapshot` 记录状态变化

### P2 优先级：补充更多测试

1. **能力激活测试**
2. **交互系统测试**
3. **持续能力效果测试**

## 总结

已成功修复 4 个关键问题，E2E 测试基础设施已就绪。剩余问题是 Guest 打牌后状态未更新，需要进一步调试确认根本原因（可能是游戏规则限制或状态同步延迟）。

**关键成就**：
- ✅ 在线对局创建和加入流程正常
- ✅ 状态读取功能正常
- ✅ Host 打牌功能正常
- ❌ Guest 打牌功能待修复

**测试通过率**：1/2（50%）

**预计修复时间**：1-2 小时（需要详细调试和日志分析）
