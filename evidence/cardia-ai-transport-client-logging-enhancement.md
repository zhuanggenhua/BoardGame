# Cardia AI Transport Client 日志和超时机制增强

## 修改概述

本次修改增强了 `src/engine/transport/client.ts` 中的日志记录和超时机制，以帮助诊断 AI 座位 transport client 的 `sendBatch` 回调未触发问题。

## 修改内容

### 1. 新增批次超时机制

**新增字段**：
- `_batchTimeouts: Map<string, ReturnType<typeof setTimeout>>` - 批次超时定时器映射表
- `BATCH_TIMEOUT_MS = 10000` - 10秒批次超时常量

**新增方法**：
- `clearBatchTimeout(batchId: string)` - 清理单个批次的超时定时器
- `clearAllBatchTimeouts()` - 清理所有批次的超时定时器（在 `disconnect()` 中调用）

**超时机制实现**：
- 在 `sendBatch()` 中启动 10 秒超时定时器
- 如果在 10 秒内未收到 `batch:confirmed` 或 `batch:rejected` 事件，自动调用 `onRejected('timeout')`
- 收到响应或断开连接时，自动清理超时定时器
- 避免无限等待，确保回调必定被触发

### 2. 增强 sendSync() 日志

**新增日志字段**：
- `connectionState` - 当前连接状态
- `credentialsLength` - 凭据长度（用于验证凭据是否存在）
- `socketConnected` - 底层 socket 连接状态

**日志位置**：
- 发送 sync 请求前：记录完整的连接状态和凭据信息
- 无法发送 sync 时：记录失败原因和当前状态

### 3. 增强 sendBatch() 日志

**新增日志字段**：
- `commandTypes` - 命令类型数组（用于追踪具体发送了哪些命令）
- `isConnected` - `isConnected` getter 的返回值
- `hasCredentials` - 是否有凭据

**新增日志点**：
- 调用开始：记录完整的连接状态、命令信息和凭据状态
- 注册事件监听器：记录批次 ID 和对局信息
- 事件监听器已注册：记录准备发送 batch 事件
- batch 事件已发送：记录发送完成和当前 socket 状态
- batch:confirmed 触发：记录批次 ID 和是否有状态
- batch:rejected 触发：记录批次 ID 和拒绝原因
- disconnect 触发：记录批次 ID 和对局信息
- 批次超时：记录批次 ID、对局信息和超时时长

### 4. 增强 socket 连接状态校验

**修改前**：
```typescript
if (this._connectionState !== 'connected') {
    // 拒绝命令
}
```

**修改后**：
```typescript
if (this._connectionState !== 'connected' || !this.socket.connected) {
    // 拒绝命令
}
```

**改进点**：
- 同时检查 `connectionState === 'connected'` 和 `socket.connected === true`
- 确保底层 socket 真正连接，而不仅仅是客户端状态报告已连接
- 避免 `connectionState` 报告 `'connected'` 但底层 socket 实际未连接的情况

## 预期效果

### 1. 超时保护
- AI 座位的 `sendBatch` 回调在 10 秒内必定被触发（confirmed / rejected / timeout）
- 避免无限等待导致游戏卡死

### 2. 详细日志
- 可以追踪 `sendBatch` 的完整生命周期：
  - 调用时的连接状态
  - 事件监听器注册状态
  - batch 事件发送结果
  - 服务器响应（confirmed / rejected / timeout）
- 可以对比 AI 座位和人类玩家的日志，找出差异点

### 3. 连接状态校验
- 更严格的连接状态检查，避免在 socket 未真正连接时发送命令
- 减少"报告已连接但实际未连接"的边缘情况

## 验证方法

1. **运行 E2E 测试**：
   ```bash
   BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1 npm run test:e2e:ci:file -- cardia-ai-opponent.e2e.ts "AI vs AI 完整对局：验证两个 AI 能够完成完整游戏"
   ```

2. **检查日志输出**：
   - 查看 `[GameTransportClient.sendBatch]` 日志
   - 确认是否记录了完整的连接状态、命令信息和事件触发
   - 如果出现超时，查看 `批次超时，未收到 batch:confirmed 或 batch:rejected` 日志

3. **对比 AI 座位和人类玩家日志**：
   - AI 座位的日志应该与人类玩家的日志结构一致
   - 如果 AI 座位的日志缺少某些关键信息（如 `batch:confirmed` 触发），说明问题在服务器端

## 下一步

本次修改完成了任务 3.1 的所有要求：
- ✅ 在 `sendSync()` 方法中添加详细日志
- ✅ 在 `sendBatch()` 方法中添加详细日志
- ✅ 添加 `sendBatch` 超时机制（10 秒）
- ✅ 添加 socket 连接状态校验

下一步应该继续执行任务 3.2：增强 `server.ts` 日志和状态校验。
