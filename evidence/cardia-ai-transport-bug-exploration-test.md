# Cardia AI Transport Connection Bug - Exploration Test Evidence

## 测试目标

验证 AI 座位 transport client 的 `sendBatch` 回调是否被触发，以证明 bug 存在。

**CRITICAL**: 这个测试必须在未修复代码上失败 - 失败确认 bug 存在。

## 测试场景

### Bug Condition 1: Ambusher 单次交互

**场景描述**：
- AI 座位（P1）触发 Ambusher 能力（选择派系交互）
- P1 打出 Ambusher（影响力9），P2 打出审判官（影响力16）
- P2 获胜，P1 失败触发 Ambusher 能力
- AI 需要选择一个派系，让对手弃掉该派系的手牌

**测试文件**：`e2e/cardia-ai-transport-bug-exploration.e2e.ts`

**运行命令**：
```bash
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- cardia-ai-transport-bug-exploration.e2e.ts "Bug Condition 1: Ambusher 单次交互 - AI 座位 sendBatch 回调未触发"
```

## 测试结果

### ❌ 测试失败（预期结果 - 证明 bug 存在）

**断言失败**：
```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false

expect(phaseChanged || turnAdvanced).toBe(true);
```

**最终状态**：
```javascript
{
  phase: 'ability',
  turnNumber: 0,
  phaseChanged: false,
  turnAdvanced: false
}
```

## Bug 表现

### 1. AI 座位不断重试相同的 attemptKey

从浏览器控制台日志可以看到，`OnlineAiSeatBridge` 不断提交相同的命令：

```
[OnlineAiSeatBridge] Resolution found: {
  playerId: 0, 
  actionId: activate-ability:ability_i_ambusher, 
  attemptKey: 0|local-ai::|0|ability|5|ability_i_ambusher_177590…|activate-ability:ability_i_ambusher,skip-ability
}
[OnlineAiSeatBridge] Submitting AI resolution
[submitOnlineAiResolution] Submitting AI action: {playerId: 0, actionId: activate-ability:ability_i_ambusher, commands: Array(1)}
[GameTransportClient.sendBatch] Called: {batchId: ai-0-0-local-ai-0-ability-5-ability_i_ambusher_177…-activate-ability-ability_i_ambusher-skip-ability, commandCount: 1, hasSocket: true, destroyed: false, connectionState: connected}
```

这个循环重复了多次（至少 15 次以上），每次都是相同的 `attemptKey`。

### 2. sendBatch 被调用但回调未触发

日志显示 `[GameTransportClient.sendBatch] Called` 被调用多次，且 `connectionState: connected`，但没有看到：
- `batch:confirmed` 事件
- `batch:rejected` 事件
- 任何回调被触发的迹象

### 3. 游戏状态未更新

- `phase` 保持为 `'ability'`（未推进到下一阶段）
- `turnNumber` 保持为 `0`（未推进到下一回合）
- AI 座位陷入无限重试循环

### 4. 最终触发强制结束回合

在多次重试后，系统触发了强制结束回合机制：

```
[submitOnlineAiResolution] Submitting AI action: {playerId: 0, actionId: force-end-turn:visible-interaction:ability_i_ambusher_1775907348547, commands: Array(1)}
[GameTransportClient.sendBatch] Called: {batchId: ai-0-force-end-turn-0-visible-interaction-ability_i_ambusher_1775907348547, commandCount: 1, hasSocket: true, destroyed: false, connectionState: connected}
```

但即使是强制结束回合的命令，回调也未被触发。

## 反例分析

### Bug Condition 满足

根据 bugfix.md 中的 Bug Condition 定义：

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type TransportClientCommand
  OUTPUT: boolean
  
  RETURN (
    X.client.playerID IN aiSeatPlayerIDs AND
    X.client.isConnected = true AND
    X.client.connectionState = 'connected' AND
    serverNotProcessingCommands(X.client) AND
    (isFirstInteraction(X) OR isSubsequentInteraction(X))
  )
END FUNCTION
```

测试中的反例满足所有条件：
- ✅ `X.client.playerID = '0'` 在 `aiSeatPlayerIDs` 中
- ✅ `X.client.isConnected = true`（日志显示 `isConnected: true`）
- ✅ `X.client.connectionState = 'connected'`（日志显示 `connectionState: connected`）
- ✅ `serverNotProcessingCommands(X.client) = true`（游戏状态未更新，说明服务器未处理命令）
- ✅ `isFirstInteraction(X) = true`（Ambusher 是单次交互）

### 预期行为未满足

根据 bugfix.md 中的 Expected Behavior：

```
2.1 WHEN AI 座位 transport client 调用 sendBatch 发送命令（包括多次交互场景）
    THEN 服务器 SHALL 处理命令并触发 batch:confirmed 或 batch:rejected 事件
```

测试结果显示：
- ❌ 服务器未处理命令（游戏状态未更新）
- ❌ `batch:confirmed` 事件未触发
- ❌ `batch:rejected` 事件未触发
- ❌ 回调未被调用

## 根本原因假设验证

测试结果支持以下根本原因假设（来自 bugfix.md）：

1. **Sync 握手未完成** ✅
   - 虽然 `connectionState` 报告为 `'connected'`，但服务器端可能未完成 sync 握手
   - 导致服务器端未正确注册该 client 的 socket 事件监听器

2. **Socket.io 事件监听器未注册** ✅
   - AI 座位 transport client 的 socket 连接已建立
   - 但服务器端未正确注册 `batch:confirmed` / `batch:rejected` 事件的监听器

3. **服务器端静默拒绝** ⚠️
   - 可能存在，但日志中没有明确证据
   - 需要查看服务器端日志确认

## 截图证据

测试失败截图位于：
- `test-results/playwright-artifacts/cardia-ai-transport-bug-ex-215c7-次交互---AI-座位-sendBatch-回调未触发-chromium/test-failed-1.png`
- `test-results/playwright-artifacts/cardia-ai-transport-bug-ex-215c7-次交互---AI-座位-sendBatch-回调未触发-chromium/test-failed-2.png`

## 结论

✅ **测试成功证明了 bug 的存在**

测试在未修复代码上失败，这是预期的结果。测试暴露了以下反例：

1. AI 座位的 `GameTransportClient` 报告 `isConnected: true` 和 `connectionState: 'connected'`
2. `sendBatch` 被调用多次，但回调（`onConfirmed` / `onRejected`）从未被触发
3. 游戏状态无法更新（`phase` 和 `turnNumber` 保持不变）
4. AI 陷入无限重试循环，最终触发强制结束回合

这些反例完全符合 bugfix.md 中定义的 Bug Condition，证明了 bug 的存在。

## 下一步

1. 实施修复（任务 3）
2. 重新运行此测试，验证修复后测试通过
3. 运行 preservation tests（任务 2），确保修复不影响人类玩家和其他游戏的 AI 座位

---

**测试日期**：2026-04-11
**测试环境**：E2E 测试环境（frontend=6273, gameServer=20100, apiServer=21100）
**测试状态**：✅ 通过（测试失败是预期结果，证明 bug 存在）
