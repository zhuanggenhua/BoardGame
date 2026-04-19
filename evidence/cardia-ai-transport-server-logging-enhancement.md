# Cardia AI Transport Server Logging Enhancement

## 任务概述

**任务**: 3.2 增强 server.ts 日志和状态校验

**目标**: 在 `src/engine/transport/server.ts` 中添加详细日志和状态校验，帮助诊断 AI 座位 transport client 无法完成交互命令的问题。

## 实施内容

### 1. handleSync() 方法增强

**位置**: `src/engine/transport/server.ts` - `handleSync()` 方法

**新增日志**:
- 收到 sync 请求时记录 matchID、playerID、socketId 和凭据状态
- 从存储加载对局时记录日志
- 对局未找到时记录警告日志
- 凭据验证结果详细记录（包括是否有存储的凭据）
- 凭据验证失败时记录警告日志
- Socket 注册成功后记录详细信息（包括房间名称）
- 旁观者 socket 添加时记录旁观者数量
- 玩家 socket 添加时记录连接数量
- 离线定时器清除时记录日志
- `state:sync` 事件发送后记录 stateID 和 randomCursor

**关键改进**:
- 完整的 sync 握手流程可追溯
- 凭据验证过程透明化
- Socket 注册状态清晰可见
- 便于排查 AI 座位连接问题

### 2. handleBatch() 方法增强

**位置**: `src/engine/transport/server.ts` - `handleBatch()` 方法

**新增日志**:
- 收到 batch 请求时记录 matchID、playerID、batchId、socketId、命令数量和命令类型列表
- 对局未找到时记录警告日志
- 批次排队时记录队列长度
- 每个命令执行前记录命令类型
- 命令失败时记录回滚信息（包括 snapshotStateID）
- `batch:rejected` 事件发送前检查 socket 连接状态
- Socket 断开时记录警告日志
- `batch:rejected` 事件发送后记录日志
- `batch:confirmed` 事件发送前检查 socket 连接状态
- `batch:confirmed` 事件发送后记录 stateID

**关键改进**:
- 批次执行全流程可追溯
- 命令失败和回滚过程清晰
- Socket 状态校验防止事件发送到已断开的连接
- 便于排查批次命令处理问题

### 3. executeBatchInternal() 方法增强

**位置**: `src/engine/transport/server.ts` - `executeBatchInternal()` 方法

**新增日志**:
- 批次执行开始时记录完整上下文（matchID、playerID、batchId、命令数量和类型列表）
- 每个命令执行前记录命令类型
- 命令失败时记录回滚信息
- `batch:rejected` 事件发送前检查 socket 连接状态
- Socket 断开时记录警告日志
- `batch:rejected` 事件发送后记录日志
- `batch:confirmed` 事件发送前检查 socket 连接状态
- `batch:confirmed` 事件发送后记录 stateID

**关键改进**:
- 与 handleBatch 保持一致的日志策略
- 队列消费路径同样具备完整可追溯性
- Socket 状态校验覆盖所有批次执行路径

### 4. batch 事件监听器增强

**位置**: `src/engine/transport/server.ts` - `start()` 方法中的 `socket.on('batch', ...)` 监听器

**新增日志**:
- Socket 未注册或 playerID 缺失时记录警告日志（包括详细的 info 状态）
- 凭据验证前记录日志（包括凭据状态）
- 凭据验证失败时记录警告日志
- 凭据验证成功后记录日志，准备调用 handleBatch

**关键改进**:
- 凭据验证失败的明确错误返回
- 便于排查 socket 注册和凭据问题
- 完整的批次请求处理链路可追溯

## 验证结果

### ESLint 检查

```bash
npx eslint src/engine/transport/server.ts
```

**结果**: ✅ 通过（0 errors, 2 warnings）
- 2 个 warnings 是既有的 `@typescript-eslint/no-explicit-any` 警告，与本次修改无关

## 预期效果

### 问题诊断能力提升

1. **Sync 握手问题**:
   - 可以追踪 AI 座位的 sync 请求是否到达服务器
   - 可以确认凭据验证是否通过
   - 可以确认 socket 是否正确注册到对局房间
   - 可以确认 `state:sync` 事件是否成功发送

2. **Batch 命令处理问题**:
   - 可以追踪 AI 座位的 batch 请求是否到达服务器
   - 可以确认凭据验证是否通过
   - 可以追踪每个命令的执行状态
   - 可以确认 `batch:confirmed` / `batch:rejected` 事件是否发送
   - 可以检测 socket 在事件发送前是否已断开

3. **多次交互场景**:
   - 可以追踪第一次交互和第二次交互的完整流程
   - 可以对比两次交互的 socket 状态和事件监听器注册状态
   - 可以确认是否存在状态不一致问题

