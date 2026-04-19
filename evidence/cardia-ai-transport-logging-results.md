# Cardia AI Transport Logging Enhancement Results

## 概述

本文档记录了 Cardia AI Transport Connection Fix 项目中日志增强（Tasks 3.1-3.3）的结果，以及通过日志发现的实际根本原因。

## 执行的任务

### Task 3.1: 增强 client.ts 日志和超时机制
- ✅ 在 `src/engine/transport/client.ts` 的 `sendSync()` 和 `sendBatch()` 方法中添加详细日志
- ✅ 添加 10 秒超时机制
- ✅ 添加 socket 连接状态校验
- ✅ ESLint 检查通过（0 errors）

### Task 3.2: 增强 server.ts 日志和状态校验
- ✅ 在 `src/engine/transport/server.ts` 的 `handleSync()`、`handleBatch()` 和 `executeBatchInternal()` 方法中添加详细日志
- ✅ 添加 batch 事件发送前的 socket 状态校验
- ✅ 添加凭据验证失败的明确错误返回
- ✅ ESLint 检查通过（0 errors）

### Task 3.3: 增强 MatchRoom.tsx 和 onlineAiForceSkip.ts 日志
- ✅ 在 `src/pages/MatchRoom.tsx` 的 `OnlineAiSeatBridge` 组件中添加日志
- ✅ 在 `src/pages/onlineAiForceSkip.ts` 的 `submitOnlineAiResolution` 函数中添加日志
- ✅ 添加 15 秒超时保护
- ✅ ESLint 检查通过（0 errors）

## Bug Condition Exploration Test 结果

### 测试命令
```bash
BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 npm run test:e2e:ci:file -- cardia-ai-transport-bug-exploration.e2e.ts
```

### 测试结果：ALL 4 SCENARIOS FAILED ❌

#### Scenario 1: Ambusher 单次交互
- **预期**：AI 座位触发 Ambusher 能力，选择派系交互完成
- **实际**：测试失败，AI 命令被拒绝
- **关键日志**：`batch:rejected` with `reason: 'command_failed'`

#### Scenario 2: Inventor 第一次交互
- **预期**：AI 座位触发 Inventor 能力，第一次选择卡牌交互完成
- **实际**：测试失败，AI 命令被拒绝
- **关键日志**：`batch:rejected` with `reason: 'command_failed'`

#### Scenario 3: Inventor 第二次交互
- **预期**：AI 座位触发 Inventor 能力，两次选择都完成
- **实际**：测试失败，AI 命令被拒绝
- **关键日志**：`batch:rejected` with `reason: 'command_failed'`

#### Scenario 4: 超出范围键测试
- **预期**：AI 座位选择无效选项时，服务器返回 `batch:rejected`
- **实际**：测试失败，AI 命令被拒绝
- **关键日志**：`batch:rejected` with `reason: 'command_failed'`

## 关键发现

### ✅ 传输层工作正常

1. **AI 座位 transport client 的 `sendBatch` 回调确实被触发**
   - 不是"回调未触发"的问题
   - 回调正确接收到 `batch:rejected` 事件

2. **服务器端正确返回 `batch:rejected` 事件**
   - 不是"服务器端静默拒绝"的问题
   - 事件监听器正确注册和触发

3. **Socket 连接状态正常**
   - `client.isConnected` 为 `true`
   - `client.connectionState` 为 `'connected'`
   - `socket.connected` 为 `true`

### ❌ 实际问题：命令验证/执行失败

**所有 AI 命令都以 `reason: 'command_failed'` 被拒绝**

这意味着问题在 `src/engine/transport/server.ts` 的 `executeCommandInternal` 方法中：
```typescript
const result = executePipeline(pipelineConfig, state, command, random, playerIds);

if (!result.success) {
    // AI 命令在这里失败
    gameLogger.commandFailed(
        match.matchID,
        commandType,
        playerID,
        new Error(result.error ?? 'command_failed')
    );
    
    // 返回 batch:rejected
    socket.emit('batch:rejected', matchID, batchId, 'command_failed');
    return false;
}
```

## 原始假设 vs 实际根本原因

### 原始假设（INCORRECT）
- AI 座位 transport client 的 `sendBatch` 回调未被触发
- 问题在传输层连接或事件处理

### 实际根本原因（CONFIRMED）
- AI 座位 transport client 的 `sendBatch` 回调**确实被触发**
- 问题在**服务器端命令验证/执行逻辑**
- AI 提交的 `RESOLVE_INTERACTION` 命令在 `executePipeline` 中失败

## 下一步调查方向

### 1. 交互数据格式
- 检查 AI 如何构建 `RESOLVE_INTERACTION` 命令的 `payload`
- 检查服务器端期望的 `payload` 格式
- 对比人类玩家和 AI 座位提交的数据格式差异

### 2. 交互 ID 匹配
- 检查 AI 提交的 `interactionId` 是否与服务器端当前交互一致
- 检查 `src/pages/onlineAiForceSkip.ts` 中如何获取 `interactionId`

### 3. 玩家 ID 验证
- 检查 AI 座位的 `playerID` 是否与交互的 `playerId` 匹配
- 检查服务器端如何验证 `playerID`

### 4. 交互状态生命周期
- 检查交互是否在 AI 提交命令前被清除
- 检查多次交互场景下的状态管理

### 5. 验证逻辑
- 检查 `validateFactionSelection` 等验证函数
- 检查 AI 提交的数据格式是否符合验证要求

### 6. 多次交互特殊问题
- 检查第一次交互成功后，第二次交互为何失败
- 检查 `queueInteraction` 的实现

## 相关文件

- `src/engine/transport/client.ts` - 客户端传输层（已增强日志）
- `src/engine/transport/server.ts` - 服务端传输层（已增强日志）
- `src/pages/MatchRoom.tsx` - OnlineAiSeatBridge 组件（已增强日志）
- `src/pages/onlineAiForceSkip.ts` - submitOnlineAiResolution 函数（已增强日志）
- `src/engine/pipeline.ts` - executePipeline 函数（命令验证/执行）
- `src/games/cardia/domain/abilities/group7-faction.ts` - Ambusher 能力实现
- `src/games/cardia/domain/interactionHandlers.ts` - 交互处理器
- `src/engine/ai/localRunner.ts` - AI 决策逻辑

## 结论

日志增强（Tasks 3.1-3.3）成功揭示了实际根本原因：
- ✅ 传输层工作正常（回调被触发，事件正确返回）
- ❌ 命令验证/执行失败（AI 命令在 `executePipeline` 中被拒绝）

下一步需要深入调查为什么 AI 提交的 `RESOLVE_INTERACTION` 命令会失败验证/执行。