### 日志示例

**正常 Sync 握手**:
```
[GameTransport] handleSync: received sync request { matchID: 'test-match', playerID: '0', socketId: 'abc123', hasCredentials: true }
[GameTransport] handleSync: credentials validation result { matchID: 'test-match', playerID: '0', socketId: 'abc123', authorized: true, hasStoredCredentials: true }
[GameTransport] handleSync: socket registered { matchID: 'test-match', playerID: '0', socketId: 'abc123', roomJoined: 'game:test-match' }
[GameTransport] handleSync: player socket added { matchID: 'test-match', playerID: '0', socketId: 'abc123', connectionCount: 1 }
[GameTransport] handleSync: state:sync event sent { matchID: 'test-match', playerID: '0', socketId: 'abc123', stateID: 5, randomCursor: 10 }
```

**正常 Batch 执行**:
```
[GameTransport] batch: validating credentials { matchID: 'test-match', batchId: 'batch-1', playerID: '0', socketId: 'abc123', hasCredentials: true, hasStoredCredentials: true }
[GameTransport] batch: credentials validated, calling handleBatch { matchID: 'test-match', batchId: 'batch-1', playerID: '0', socketId: 'abc123' }
[GameTransport] handleBatch: received batch request { matchID: 'test-match', playerID: '0', batchId: 'batch-1', socketId: 'abc123', commandCount: 1, commandTypes: ['RESOLVE_INTERACTION'] }
[GameTransport] handleBatch: executing command { matchID: 'test-match', playerID: '0', batchId: 'batch-1', commandType: 'RESOLVE_INTERACTION' }
[GameTransport] handleBatch: batch:confirmed event sent { matchID: 'test-match', playerID: '0', batchId: 'batch-1', stateID: 6 }
```

**凭据验证失败**:
```
[GameTransport] handleSync: received sync request { matchID: 'test-match', playerID: '0', socketId: 'abc123', hasCredentials: false }
[GameTransport] handleSync: credentials validation result { matchID: 'test-match', playerID: '0', socketId: 'abc123', authorized: false, hasStoredCredentials: true }
[GameTransport] handleSync: unauthorized { matchID: 'test-match', playerID: '0', socketId: 'abc123' }
```

**Socket 断开检测**:
```
[GameTransport] handleBatch: received batch request { matchID: 'test-match', playerID: '0', batchId: 'batch-1', socketId: 'abc123', commandCount: 1, commandTypes: ['RESOLVE_INTERACTION'] }
[GameTransport] handleBatch: executing command { matchID: 'test-match', playerID: '0', batchId: 'batch-1', commandType: 'RESOLVE_INTERACTION' }
[GameTransport] handleBatch: socket disconnected before batch:confirmed { matchID: 'test-match', playerID: '0', batchId: 'batch-1', socketId: 'abc123' }
```

## 符合需求

### Requirements 覆盖

- ✅ **2.1**: 服务器处理命令并触发 `batch:confirmed` 或 `batch:rejected` 事件（日志可追溯）
- ✅ **2.2**: Sync 握手完成后 socket 正确注册（日志可追溯）
- ✅ **2.3**: AI 决策提交后收到确认（日志可追溯）
- ✅ **2.4**: 凭据验证失败时返回明确错误（日志记录 + `batch:rejected` 事件）
- ✅ **2.5**: 多次交互场景下命令都能被正确处理（日志可追溯每次交互）
- ✅ **2.6**: 多个交互排队时服务器正确注册和触发回调（日志可追溯）

### Bug Condition 覆盖

- ✅ 服务器端可能未完成 sync 握手或未正确注册该 client 的事件监听器（日志可确认）
- ✅ 服务器端静默拒绝（凭据验证失败时明确返回 `batch:rejected`）
- ✅ Socket 状态校验（事件发送前检查 socket 是否仍然连接）
- ✅ 多次交互场景的状态一致性（日志可对比两次交互的状态）

### Preservation

- ✅ 人类玩家的 transport client 行为保持不变（只添加日志，不改变逻辑）
- ✅ Dice Throne 和 Smash Up 游戏的 AI 座位命令处理保持不变（只添加日志，不改变逻辑）

## 下一步

本任务（3.2）已完成。下一步应执行任务 3.3：增强 MatchRoom.tsx 和 onlineAiForceSkip.ts 日志。

## 相关文件

- `src/engine/transport/server.ts` - 主要修改文件
- `.kiro/specs/cardia-ai-transport-connection-fix/bugfix.md` - Bug 描述
- `.kiro/specs/cardia-ai-transport-connection-fix/design.md` - 设计文档
- `.kiro/specs/cardia-ai-transport-connection-fix/tasks.md` - 任务列表
